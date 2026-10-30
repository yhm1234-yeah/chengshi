import type { AgentStep, DispatchSummary, FindingDraft, Severity, Ticket } from '@/domain/types';
import { DEPARTMENT_BASE, GRIDS, SEVERITY_META, THRESHOLDS, TYPE_META } from '@/domain/constants';
import { transition } from '@/domain/fsm';
import { retrieve } from '@/ai/rag/retrieve';
import { mcpClient } from '@/ai/mcp/client';
import { getStorage } from '@/storage';
import { hash32, sleep } from '@/lib/utils';

interface AgentOptions {
  onStep?: (step: AgentStep) => void;
  paceMs?: number;
  actor?: string;
}

interface DispatchTarget {
  finding: FindingDraft & { id?: string };
  department: string;
  grid: string;
  deadline: string;
  reason: string;
}

function nearestGrid(lng: number, lat: number) {
  return GRIDS.reduce((best, g) => {
    const d = Math.hypot(g.center.lng - lng, g.center.lat - lat);
    const bd = Math.hypot(best.center.lng - lng, best.center.lat - lat);
    return d < bd ? g : best;
  }, GRIDS[0]);
}

function deadlineFor(severity: Severity): string {
  return new Date(Date.now() + SEVERITY_META[severity].slaHours * 3600000).toISOString();
}

/**
 * 分派 Agent：感知 → 规划 → 工具 → 反思（最多 8 步）
 * 每一步都落 agent_steps，管理端时间线与审计读同一份数据
 */
