import type {
  Assignment,
  AssignmentState,
  ClassifyResult,
  Feedback,
  FindingDraft,
  GuideItem,
  ProblemType,
  Severity,
  Ticket,
  TicketDetail,
  TicketStatus
} from '@/domain/types';
import { DEPARTMENT_BASE, GRIDS, SEVERITY_META, THRESHOLDS, TYPE_META } from '@/domain/constants';
import { transition } from '@/domain/fsm';
import { runClassify } from '@/ai/chains/classify';
import { runDispatchAgent } from '@/ai/agent/runtime';
import { buildGuide } from '@/ai/rag/retrieve';
import { getStorage } from '@/storage';
import { fmtDateTime, makeTicketCode } from '@/lib/format';

export interface ReportImageInput {
  url: string;
  width: number;
  height: number;
  demoCase?: string;
}

export interface ReportInput {
  userId: string;
  images: ReportImageInput[];
  description: string;
  lng?: number;
  lat?: number;
  address?: string;
  demoCase?: string;
  runId?: string;
  /** 低置信 / 降级时市民自选的类型 */
  selectedType?: ProblemType;
}

export interface ReportResult {
  ticket: Ticket;
  detail: TicketDetail;
  classification: ClassifyResult | null;
  dispatch: { assignments: number; department: string; reason: string; runId: string } | null;
}

function nearestGrid(lng: number, lat: number) {
  return GRIDS.reduce((best, g) => {
    const d = Math.hypot(g.center.lng - lng, g.center.lat - lat);
    const bd = Math.hypot(best.center.lng - lng, best.center.lat - lat);
    return d < bd ? g : best;
  }, GRIDS[0]);
}

const STREET_NAMES = ['青梧路', '云溪大道', '南湖巷', '望江街', '白鹭路', '东屿路'];

function synthesizeAddress(gridIndex: number, n: number): string {
  const g = GRIDS[gridIndex] ?? GRIDS[0];
  return `${g.district}${g.street}${STREET_NAMES[gridIndex] ?? '青梧路'}${80 + (n % 120)}号附近`;
}

export function severityOfType(type: ProblemType, fallback: Severity): Severity {
  return TYPE_META[type].defaultSeverity ?? fallback;
}

