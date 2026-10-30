// ============================================================
// 领域模型 · 12 张表的类型定义（与《系统设计说明书》5.2 节对齐）
// 字段采用 camelCase，数据库实现时下划线映射；时间统一 ISO 8601 字符串
// ============================================================

export type Role = 'citizen' | 'staff' | 'command';

export type ProblemType = 'T01' | 'T02' | 'T03' | 'T04' | 'T05' | 'T06' | 'T07';

export type Severity = 'low' | 'medium' | 'urgent';

export type TicketStatus =
  | 'submitted'
  | 'ai_filed'
  | 'pending_review'
  | 'assigned'
  | 'processing'
  | 'closed'
  | 'rated'
  | 'reopened';

export type FindingStatus = 'open' | 'assigned' | 'processing' | 'closed';

export type AssignmentState = 'proposed' | 'active' | 'superseded';

export type AssignmentSource = 'agent' | 'manual';

export type AiStage = 'classify' | 'locate' | 'describe' | 'dispatch' | 'guide' | 'chat' | 'urge';

export type HumanAction = 'confirm' | 'reassign' | 'reject' | 'none';

export type AgentPhase = 'plan' | 'act' | 'observe' | 'decide' | 'reflect';

export type ToolResultCode = 'ok' | 'timeout' | 'invalid' | 'downstream_error';

export type QualityFlag = 'blur' | 'backlight' | 'no_subject' | 'occluded';

/** 证据框：归一化坐标（0–1），前端按图片内容区换算，保证缩放不偏移 */
export interface EvidenceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  confidence?: number;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  phoneHash: string;
  phoneTail: string;
  points: number;
  createdAt: string;
}

// ---------- ★users / ★tickets / ★ticket_images ----------

export interface TicketImage {
  id: string;
  ticketId: string;
  url: string;
  width: number;
  height: number;
  exifTime?: string;
  sort: number;
}