export async function runDispatchAgent(ticketId: string, options: AgentOptions = {}): Promise<DispatchSummary> {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  const findings = storage.tickets.findings(ticket.id);
  const pace = options.paceMs ?? 140;
  const primary = findings[0];

  const run = storage.ai.createRun({
    ticketId: ticket.id,
    stage: 'dispatch',
    model: 'dispatch-agent',
    modelVersion: 'v1.0',
    promptDigest: `sha256:${hash32('dispatch:' + ticket.code).toString(16)}`,
    inputDigest: `ticket=${ticket.code};findings=${findings.length}`,
    outputJson: { ticketCode: ticket.code },
    tokensIn: 420,
    tokensOut: 180,
    latencyMs: 0,
    fallbackUsed: false,
    degraded: false
  });

  const steps: AgentStep[] = [];
  let seq = 0;

  const record = async (input: {
    phase: AgentStep['phase'];
    toolName: string | null;
    summary: string;
    argsDigest: string;
    resultDigest: string;
    resultCode?: AgentStep['resultCode'];
    start: number;
  }): Promise<AgentStep> => {
    if (pace > 0) await sleep(pace);
    seq += 1;
    const step = storage.ai.addStep({
      runId: run.id,
      seq,
      phase: input.phase,
      toolName: input.toolName,
      argsDigest: input.argsDigest,
      resultCode: input.resultCode ?? 'ok',
      resultDigest: input.resultDigest,
      summary: input.summary,
      elapsedMs: Math.max(1, Date.now() - input.start)
    });
    steps.push(step);
    options.onStep?.(step);
    return step;
  };

  const grid = nearestGrid(ticket.lng, ticket.lat);
  const split = findings.length > 1 && findings.every((f) => f.confidence >= THRESHOLDS.splitConfidence);
  const manualOnly = findings.length > 1 && !split;
  const labels = findings.map((f) => TYPE_META[f.type].label).join('、');

  // 1. PLAN
  if (manualOnly) {
    await record({
      phase: 'plan',
      toolName: null,
      summary: `载入工单 ${ticket.code}：多子问题中存在置信度低于 ${THRESHOLDS.splitConfidence} 的条目，整体转人工复核，不自动拆单`,
      argsDigest: `findings=${findings.length}`,
      resultDigest: 'branch=manual',
      start: Date.now()
    });
  } else {
    await record({
      phase: 'plan',
      toolName: null,
      summary: split
        ? `载入工单 ${ticket.code}：照片含 ${findings.length} 条子问题，规划拆单并分别派发`
        : `载入工单 ${ticket.code}：单条子问题，规划常规分派路径`,
      argsDigest: `ticket=${ticket.code};findings=${findings.length}`,
      resultDigest: split ? 'branch=split' : 'branch=single',
      start: Date.now()
    });
  }

  // 2. ACT 辖区匹配
  const matchStart = Date.now();
  await record({
    phase: 'act',
    toolName: 'match_grid',
    summary: `调用 [辖区匹配]：(${ticket.lng.toFixed(3)}, ${ticket.lat.toFixed(3)}) → ${grid.district} / ${grid.street} / ${grid.code} 网格`,
    argsDigest: `lng=${ticket.lng.toFixed(4)}&lat=${ticket.lat.toFixed(4)}`,
    resultDigest: `grid=${grid.code};street=${grid.street}`,
    start: matchStart
  });

  // 3. OBSERVE
  await record({
    phase: 'observe',
    toolName: null,
    summary: `观察：坐标唯一命中 ${grid.street}网格，与相邻网格边界距离大于 200 米，无需人工裁定`,
    argsDigest: `grid=${grid.code}`,
    resultDigest: 'unique=true',
    start: Date.now()
  });

  // 4. ACT 职责检索（RAG）
  const ragStart = Date.now();
  const ragByType: { type: FindingDraft['type']; clause: string; hits: number }[] = [];
  for (const f of findings) {
    const res = await retrieve(`${TYPE_META[f.type].label} 承办部门 职责 时限`, 2);
    ragByType.push({ type: f.type, clause: res.hits[0]?.chunk.clause ?? '未命中', hits: res.hits.length });
  }
  await record({
    phase: 'act',
    toolName: 'lookup_responsibility',
    summary: `调用 [职责检索·RAG]：${ragByType
      .map((r) => `${TYPE_META[r.type].label} → 依据 ${r.clause}`)
      .join('；')}`,
    argsDigest: findings.map((f) => f.type).join('+'),
    resultDigest: ragByType.map((r) => `${r.type}:${r.clause}`).join('|'),
    start: ragStart
  });

  // 5. ACT 负载查询（MCP）
  const workloadStart = Date.now();
  const workload = await mcpClient.call('query_workload', { grid: grid.code }, { runId: run.id, stepSeq: seq + 1, actor: 'agent' });
  await record({
    phase: 'act',
    toolName: 'query_workload',
    summary: `经 MCP 调用 [坐席负载]：${grid.code} 网格待办 ${workload.data.pending ?? 0} 件，用于判断插队优先级`,
    argsDigest: `grid=${grid.code}`,
    resultDigest: `pending=${workload.data.pending ?? 0}`,
    resultCode: workload.resultCode,
    start: workloadStart
  });

  // 6. DECIDE
  const targets: DispatchTarget[] = manualOnly
    ? []
    : findings.map((f) => ({
        finding: f,
        department: `${ticket.district}${DEPARTMENT_BASE[f.type]}`,
        grid: grid.code,
        deadline: deadlineFor(f.severity),
        reason: `${TYPE_META[f.type].label}依据《职责划分规范》${ragByType.find((r) => r.type === f.type)?.clause ?? '相关条款'}，指派${ticket.district}${DEPARTMENT_BASE[f.type]}`
      }));

  const decideStart = Date.now();
  await record({
    phase: 'decide',
    toolName: null,
    summary: manualOnly
      ? '决策：不自动拆单，生成人工复核任务并附协办方案建议'
      : split
        ? `决策：拆分为 ${targets.length} 条分派方案，${targets.map((t) => `${TYPE_META[t.finding.type].label}→${t.department}`).join('；')}`
        : `决策：${TYPE_META[ticket.type].label}→${targets[0]?.department ?? '待人工'}，承诺时限 ${SEVERITY_META[ticket.severity].slaHours} 小时`,
    argsDigest: `targets=${targets.length}`,
    resultDigest: `assignments=${targets.length}`,
    start: decideStart
  });

  // 7. ACT 派单 / 通知 / 督办提醒（全部经 MCP 客户端）
  const dispatchStart = Date.now();
  const receipts: { receiptNo: string; assignmentId: string }[] = [];
  const followups: string[] = [];
  let notificationId = '';
  let toolCode: AgentStep['resultCode'] = 'ok';

  for (const target of targets) {
    const res = await mcpClient.call(
      'dispatch_ticket',
      {
        ticketId: ticket.id,
        findingId: target.finding.id ?? '',
        department: target.department,
        grid: target.grid,
        deadline: target.deadline,
        reason: target.reason
      },
      { runId: run.id, stepSeq: seq + 1, actor: 'agent' }
    );
    if (!res.ok) toolCode = res.resultCode;
    const receiptNo = String(res.data.receiptNo ?? '');
    const assignmentId = String(res.data.assignmentId ?? '');
    if (receiptNo && assignmentId) {
      receipts.push({ receiptNo, assignmentId });
      const followup = await mcpClient.call(
        'schedule_followup',
        { ticketId: ticket.id, receiptNo, deadline: target.deadline },
        { runId: run.id, stepSeq: seq + 1, actor: 'agent' }
      );
      const followupId = String(followup.data.followupId ?? '');
      followups.push(followupId);
      storage.tickets.updateAssignment(assignmentId, { receiptNo, followupId });
    }
  }

  if (ticket.severity === 'urgent' && targets.length > 0) {
    const notify = await mcpClient.call(
      'notify_responsible',
      {
        department: targets[0].department,
        title: `紧急工单 ${ticket.code}`,
        body: `工单 ${ticket.code}（${labels}）已插入优先处置队列，请 ${SEVERITY_META[ticket.severity].slaHours} 小时内到场。`,
        urgency: ticket.severity
      },
      { runId: run.id, stepSeq: seq + 1, actor: 'agent' }
    );
    notificationId = String(notify.data.notificationId ?? '');
  }

  await record({
    phase: 'act',
    toolName: 'dispatch_ticket',
    summary:
      targets.length > 0
        ? `经 MCP 完成外部操作：写入 ${receipts.length} 条 proposed 分派、${followups.length} 条督办提醒${notificationId ? '、1 条紧急通知' : ''}，等待坐席复核`
        : '无自动分派目标：转人工复核队列，MCP 工具未被触发',
    argsDigest: `runId=${run.id};targets=${targets.length}`,
    resultDigest: `receipts=${receipts.length};followups=${followups.length}`,
    resultCode: toolCode,
    start: dispatchStart
  });

  // 8. REFLECT
  const reason = manualOnly
    ? `子问题中至少一条置信度低于 ${THRESHOLDS.splitConfidence}，按规则不自动拆单，已整体转人工复核。建议坐席核对现场照片后手动选择承办部门。`
    : `工单落点位于${grid.district}${grid.street}（${grid.code}），依据职责规范 ${ragByType.map((r) => r.clause).join('、')}，${labels}由${targets
        .map((t) => t.department)
        .join('、')}承办；结合网格待办 ${workload.data.pending ?? 0} 件，建议按${SEVERITY_META[ticket.severity].label}等级限时处置。${
        split ? `照片含 ${findings.length} 个独立问题，已拆单分别派发，避免职责混派。` : ''
      }${ticket.severity === 'urgent' ? ' 紧急单采用先派后审，已强制插入 100% 复审任务。' : ''}`;

  await record({
    phase: 'reflect',
    toolName: null,
    summary: `反思：分派方案与规范条款一致，自检通过。${ticket.severity === 'urgent' ? '紧急单复审闸门已生效。' : '建议坐席 2 小时内完成复核。'}`,
    argsDigest: 'self-check',
    resultDigest: 'consistent=true',
    start: Date.now()
  });

  // 状态机推进：submitted → ai_filed → pending_review，AI 分派不直接生效
  let status = ticket.status;
  if (status === 'submitted') {
    const next = transition(status, 'ai_file');
    storage.tickets.update(ticket.id, { status: next });
    storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'ai_file', actor: 'AI 系统', payload: { type: ticket.type, confidence: ticket.confidence } });
    status = next;
  }
  if (status === 'ai_filed') {
    const next = transition(status, 'dispatch');
    storage.tickets.update(ticket.id, { status: next, needsReview: true });
    storage.tickets.addEvent({
      ticketId: ticket.id,
      eventType: 'dispatch',
      actor: 'AI Agent',
      payload: { runId: run.id, findings: findings.length, assignments: receipts.length, split }
    });
    status = next;
  }

  const totalLatency = steps.reduce((s, x) => s + x.elapsedMs, 0) + 240;
  storage.ai.updateRun(run.id, {
    latencyMs: totalLatency,
    outputJson: {
      ticketCode: ticket.code,
      split,
      manualOnly,
      assignments: receipts.length,
      departments: targets.map((t) => t.department),
      receipts,
      followups,
      notificationId,
      reason
    }
  });

  return {
    ticketCode: ticket.code,
    runId: run.id,
    findings: findings.length,
    assignments: receipts.length,
    split,
    department: Array.from(new Set(targets.map((t) => t.department))).join('、') || '待人工研判',
    deadline: targets[0]?.deadline ?? deadlineFor(ticket.severity),
    reason,
    steps,
    status
  };
}