export async function submitReport(input: ReportInput): Promise<ReportResult> {
  const storage = getStorage();
  if (!input.images.length) throw new Error('请至少上传 1 张照片');
  if (input.images.length > THRESHOLDS.maxImage) throw new Error(`最多上传 ${THRESHOLDS.maxImage} 张照片`);
  if (input.images.some((i) => i.url.length > 8_000_000)) throw new Error('单张照片体积过大，请压缩后重试');

  let classification: ClassifyResult | null = null;
  if (input.runId) {
    const run = storage.ai.getRun(input.runId);
    if (run && run.outputJson.findings) {
      const json = run.outputJson as unknown as {
        type: ProblemType;
        severity: Severity;
        confidence: number;
        findings: FindingDraft[];
        evidence: ClassifyResult['evidence'];
        quality_flags: ClassifyResult['qualityFlags'];
      };
      classification = {
        type: json.type,
        severity: json.severity,
        confidence: json.confidence,
        evidence: json.evidence ?? [],
        qualityFlags: json.quality_flags ?? [],
        findings: json.findings ?? [],
        candidates: [],
        degraded: run.degraded,
        reason: '',
        model: run.model,
        latencyMs: run.latencyMs,
        runId: run.id
      };
    }
  }
  if (!classification && !input.selectedType) {
    classification = await runClassify({
      imageUrls: input.images.map((i) => i.url),
      demoCase: input.demoCase ?? input.images[0]?.demoCase,
      hint: input.description
    });
  }

  const selected = input.selectedType;
  const primaryType: ProblemType = selected ?? classification?.type ?? 'T07';
  const severity: Severity = selected ? severityOfType(selected, 'medium') : classification?.severity ?? 'medium';
  const confidence = selected ? 0.5 : classification?.confidence ?? 0.5;
  const degraded = selected ? true : Boolean(classification?.degraded);
  const lowConfidence = selected ? true : confidence < THRESHOLDS.confidence;

  const grid = input.lng && input.lat ? nearestGrid(input.lng, input.lat) : GRIDS[Math.floor(Math.random() * GRIDS.length)];
  const lng = input.lng ?? grid.center.lng;
  const lat = input.lat ?? grid.center.lat;
  const address = input.address || synthesizeAddress(GRIDS.indexOf(grid), input.images.length + Date.now() % 100);

  const findings: FindingDraft[] = selected
    ? [
        {
          type: selected,
          severity,
          confidence: 0.5,
          evidence: [],
          desc: `市民自选类型：${TYPE_META[selected].label}（识别降级，待人工复核）`
        }
      ]
    : (classification?.findings ?? []).map((f) => ({
        type: f.type,
        severity: f.severity,
        confidence: f.confidence,
        evidence: f.evidence ?? [],
        desc: f.desc
      }));

  const ticket = storage.tickets.create({
    createdBy: input.userId,
    type: primaryType,
    severity,
    confidence,
    lng: Number(lng.toFixed(7)),
    lat: Number(lat.toFixed(7)),
    address,
    district: grid.district,
    gridCode: grid.code,
    description: input.description,
    status: 'submitted',
    needsReview: lowConfidence || degraded,
    degraded,
    title: `${grid.street} · ${findings.length > 1 ? '多问题工单' : TYPE_META[primaryType].label}`,
    images: input.images.map((i) => ({ url: i.url, width: i.width, height: i.height, exifTime: new Date().toISOString() })),
    findings: findings.length
      ? findings
      : [
          {
            type: primaryType,
            severity,
            confidence,
            evidence: [],
            desc: TYPE_META[primaryType].label
          }
        ]
  });

  if (classification?.runId) storage.ai.updateRunTicket(classification.runId, ticket.id);

  storage.users.addPoints({ userId: input.userId, delta: 5, reason: '上报被采纳', refId: ticket.code });

  if (lowConfidence) {
    const next = transition(ticket.status, 'degrade_to_review');
    storage.tickets.update(ticket.id, { status: next, needsReview: true });
    storage.tickets.addEvent({
      ticketId: ticket.id,
      eventType: 'ai_file',
      actor: 'AI 系统',
      payload: { type: primaryType, confidence, degraded }
    });
    storage.tickets.addEvent({
      ticketId: ticket.id,
      eventType: 'degrade_to_review',
      actor: 'AI 系统',
      payload: { reason: degraded ? '视觉模型不可用，市民自选类型' : `识别置信度 ${confidence} 低于 ${THRESHOLDS.confidence}` }
    });
  }

  let dispatch: ReportResult['dispatch'] = null;
  if (!lowConfidence) {
    const result = await runDispatchAgent(ticket.id, { paceMs: 0, actor: 'AI Agent' });
    dispatch = {
      assignments: result.assignments,
      department: result.department,
      reason: result.reason,
      runId: result.runId
    };
  }

  const detail = await getTicketDetail(ticket.id);
  if (!detail) throw new Error('工单创建失败');
  return { ticket, detail, classification, dispatch };
}

export async function guideFor(type: ProblemType): Promise<GuideItem[]> {
  const hits = await buildGuide(TYPE_META[type].label);
  return hits.map((h) => ({ docTitle: h.docTitle, clause: h.chunk.clause, content: h.chunk.content }));
}

export async function getTicketDetail(idOrCode: string): Promise<TicketDetail | null> {
  const storage = getStorage();
  const ticket = idOrCode.startsWith('CS') ? storage.tickets.getByCode(idOrCode.toUpperCase()) : storage.tickets.getById(idOrCode);
  if (!ticket) return null;
  const runs = storage.ai.runsByTicket(ticket.id);
  const agentSteps = storage.ai.stepsByTicket(ticket.id);
  const guide = await guideFor(ticket.type);
  return {
    ...ticket,
    images: storage.tickets.images(ticket.id),
    findings: storage.tickets.findings(ticket.id),
    assignments: storage.tickets.assignments(ticket.id),
    events: storage.tickets.events(ticket.id),
    runs,
    agentSteps,
    feedback: storage.tickets.feedback(ticket.id),
    guide
  };
}

// ---------------- 管理端聚合 ----------------

export interface AdminRow {
  ticket: Ticket;
  department: string;
  assignmentState: AssignmentState | 'none';
  assignee: string;
  deadline: string | null;
  overdue: boolean;
  findings: number;
}

export function toAdminRow(t: Ticket): AdminRow {
  const storage = getStorage();
  const assignments = storage.tickets.assignments(t.id);
  const active = assignments.find((a) => a.state === 'active') ?? assignments.find((a) => a.state === 'proposed');
  const closed = t.status === 'closed' || t.status === 'rated';
  return {
    ticket: t,
    department: active?.department ?? '—',
    assignmentState: active?.state ?? 'none',
    assignee: active?.assignee ?? '—',
    deadline: active?.deadline ?? null,
    overdue: Boolean(active && !closed && new Date(active.deadline).getTime() < Date.now()),
    findings: storage.tickets.findings(t.id).length
  };
}