export interface Ticket {
  id: string;
  code: string;
  createdBy: string;
  type: ProblemType;
  severity: Severity;
  confidence: number;
  lng: number;
  lat: number;
  address: string;
  district: string;
  gridCode: string;
  description: string;
  status: TicketStatus;
  needsReview: boolean;
  degraded: boolean;
  title: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

// ---------- ★ticket_findings ----------

export interface FindingDraft {
  type: ProblemType;
  severity: Severity;
  confidence: number;
  evidence: EvidenceBox[];
  desc: string;
}

export interface TicketFinding extends FindingDraft {
  id: string;
  ticketId: string;
  status: FindingStatus;
}

// ---------- ★assignments ----------

export interface Assignment {
  id: string;
  ticketId: string;
  findingId: string;
  grid: string;
  department: string;
  assignee: string;
  deadline: string;
  source: AssignmentSource;
  state: AssignmentState;
  reason: string;
  createdAt: string;
  confirmedAt?: string;
  receiptNo?: string;
  followupId?: string;
}

// ---------- ★ai_runs / ★agent_steps ----------

export interface AiRun {
  id: string;
  ticketId: string | null;
  stage: AiStage;
  model: string;
  modelVersion: string;
  promptDigest: string;
  inputDigest: string;
  outputJson: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  fallbackUsed: boolean;
  degraded: boolean;
  humanAction: HumanAction;
  createdAt: string;
}

export interface AgentStep {
  id: string;
  runId: string;
  seq: number;
  phase: AgentPhase;
  toolName: string | null;
  argsDigest: string;
  resultCode: ToolResultCode;
  resultDigest: string;
  summary: string;
  elapsedMs: number;
}

// ---------- ★ticket_events ----------

export interface TicketEvent {
  id: string;
  ticketId: string;
  eventType: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

// ---------- feedback / points_ledger ----------

export interface Feedback {
  id: string;
  ticketId: string;
  rating: 'satisfied' | 'unsatisfied';
  tags: string[];
  comment: string;
  createdAt: string;
}

export interface PointsLedger {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  refId: string;
  createdAt: string;
}

// ---------- ★knowledge_docs / ★knowledge_chunks ----------

export type KnowledgeDocType = 'responsibility' | 'timelimit' | 'technical';

export interface KnowledgeDoc {
  id: string;
  title: string;
  docType: KnowledgeDocType;
  effectiveDate: string;
  status: 'active' | 'inactive';
  summary: string;
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  docId: string;
  chapter: string;
  clause: string;
  content: string;
  keywords: string[];
  embedding: number[];
  status: 'active' | 'inactive';
  effectiveDate: string;
}

// ---------- AI 输出契约 ----------

export interface ClassifyCandidate {
  type: ProblemType;
  label: string;
  score: number;
}

export interface ClassifyResult {
  type: ProblemType;
  severity: Severity;
  confidence: number;
  evidence: EvidenceBox[];
  qualityFlags: QualityFlag[];
  findings: FindingDraft[];
  candidates: ClassifyCandidate[];
  degraded: boolean;
  reason: string;
  model: string;
  latencyMs: number;
  runId?: string;
}

export interface LocateHint {
  text: string;
  type: 'road_sign' | 'door_plate' | 'landmark';
  lng: number;
  lat: number;
  confidence: number;
}

// ---------- API 聚合类型 ----------

export interface TicketDetail extends Ticket {
  images: TicketImage[];
  findings: TicketFinding[];
  assignments: Assignment[];
  events: TicketEvent[];
  runs: AiRun[];
  agentSteps: AgentStep[];
  feedback: Feedback | null;
  guide: GuideItem[];
}

export interface GuideItem {
  docTitle: string;
  clause: string;
  content: string;
}

export interface ChatCitation {
  docTitle: string;
  clause: string;
  snippet: string;
  score: number;
}

export interface ChatTicketCard {
  code: string;
  title: string;
  status: TicketStatus;
  type: ProblemType;
  createdAt: string;
}

export interface ChatResult {
  intent: 'progress' | 'area' | 'policy' | 'clarify' | 'fallback';
  answer: string;
  citations: ChatCitation[];
  tickets: ChatTicketCard[];
  grounded: boolean;
  fallback: boolean;
  runId?: string;
}

export interface DispatchSummary {
  ticketCode: string;
  runId: string;
  findings: number;
  assignments: number;
  split: boolean;
  department: string;
  deadline: string;
  reason: string;
  steps: AgentStep[];
  status: TicketStatus;
}

export interface AdminTicketRow extends Ticket {
  primaryDepartment: string;
  assignmentState: AssignmentState | 'none';
  assignee: string;
  deadline: string | null;
  overdue: boolean;
  findingsCount: number;
}

export interface StatsOverview {
  totalTickets: number;
  todayReports: number;
  aiAutoFileRate: number;
  avgResponseHours: number;
  completionRate: number;
  satisfactionRate: number;
  adoption: { numerator: number; denominator: number; rate: number };
  typeDistribution: { type: ProblemType; label: string; count: number }[];
  districtRanking: { district: string; count: number; avgResponseHours: number }[];
  trend: { date: string; reports: number; closed: number }[];
  pendingReview: number;
  overdue: number;
}

export interface OverdueRow {
  code: string;
  title: string;
  department: string;
  assignee: string;
  deadline: string;
  overdueHours: number;
  severity: Severity;
  status: TicketStatus;
}

export interface ScreenSummary {
  metrics: {
    todayReports: number;
    autoFileRate: number;
    avgResponseHours: number;
    completionRate: number;
  };
  heatPoints: { lng: number; lat: number; weight: number; type: ProblemType; severity: Severity }[];
  typeDistribution: { type: ProblemType; label: string; count: number; color: string }[];
  districtRanking: { district: string; count: number; avgResponseHours: number }[];
  recentEvents: { id: string; code: string; title: string; type: ProblemType; at: string; kind: 'new' | 'closed' | 'assigned' }[];
  totalTickets: number;
  updatedAt: string;
}
