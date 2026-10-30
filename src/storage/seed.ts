import type {
  AgentStep,
  AiRun,
  Assignment,
  Feedback,
  KnowledgeChunk,
  KnowledgeDoc,
  PointsLedger,
  ProblemType,
  Severity,
  Ticket,
  TicketEvent,
  TicketFinding,
  TicketImage,
  TicketStatus,
  User
} from '@/domain/types';
import {
  DEPARTMENT_BASE,
  GRIDS,
  PROBLEM_TYPES,
  SEVERITY_META,
  TYPE_META
} from '@/domain/constants';
import { makeTicketCode } from '@/lib/format';
import { hash32 } from '@/lib/utils';
import { buildKnowledge } from '@/ai/rag/knowledge';
import { hashedEmbedding } from '@/ai/providers/embedding';

export interface Database {
  users: User[];
  tickets: Ticket[];
  images: TicketImage[];
  findings: TicketFinding[];
  assignments: Assignment[];
  aiRuns: AiRun[];
  agentSteps: AgentStep[];
  events: TicketEvent[];
  feedbacks: Feedback[];
  points: PointsLedger[];
  docs: KnowledgeDoc[];
  chunks: KnowledgeChunk[];
  counters: { ticket: number; entity: number };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITIZEN_NAMES = ['林晓', '沈知远', '许沐', '顾南舟', '叶青禾', '唐可', '苏晚', '周予安'];
const STAFF_NAMES = ['周敏', '陆骁', '方岚', '程野'];
const DESCRIPTIONS: Record<ProblemType, string[]> = {
  T01: [
    '青梧路人行道上的井盖裂了一个大口子，边上还翘起来了，晚上路过很危险。',
    '这个井盖中间塌下去了，骑车经过差点摔倒，请尽快处理。',
    '井盖整个不见了，只留一个黑洞，旁边没有任何围挡。'
  ],
  T02: [
    '一辆白色轿车停在消防通道上，把出入口堵死了，按喇叭也没人挪。',
    '沿街商铺把车停在人行道上，婴儿车根本过不去。',
    '非机动车道被机动车占满，骑车只能走机动车道。'
  ],
  T03: [
    '小区门口的垃圾桶旁边堆了很多装修垃圾，已经放了三四天没人清。',
    '绿化带里全是生活垃圾，味道很大，夏天招虫子。',
    '建筑垃圾堆在路口，占了半个车道，影响通行。'
  ],
  T04: [
    '青梧路这一排路灯都不亮，晚上整条路黑漆漆的。',
    '这盏路灯一闪一闪的，看着像要掉下来。',
    '灯杆底部线缆裸露，下雨天有漏电风险。'
  ],
  T05: [
    '一下雨这里就积水，今天最深的地方到小腿了，车都不敢过。',
    '排水口被树叶堵住了，积水一直退不下去。',
    '路口积水倒灌进店面，希望尽快来疏通。'
  ],
  T06: [
    '这块广告牌被风吹歪了，上面还有电线，怕掉下来砸到人。',
    '广告牌支架锈得很厉害，摇摇欲坠。',
    '广告牌遮住了路口视线，拐弯时看不到行人。'
  ],
  T07: [
    '路边护栏倒了一段，一直没人修。',
    '这里施工围挡歪倒，占道而且没有警示。',
    '公共座椅损坏严重，希望检修。'
  ]
};

const EVIDENCE: Record<ProblemType, { x: number; y: number; w: number; h: number; label: string }> = {
  T01: { x: 0.28, y: 0.56, w: 0.3, h: 0.24, label: '井盖破损' },
  T02: { x: 0.5, y: 0.34, w: 0.34, h: 0.4, label: '违停车辆' },
  T03: { x: 0.18, y: 0.44, w: 0.46, h: 0.36, label: '垃圾堆积' },
  T04: { x: 0.4, y: 0.14, w: 0.22, h: 0.54, label: '路灯故障' },
  T05: { x: 0.12, y: 0.58, w: 0.64, h: 0.28, label: '路面积水' },
  T06: { x: 0.26, y: 0.1, w: 0.44, h: 0.36, label: '广告牌松动' },
  T07: { x: 0.3, y: 0.3, w: 0.4, h: 0.4, label: '设施损坏' }
};

const IMAGE_SIZE = { width: 1280, height: 960 };

function phoneHash(phone: string): string {
  return `ph_${hash32(phone).toString(16)}`;
}

export function seedDatabase(): Database {
  const rnd = mulberry32(20261118);
  const now = new Date();
  const db: Database = {
    users: [],
    tickets: [],
    images: [],
    findings: [],
    assignments: [],
    aiRuns: [],
    agentSteps: [],
    events: [],
    feedbacks: [],
    points: [],
    docs: [],
    chunks: [],
    counters: { ticket: 0, entity: 0 }
  };

  const nextId = (prefix: string): string => {
    db.counters.entity += 1;
    return `${prefix}-${db.counters.entity.toString(36).padStart(4, '0')}`;
  };

  // ---------- users ----------
  const demos: { id: string; role: User['role']; name: string; phone: string; points: number }[] = [
    { id: 'u-cit-001', role: 'citizen', name: '林晓', phone: '13800000000', points: 385 },
    { id: 'u-staff-001', role: 'staff', name: '周敏', phone: '13900000000', points: 0 },
    { id: 'u-cmd-001', role: 'command', name: '陈默', phone: '13700000000', points: 0 }
  ];
  for (const d of demos) {
    db.users.push({
      id: d.id,
      role: d.role,
      name: d.name,
      phoneHash: phoneHash(d.phone),
      phoneTail: d.phone.slice(-4),
      points: d.points,
      createdAt: new Date(now.getTime() - 365 * 24 * 3600000).toISOString()
    });
  }
  for (let i = 1; i < CITIZEN_NAMES.length; i += 1) {
    db.users.push({
      id: `u-cit-${String(i + 1).padStart(3, '0')}`,
      role: 'citizen',
      name: CITIZEN_NAMES[i],
      phoneHash: phoneHash(`1380000000${i}`),
      phoneTail: `000${i}`,
      points: 60 + Math.floor(rnd() * 260),
      createdAt: new Date(now.getTime() - (120 + i * 10) * 24 * 3600000).toISOString()
    });
  }

  // ---------- knowledge ----------
  const knowledge = buildKnowledge();
  db.docs = knowledge.docs;
  db.chunks = knowledge.chunks.map((c) => ({
    ...c,
    embedding: hashedEmbedding(`${c.content} ${c.keywords.join(' ')}`)
  }));

  // ---------- helpers ----------
  const statusWeights: TicketStatus[] = [
    'rated', 'rated', 'rated', 'closed', 'closed', 'reopened', 'processing',
    'processing', 'assigned', 'assigned', 'pending_review', 'pending_review',
    'pending_review', 'ai_filed', 'submitted'
  ];

  const randomType = (): ProblemType => {
    const weights: [ProblemType, number][] = [
      ['T01', 0.2], ['T02', 0.22], ['T03', 0.2], ['T04', 0.12], ['T05', 0.09], ['T06', 0.1], ['T07', 0.07]
    ];
    let r = rnd();
    for (const [t, w] of weights) {
      if (r < w) return t;
      r -= w;
    }
    return 'T07';
  };

  const severityOf = (type: ProblemType): Severity => {
    const base = TYPE_META[type].defaultSeverity;
    if (base === 'medium' && rnd() < 0.3) return 'urgent';
    if (base === 'low' && rnd() < 0.15) return 'medium';
    return base;
  };

  const addEvent = (ticketId: string, eventType: string, actor: string, at: string, payload: Record<string, unknown> = {}) => {
    db.events.push({ id: nextId('evt'), ticketId, eventType, actor, payload, createdAt: at });
  };

  const addImages = (ticketId: string, type: ProblemType, createdAt: string, dual = false) => {
    const url = dual ? '/images/dual.jpg' : TYPE_META[type].sampleImage;
    db.images.push({
      id: nextId('img'),
      ticketId,
      url,
      width: IMAGE_SIZE.width,
      height: IMAGE_SIZE.height,
      exifTime: createdAt,
      sort: 0
    });
    if (!dual) {
      db.images.push({
        id: nextId('img'),
        ticketId,
        url: '/images/street.jpg',
        width: IMAGE_SIZE.width,
        height: IMAGE_SIZE.height,
        exifTime: createdAt,
        sort: 1
      });
    }
  };

  const buildSteps = (runId: string, ticket: Ticket, dual: boolean) => {
    const grid = GRIDS.find((g) => g.code === ticket.gridCode) ?? GRIDS[0];
    const primaryDept = `${ticket.district}${DEPARTMENT_BASE[ticket.type]}`;
    const secondary = dual ? `${ticket.district}${DEPARTMENT_BASE['T02']}` : null;
    const steps: { phase: AgentStep['phase']; tool: string | null; summary: string; code: AgentStep['resultCode']; args: string; result: string }[] = [
      {
        phase: 'plan',
        tool: null,
        summary: dual
          ? '载入工单：检测到 1 张照片含 2 条子问题，规划拆单并分别派发'
          : '载入工单：单条子问题，规划常规分派路径',
        code: 'ok',
        args: `ticket=${ticket.code}`,
        result: dual ? 'findings=2，进入拆单分支' : 'findings=1，进入常规分支'
      },
      {
        phase: 'act',
        tool: 'match_grid',
        summary: `调用 [辖区匹配]：(${ticket.lng.toFixed(3)}, ${ticket.lat.toFixed(3)}) → ${grid.district} / ${grid.street} / ${grid.code}`,
        code: 'ok',
        args: `lng=${ticket.lng.toFixed(4)}&lat=${ticket.lat.toFixed(4)}`,
        result: `grid=${grid.code}`
      },
      {
        phase: 'observe',
        tool: null,
        summary: `观察：落点唯一命中 ${grid.street}网格，边界无争议`,
        code: 'ok',
        args: `grid=${grid.code}`,
        result: 'unique=true'
      },
      {
        phase: 'act',
        tool: 'lookup_responsibility',
        summary: `调用 [职责检索·RAG]：${TYPE_META[ticket.type].label} → ${primaryDept}`,
        code: 'ok',
        args: `type=${ticket.type}`,
        result: `dept=${primaryDept}; clause=1.1`
      },
      {
        phase: 'act',
        tool: 'query_workload',
        summary: `经 MCP 调用 [坐席负载]：${grid.code} 当前待办 ${3 + (hash32(ticket.code) % 6)} 件`,
        code: 'ok',
        args: `grid=${grid.code}`,
        result: 'ok'
      },
      {
        phase: 'decide',
        tool: null,
        summary: dual
          ? `决策：拆分为 2 条分派方案，${TYPE_META.T01.short}→${primaryDept}，${TYPE_META.T02.short}→${secondary}`
          : `决策：${TYPE_META[ticket.type].label}→${primaryDept}，时限 ${SEVERITY_META[ticket.severity].slaHours} 小时`,
        code: 'ok',
        args: 'assignments=planned',
        result: dual ? 'assignments=2' : 'assignments=1'
      },
      {
        phase: 'act',
        tool: 'dispatch_ticket',
        summary: `经 MCP 调用 [派单工具]：写入 ${dual ? 2 : 1} 条 proposed 分派，等待坐席确认`,
        code: 'ok',
        args: `runId=${runId};seq=7`,
        result: 'receipt=MCP-D-OK'
      },
      {
        phase: 'reflect',
        tool: null,
        summary: `反思：分派方案与《职责划分规范》一致；${ticket.severity === 'urgent' ? '紧急单已插入 100% 复审队列' : '建议坐席 2 小时内完成复核'}`,
        code: 'ok',
        args: 'self-check',
        result: 'consistent=true'
      }
    ];
    steps.forEach((s, i) => {
      db.agentSteps.push({
        id: nextId('step'),
        runId,
        seq: i + 1,
        phase: s.phase,
        toolName: s.tool,
        argsDigest: s.args,
        resultCode: s.code,
        resultDigest: s.result,
        summary: s.summary,
        elapsedMs: 24 + ((hash32(runId + i) % 90) as number)
      });
    });
  };

  const createRecord = (opts: {
    createdBy: string;
    type: ProblemType;
    status: TicketStatus;
    createdAt: string;
    dual?: boolean;
    description?: string;
    needsReview?: boolean;
  }) => {
    const type = opts.type;
    const severity = severityOf(type);
    const confidence = opts.needsReview ? 0.62 + rnd() * 0.1 : 0.82 + rnd() * 0.16;
    const grid = GRIDS[Math.floor(rnd() * GRIDS.length)];
    const lng = grid.center.lng + (rnd() - 0.5) * 0.008;
    const lat = grid.center.lat + (rnd() - 0.5) * 0.006;
    const seq = db.counters.ticket + 1;
    db.counters.ticket = seq;
    const code = makeTicketCode(seq, new Date(opts.createdAt));
    const description = opts.description ?? DESCRIPTIONS[type][Math.floor(rnd() * DESCRIPTIONS[type].length)];
    const ticket: Ticket = {
      id: nextId('tk'),
      code,
      createdBy: opts.createdBy,
      type,
      severity,
      confidence: Number(confidence.toFixed(2)),
      lng: Number(lng.toFixed(7)),
      lat: Number(lat.toFixed(7)),
      address: `${grid.district}${grid.street}${['青梧路', '云溪大道', '南湖巷', '望江街', '白鹭路', '东屿路'][GRIDS.indexOf(grid)]}${80 + Math.floor(rnd() * 120)}号附近`,
      district: grid.district,
      gridCode: grid.code,
      description,
      status: opts.status,
      needsReview: opts.needsReview ?? confidence < 0.75,
      degraded: false,
      title: `${grid.street} · ${TYPE_META[opts.dual ? 'T01' : type].label}`,
      createdAt: opts.createdAt,
      updatedAt: opts.createdAt
    };
    db.tickets.push(ticket);
    addImages(ticket.id, type, opts.createdAt, opts.dual);

    // findings
    const findingDrafts = opts.dual
      ? [
          { type: 'T01' as ProblemType, severity: 'urgent' as Severity, confidence: 0.92, evidence: [{ ...EVIDENCE.T01, confidence: 0.92 }], desc: '画面左侧井盖破损，井圈翘起' },
          { type: 'T02' as ProblemType, severity: 'medium' as Severity, confidence: 0.88, evidence: [{ ...EVIDENCE.T02, confidence: 0.88 }], desc: '画面右侧白色车辆占用消防通道' }
        ]
      : [
          {
            type,
            severity,
            confidence: ticket.confidence,
            evidence: [{ ...EVIDENCE[type], confidence: ticket.confidence }],
            desc: description.slice(0, 40)
          }
        ];
    const findingIds: string[] = [];
    for (const f of findingDrafts) {
      const fId = nextId('fd');
      findingIds.push(fId);
      db.findings.push({ id: fId, ticketId: ticket.id, status: 'open', ...f });
    }

    // classify run
    const clsRun: AiRun = {
      id: nextId('run'),
      ticketId: ticket.id,
      stage: 'classify',
      model: 'qwen-vl-max',
      modelVersion: '2026.09',
      promptDigest: `sha256:${hash32(ticket.id + 'prompt').toString(16)}`,
      inputDigest: `img:${opts.dual ? 'dual' : type}`,
      outputJson: {
        type: opts.dual ? 'T01' : type,
        severity,
        confidence: ticket.confidence,
        findings: findingDrafts.length,
        evidence: findingDrafts[0]?.evidence,
        dual: Boolean(opts.dual)
      },
      tokensIn: 812,
      tokensOut: 148,
      latencyMs: 1420 + (hash32(ticket.code) % 600),
      fallbackUsed: false,
      degraded: false,
      humanAction: 'none',
      createdAt: opts.createdAt
    };
    db.aiRuns.push(clsRun);

    // timeline
    const t0 = new Date(opts.createdAt).getTime();
    const minutes = (m: number) => new Date(t0 + m * 60000).toISOString();
    addEvent(ticket.id, 'submit', '市民', opts.createdAt, { code });
    const flow: TicketStatus[] = ['ai_filed', 'pending_review', 'assigned', 'processing', 'closed', 'rated'];

    if (opts.status === 'submitted') {
      ticket.updatedAt = opts.createdAt;
      return ticket;
    }

    const statusIndex = (s: TicketStatus): number => {
      if (s === 'reopened') return 4;
      const i = flow.indexOf(s);
      return i < 0 ? 0 : i;
    };
    const reached = statusIndex(opts.status);
    addEvent(ticket.id, 'ai_file', 'AI 系统', minutes(1), { type, confidence: ticket.confidence });
    if (reached >= 1) {
      const dispatchRunId = nextId('run');
      buildSteps(dispatchRunId, ticket, Boolean(opts.dual));
      db.aiRuns.push({
        id: dispatchRunId,
        ticketId: ticket.id,
        stage: 'dispatch',
        model: 'deepseek-chat',
        modelVersion: 'v3.2',
        promptDigest: `sha256:${hash32(ticket.id + 'dispatch').toString(16)}`,
        inputDigest: `ticket=${code}`,
        outputJson: {
          split: Boolean(opts.dual),
          assignments: findingIds.length,
          department: `${ticket.district}${DEPARTMENT_BASE[type]}`,
          reason: '依据职责划分规范与网格负载，常规分派',
          status: opts.status
        },
        tokensIn: 640,
        tokensOut: 220,
        latencyMs: 980 + (hash32(code) % 500),
        fallbackUsed: false,
        degraded: false,
        humanAction: reached >= 2 ? 'confirm' : 'none',
        createdAt: minutes(1)
      });
    }
    addEvent(ticket.id, 'dispatch', 'AI Agent', minutes(2), { run: 'dispatch', findings: findingIds.length });

    // assignments
    if (reached >= 1) {
      const perFinding = opts.dual ? findingIds : [findingIds[0]];
      for (const fId of perFinding) {
        const fType = opts.dual && db.findings.find((f) => f.id === fId)?.type === 'T02' ? 'T02' : type;
        const state: Assignment['state'] = reached >= 2 ? 'active' : 'proposed';
        db.assignments.push({
          id: nextId('asg'),
          ticketId: ticket.id,
          findingId: fId,
          grid: grid.code,
          department: `${grid.district}${DEPARTMENT_BASE[fType]}`,
          assignee: STAFF_NAMES[Math.floor(rnd() * STAFF_NAMES.length)],
          deadline: new Date(t0 + SEVERITY_META[fType === 'T02' ? 'medium' : severity].slaHours * 3600000).toISOString(),
          source: 'agent',
          state,
          reason: 'AI 依据职责规范与网格负载生成的分派建议',
          createdAt: minutes(2),
          confirmedAt: reached >= 2 ? minutes(9) : undefined,
          receiptNo: `MCP-D-${String(hash32(code) % 99999).padStart(5, '0')}`,
          followupId: reached >= 2 ? `MCP-F-${String(hash32(code + 'f') % 99999).padStart(5, '0')}` : undefined
        });
      }
      if (reached >= 2) addEvent(ticket.id, 'confirm', '坐席 周敏', minutes(9), { action: 'confirm' });
      if (reached >= 3) addEvent(ticket.id, 'accept', '承办方', minutes(120), {});
      if (reached >= 4) addEvent(ticket.id, 'close', '承办方', minutes(60 * 20 + (hash32(code) % 600)), {});
      if (reached >= 5) {
        const satisfied = rnd() > 0.16;
        db.feedbacks.push({
          id: nextId('fb'),
          ticketId: ticket.id,
          rating: satisfied ? 'satisfied' : 'unsatisfied',
          tags: satisfied ? ['响应及时', '处置到位'] : ['处置不彻底', '希望复查'],
          comment: satisfied ? '处理得很快，井盖已经换新了，谢谢。' : '表面处理了一下，但问题还在，希望重新处理。',
          createdAt: minutes(60 * 26)
        });
        ticket.status = satisfied ? 'rated' : 'reopened';
        if (!satisfied) addEvent(ticket.id, 'rate_unsatisfied', '市民', minutes(60 * 26), { reopen: true });
      }
      if (reached >= 5) ticket.closedAt = minutes(60 * 20);
    }

    if (opts.status === 'processing' || opts.status === 'assigned') ticket.closedAt = undefined;
    ticket.updatedAt = minutes(60 * 27);
    return ticket;
  };

  // ---------- 200 条历史工单 ----------
  for (let i = 0; i < 200; i += 1) {
    const daysAgo = Math.floor(rnd() * 30);
    const hour = 7 + Math.floor(rnd() * 15);
    const at = new Date(now);
    at.setDate(at.getDate() - daysAgo);
    at.setHours(hour, Math.floor(rnd() * 60), 0, 0);
    const type = randomType();
    const status = daysAgo === 0 ? (['submitted', 'ai_filed', 'pending_review', 'assigned'] as TicketStatus[])[Math.floor(rnd() * 4)] : statusWeights[Math.floor(rnd() * statusWeights.length)];
    const dual = rnd() < 0.04;
    const createdBy = rnd() < 0.05 ? 'u-cit-001' : db.users.filter((u) => u.role === 'citizen')[Math.floor(rnd() * 8)]?.id ?? 'u-cit-001';
    createRecord({ createdBy, type, status, createdAt: at.toISOString(), dual: dual && (status === 'pending_review' || status === 'submitted') });
  }

  // ---------- 演示账号的专属工单（覆盖完整闭环） ----------
  const demoAt = (hoursAgo: number): string => new Date(now.getTime() - hoursAgo * 3600000).toISOString();
  createRecord({
    createdBy: 'u-cit-001',
    type: 'T01',
    status: 'pending_review',
    createdAt: demoAt(3),
    dual: true,
    needsReview: false,
    description: '这张照片里有两个问题：左边井盖破了，右边这辆车停在消防通道上。'
  });
  createRecord({ createdBy: 'u-cit-001', type: 'T03', status: 'processing', createdAt: demoAt(28) });
  createRecord({ createdBy: 'u-cit-001', type: 'T04', status: 'closed', createdAt: demoAt(76) });
  createRecord({ createdBy: 'u-cit-001', type: 'T02', status: 'rated', createdAt: demoAt(120) });
  createRecord({ createdBy: 'u-cit-001', type: 'T05', status: 'reopened', createdAt: demoAt(168) });
  createRecord({ createdBy: 'u-cit-001', type: 'T06', status: 'assigned', createdAt: demoAt(20) });

  // ---------- 积分流水 ----------
  const ledgerSeeds: { delta: number; reason: string; days: number }[] = [
    { delta: 10, reason: '办结好评奖励', days: 2 },
    { delta: 5, reason: '上报被采纳', days: 3 },
    { delta: 5, reason: '上报被采纳', days: 5 },
    { delta: 10, reason: '办结好评奖励', days: 8 },
    { delta: 5, reason: '上报被采纳', days: 12 },
    { delta: 10, reason: '办结好评奖励', days: 18 },
    { delta: 5, reason: '上报被采纳', days: 26 }
  ];
  ledgerSeeds.forEach((l, i) => {
    db.points.push({
      id: nextId('pt'),
      userId: 'u-cit-001',
      delta: l.delta,
      reason: l.reason,
      refId: db.tickets[i]?.code ?? 'CS-DEMO',
      createdAt: new Date(now.getTime() - l.days * 24 * 3600000).toISOString()
    });
  });

  // 让汇总满足演示口径：历史平均响应时长 3.7 天 → 小时级
  db.tickets.forEach((t) => {
    if (t.status === 'closed' || t.status === 'rated' || t.status === 'reopened') {
      const closedAt = t.closedAt ? new Date(t.closedAt).getTime() : new Date(t.createdAt).getTime() + 6 * 3600000;
      const updated = new Date(t.createdAt).getTime() + 2.5 * 3600000 + (hash32(t.code) % 9) * 1800000;
      if (updated > closedAt) t.closedAt = new Date(updated).toISOString();
    }
  });

  return db;
}