export function listAdminTickets(filter: {
  status?: TicketStatus[];
  needsReview?: boolean;
  district?: string;
  gridCode?: string;
  q?: string;
  type?: ProblemType[];
  page?: number;
  pageSize?: number;
}): { rows: AdminRow[]; total: number } {
  const { items, total } = getStorage().tickets.list({ ...filter, sort: 'newest' });
  return { rows: items.map(toAdminRow), total };
}

export function listReviewQueue(page = 1, pageSize = 20): { rows: AdminRow[]; total: number } {
  return listAdminTickets({ status: ['pending_review'], page, pageSize });
}

export interface TimelineItem {
  id: string;
  kind: 'event' | 'run' | 'step';
  at: string;
  title: string;
  detail: string;
  actor: string;
}

export function buildTimeline(ticket: TicketDetail): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of ticket.events) {
    items.push({
      id: e.id,
      kind: 'event',
      at: e.createdAt,
      title:
        e.eventType === 'submit'
          ? '市民提交工单'
          : e.eventType === 'ai_file'
            ? 'AI 识别立案'
            : e.eventType === 'degrade_to_review'
              ? '转人工复核'
              : e.eventType === 'dispatch'
                ? 'AI 生成分派方案'
                : e.eventType === 'confirm'
                  ? '坐席复核确认'
                  : e.eventType === 'reject'
                    ? '坐席驳回'
                    : e.eventType === 'accept'
                      ? '承办部门接单'
                      : e.eventType === 'close'
                        ? '承办部门办结'
                        : e.eventType === 'urge'
                          ? '发送督办催办'
                          : e.eventType === 'reassign'
                            ? '人工改派'
                            : e.eventType === 'rate_satisfied'
                              ? '市民满意评价'
                              : e.eventType === 'rate_unsatisfied'
                                ? '市民不满意，转督办重办'
                                : e.eventType,
      detail: JSON.stringify(e.payload),
      actor: e.actor
    });
  }
  for (const run of ticket.runs) {
    items.push({
      id: run.id,
      kind: 'run',
      at: run.createdAt,
      title: `AI 运行 · ${run.stage}（${run.model}）`,
      detail: `耗时 ${run.latencyMs}ms｜${run.degraded ? '降级' : '正常'}`,
      actor: 'AI 系统'
    });
  }
  for (const s of ticket.agentSteps) {
    items.push({
      id: s.id,
      kind: 'step',
      at: '',
      title: `Agent 步骤 ${s.seq} · ${s.phase}`,
      detail: s.summary,
      actor: 'AI Agent'
    });
  }
  return items.sort((a, b) => (a.at || ticket.createdAt).localeCompare(b.at || ticket.createdAt));
}

// ---------------- 状态操作 ----------------

export interface ConfirmChanges {
  assignmentId: string;
  department?: string;
  assignee?: string;
  deadline?: string;
}

export function confirmReview(ticketId: string, reviewer: string, changes: ConfirmChanges[] = []): TicketDetail {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (ticket.status !== 'pending_review') throw new Error('仅待复核工单可确认');
  const assignments = storage.tickets.assignments(ticket.id).filter((a) => a.state === 'proposed');
  if (assignments.length) {
    for (const a of assignments) {
      const change = changes.find((c) => c.assignmentId === a.id);
      const patch: Partial<Assignment> = { state: 'active', confirmedAt: new Date().toISOString() };
      if (change?.department) patch.department = change.department;
      if (change?.assignee) patch.assignee = change.assignee;
      if (change?.deadline) patch.deadline = change.deadline;
      storage.tickets.updateAssignment(a.id, patch);
    }
  }
  storage.tickets.update(ticket.id, { status: transition(ticket.status, 'confirm'), needsReview: false });
  const runs = storage.ai.runsByTicket(ticket.id).filter((r) => r.stage === 'dispatch');
  if (runs.length) storage.ai.updateRun(runs[runs.length - 1].id, { humanAction: 'confirm' });
  storage.tickets.addEvent({
    ticketId: ticket.id,
    eventType: 'confirm',
    actor: reviewer,
    payload: { assignments: assignments.length, changes: changes.length }
  });
  const detail = storage.tickets.getById(ticket.id);
  if (!detail) throw new Error('工单不存在');
  return {
    ...detail,
    images: storage.tickets.images(detail.id),
    findings: storage.tickets.findings(detail.id),
    assignments: storage.tickets.assignments(detail.id),
    events: storage.tickets.events(detail.id),
    runs: storage.ai.runsByTicket(detail.id),
    agentSteps: storage.ai.stepsByTicket(detail.id),
    feedback: storage.tickets.feedback(detail.id),
    guide: []
  };
}

