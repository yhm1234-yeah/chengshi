import type { TicketStatus } from './types';

// ============================================================
// 工单状态机（表驱动）：未登记的迁移直接抛错，禁止 if-else 散落
// submitted → ai_filed → pending_review → assigned → processing → closed → rated
// 分支：pending_review 驳回 → submitted；closed 不满意 → reopened → assigned
// ============================================================

export type FsmEvent =
  | 'ai_file'
  | 'degrade_to_review'
  | 'dispatch'
  | 'confirm'
  | 'reject'
  | 'accept'
  | 'close'
  | 'rate_satisfied'
  | 'rate_unsatisfied'
  | 'redispatch';

type TransitionTable = Record<FsmEvent, TicketStatus>;

const TABLE: Record<TicketStatus, Partial<TransitionTable>> = {
  submitted: {
    ai_file: 'ai_filed',
    degrade_to_review: 'pending_review',
    // 识别完全降级时允许直接进入人工队列
    dispatch: 'pending_review'
  },
  ai_filed: {
    dispatch: 'pending_review'
  },
  pending_review: {
    confirm: 'assigned',
    reject: 'submitted'
  },
  assigned: {
    accept: 'processing',
    close: 'closed'
  },
  processing: {
    close: 'closed'
  },
  closed: {
    rate_satisfied: 'rated',
    rate_unsatisfied: 'reopened'
  },
  rated: {
    rate_unsatisfied: 'reopened'
  },
  reopened: {
    redispatch: 'assigned'
  }
};

export class FsmError extends Error {
  constructor(
    public readonly from: TicketStatus,
    public readonly event: FsmEvent
  ) {
    super(`非法状态迁移：${from} --[${event}]--> ?`);
    this.name = 'FsmError';
  }
}

export function canTransition(from: TicketStatus, event: FsmEvent): boolean {
  return Boolean(TABLE[from]?.[event]);
}

export function transition(from: TicketStatus, event: FsmEvent): TicketStatus {
  const to = TABLE[from]?.[event];
  if (!to) throw new FsmError(from, event);
  return to;
}

/** 状态对应的展示进度（用于进度条与时间轴） */
export const STATUS_FLOW: TicketStatus[] = [
  'submitted',
  'ai_filed',
  'pending_review',
  'assigned',
  'processing',
  'closed',
  'rated'
];

export function statusIndex(status: TicketStatus): number {
  if (status === 'reopened') return 5;
  const i = STATUS_FLOW.indexOf(status);
  return i < 0 ? 0 : i;
}
