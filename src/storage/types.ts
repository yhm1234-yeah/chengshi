import type {
  AiRun,
  Assignment,
  AssignmentState,
  Feedback,
  FindingDraft,
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
  ToolResultCode,
  AgentPhase,
  User,
  AiStage,
  AgentStep
} from '@/domain/types';

export interface TicketFilter {
  createdBy?: string;
  status?: TicketStatus[];
  type?: ProblemType[];
  severity?: Severity[];
  district?: string;
  gridCode?: string;
  q?: string;
  minConfidence?: number;
  maxConfidence?: number;
  needsReview?: boolean;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest';
}

export interface TicketCreateInput {
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
  images: { url: string; width: number; height: number; exifTime?: string }[];
  findings: FindingDraft[];
}

export interface AssignmentCreateInput {
  ticketId: string;
  findingId: string;
  grid: string;
  department: string;
  assignee: string;
  deadline: string;
  source: Assignment['source'];
  state: AssignmentState;
  reason: string;
}

export interface AiRunCreateInput {
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
}

export interface AgentStepCreateInput {
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

export interface Storage {
  users: {
    get(id: string): User | undefined;
    byPhoneHash(hash: string): User | undefined;
    list(): User[];
    addPoints(input: { userId: string; delta: number; reason: string; refId: string }): PointsLedger;
    ledger(userId: string): PointsLedger[];
  };
  tickets: {
    create(input: TicketCreateInput): Ticket;
    getByCode(code: string): Ticket | undefined;
    getById(id: string): Ticket | undefined;
    list(filter?: TicketFilter): { items: Ticket[]; total: number };
    update(id: string, patch: Partial<Ticket>): Ticket;
    addImage(input: Omit<TicketImage, 'id'>): TicketImage;
    images(ticketId: string): TicketImage[];
    addFinding(input: FindingDraft & { ticketId: string }): TicketFinding;
    findings(ticketId: string): TicketFinding[];
    addAssignment(input: AssignmentCreateInput): Assignment;
    updateAssignment(id: string, patch: Partial<Assignment>): Assignment;
    assignments(ticketId: string): Assignment[];
    addEvent(input: { ticketId: string; eventType: string; actor: string; payload?: Record<string, unknown> }): TicketEvent;
    events(ticketId: string): TicketEvent[];
    addFeedback(input: Omit<Feedback, 'id' | 'createdAt'>): Feedback;
    feedback(ticketId: string): Feedback | null;
    all(): Ticket[];
    allAssignments(): Assignment[];
    allFeedback(): Feedback[];
  };
  ai: {
    createRun(input: AiRunCreateInput): AiRun;
    updateRun(id: string, patch: Partial<AiRun>): AiRun;
    getRun(id: string): AiRun | undefined;
    runsByTicket(ticketId: string): AiRun[];
    listRuns(filter?: {
      ticketId?: string;
      code?: string;
      stage?: AiStage;
      model?: string;
      from?: string;
      to?: string;
      fallbackOnly?: boolean;
    }): AiRun[];
    allRuns(): AiRun[];
    addStep(input: AgentStepCreateInput): AgentStep;
    stepsByRun(runId: string): AgentStep[];
    stepsByTicket(ticketId: string): AgentStep[];
    updateRunTicket(id: string, ticketId: string): void;
  };
  knowledge: {
    docs(): KnowledgeDoc[];
    chunks(): KnowledgeChunk[];
    getDoc(id: string): KnowledgeDoc | undefined;
    setDocStatus(id: string, status: KnowledgeDoc['status']): void;
    addDoc(doc: KnowledgeDoc, chunks: KnowledgeChunk[]): void;
    replaceChunks(chunks: KnowledgeChunk[]): void;
  };
}