export function rejectReview(ticketId: string, reviewer: string, reason: string): void {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (ticket.status !== 'pending_review') throw new Error('仅待复核工单可驳回');
  storage.tickets.assignments(ticket.id).forEach((a) => {
    if (a.state === 'proposed') storage.tickets.updateAssignment(a.id, { state: 'superseded' });
  });
  storage.tickets.update(ticket.id, { status: transition(ticket.status, 'reject'), needsReview: false });
  const runs = storage.ai.runsByTicket(ticket.id).filter((r) => r.stage === 'dispatch');
  if (runs.length) storage.ai.updateRun(runs[runs.length - 1].id, { humanAction: 'reject' });
  storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'reject', actor: reviewer, payload: { reason } });
}

export function reassign(ticketId: string, operator: string, toDepartment: string, note: string): void {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (!['assigned', 'processing', 'pending_review'].includes(ticket.status)) throw new Error('当前状态不支持改派');
  const current = storage.tickets.assignments(ticket.id).find((a) => a.state === 'active' || a.state === 'proposed');
  if (current) storage.tickets.updateAssignment(current.id, { state: 'superseded' });
  const findings = storage.tickets.findings(ticket.id);
  storage.tickets.addAssignment({
    ticketId: ticket.id,
    findingId: findings[0]?.id ?? '',
    grid: ticket.gridCode,
    department: toDepartment,
    assignee: '待接单',
    deadline: new Date(Date.now() + SEVERITY_META[ticket.severity].slaHours * 3600000).toISOString(),
    source: 'manual',
    state: 'active',
    reason: note || '坐席人工改派'
  });
  if (ticket.status === 'pending_review') {
    storage.tickets.update(ticket.id, { status: transition(ticket.status, 'confirm'), needsReview: false });
  }
  const runs = storage.ai.runsByTicket(ticket.id).filter((r) => r.stage === 'dispatch');
  if (runs.length) storage.ai.updateRun(runs[runs.length - 1].id, { humanAction: 'reassign' });
  storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'reassign', actor: operator, payload: { to: toDepartment, note } });
}

export function closeTicket(ticketId: string, operator: string, note: string): void {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (!['assigned', 'processing'].includes(ticket.status)) throw new Error('当前状态不可办结');
  storage.tickets.update(ticket.id, {
    status: transition(ticket.status, 'close'),
    closedAt: new Date().toISOString()
  });
  storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'close', actor: operator, payload: { note } });
}

export function rateTicket(
  ticketId: string,
  userId: string,
  rating: 'satisfied' | 'unsatisfied',
  tags: string[],
  comment: string
): Feedback {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  if (ticket.createdBy !== userId) throw new Error('只能评价本人上报的工单');
  if (!['closed', 'rated'].includes(ticket.status)) throw new Error('工单尚未办结，暂不能评价');
  const feedback = storage.tickets.addFeedback({ ticketId: ticket.id, rating, tags, comment });
  if (rating === 'satisfied') {
    storage.tickets.update(ticket.id, { status: transition(ticket.status, 'rate_satisfied') });
    storage.users.addPoints({ userId, delta: 10, reason: '办结好评奖励', refId: ticket.code });
    storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'rate_satisfied', actor: '市民', payload: { tags } });
  } else {
    storage.tickets.update(ticket.id, { status: transition(ticket.status, 'rate_unsatisfied'), needsReview: true });
    storage.tickets.addEvent({ ticketId: ticket.id, eventType: 'rate_unsatisfied', actor: '市民', payload: { tags, comment } });
    storage.tickets.assignments(ticket.id).forEach((a) => {
      if (a.state === 'active') storage.tickets.updateAssignment(a.id, { state: 'superseded' });
    });
  }
  return feedback;
}

export function urgeTicket(ticketId: string, operator: string, text: string, runId: string): void {
  const storage = getStorage();
  const ticket = storage.tickets.getById(ticketId);
  if (!ticket) throw new Error('工单不存在');
  const assignment = storage.tickets.assignments(ticket.id).find((a) => a.state === 'active');
  storage.tickets.addEvent({
    ticketId: ticket.id,
    eventType: 'urge',
    actor: operator,
    payload: { department: assignment?.department, runId, text: text.slice(0, 80) }
  });
}

export function ticketCreatedLabel(t: Ticket): string {
  return `${fmtDateTime(t.createdAt)} · 编号 ${makeTicketCode(Number(t.code.slice(-4)), new Date(t.createdAt))}`;
}
