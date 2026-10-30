import type { AiRun, OverdueRow, ProblemType, Severity, StatsOverview, Ticket, TicketStatus } from '@/domain/types';
import type { ScreenSummary } from '@/domain/types';
import { DEPARTMENTS, PROBLEM_TYPES, SEVERITY_META, TYPE_META } from '@/domain/constants';
import { getStorage } from '@/storage';
import { fmtDate } from '@/lib/format';

const CLOSED: TicketStatus[] = ['closed', 'rated', 'reopened'];

function isToday(iso: string, today: string): boolean {
  return fmtDate(iso) === today;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function computeStats(): StatsOverview {
  const storage = getStorage();
  const tickets = storage.tickets.all();
  const today = fmtDate(new Date().toISOString());

  const closed = tickets.filter((t) => CLOSED.includes(t.status));
  const responseHours: number[] = [];
  for (const t of closed) {
    const events = storage.tickets.events(t.id);
    const accept = events.find((e) => e.eventType === 'confirm' || e.eventType === 'accept');
    if (accept) {
      responseHours.push((new Date(accept.createdAt).getTime() - new Date(t.createdAt).getTime()) / 3600000);
    }
  }

  const feedback = storage.tickets.allFeedback();
  const satisfied = feedback.filter((f) => f.rating === 'satisfied').length;

  const assignments = storage.tickets.allAssignments().filter((a) => a.source === 'agent');
  const reviewed = assignments.filter((a) => a.state === 'active' || a.state === 'superseded');
  const adopted = assignments.filter((a) => a.state === 'active').length;

  const filed = tickets.filter((t) => t.status !== 'submitted');
  const autoFiled = filed.filter((t) => t.confidence >= 0.75 && !t.degraded).length;

  const typeDistribution = PROBLEM_TYPES.map((type) => ({
    type,
    label: TYPE_META[type].label,
    count: tickets.filter((t) => t.type === type).length
  }));

  const districts = Array.from(new Set(tickets.map((t) => t.district)));
  const districtRanking = districts
    .map((district) => {
      const list = tickets.filter((t) => t.district === district);
      const hrs = closed
        .filter((t) => t.district === district)
        .map((t) => {
          const ev = storage.tickets.events(t.id).find((e) => e.eventType === 'confirm' || e.eventType === 'accept');
          return ev ? (new Date(ev.createdAt).getTime() - new Date(t.createdAt).getTime()) / 3600000 : 0;
        })
        .filter(Boolean);
      return { district, count: list.length, avgResponseHours: Number(avg(hrs).toFixed(1)) };
    })
    .sort((a, b) => b.count - a.count);

  const trend: StatsOverview['trend'] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = fmtDate(d.toISOString());
    trend.push({
      date: day,
      reports: tickets.filter((t) => fmtDate(t.createdAt) === day).length,
      closed: tickets.filter((t) => t.closedAt && fmtDate(t.closedAt) === day).length
    });
  }

  const pendingReview = tickets.filter((t) => t.status === 'pending_review').length;
  const overdue = computeOverdueRows().length;

  return {
    totalTickets: tickets.length,
    todayReports: tickets.filter((t) => isToday(t.createdAt, today)).length,
    aiAutoFileRate: filed.length ? Number((autoFiled / filed.length).toFixed(3)) : 0,
    avgResponseHours: Number(avg(responseHours).toFixed(1)),
    completionRate: tickets.length ? Number((closed.length / tickets.length).toFixed(3)) : 0,
    satisfactionRate: feedback.length ? Number((satisfied / feedback.length).toFixed(3)) : 0,
    adoption: {
      numerator: adopted,
      denominator: reviewed.length,
      rate: reviewed.length ? Number((adopted / reviewed.length).toFixed(3)) : 0
    },
    typeDistribution,
    districtRanking,
    trend,
    pendingReview,
    overdue
  };
}

export function computeOverdueRows(): OverdueRow[] {
  const storage = getStorage();
  const rows: OverdueRow[] = [];
  const now = Date.now();
  for (const a of storage.tickets.allAssignments()) {
    if (a.state !== 'active') continue;
    const t = storage.tickets.getById(a.ticketId);
    if (!t || CLOSED.includes(t.status)) continue;
    const overdueMs = now - new Date(a.deadline).getTime();
    if (overdueMs <= 0) continue;
    rows.push({
      code: t.code,
      title: t.title,
      department: a.department,
      assignee: a.assignee,
      deadline: a.deadline,
      overdueHours: Number((overdueMs / 3600000).toFixed(1)),
      severity: t.severity,
      status: t.status
    });
  }
  return rows.sort((a, b) => b.overdueHours - a.overdueHours);
}

export function computeScreen(): ScreenSummary {
  const storage = getStorage();
  const tickets = storage.tickets.all();
  const stats = computeStats();
  const latest = [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);

  const recentEvents: ScreenSummary['recentEvents'] = [];
  for (const t of latest.slice(0, 12)) {
    const events = storage.tickets.events(t.id);
    const last = events[events.length - 1];
    recentEvents.push({
      id: last?.id ?? t.id,
      code: t.code,
      title: t.title,
      type: t.type,
      at: last?.createdAt ?? t.updatedAt,
      kind: t.status === 'submitted' || t.status === 'ai_filed' ? 'new' : CLOSED.includes(t.status) ? 'closed' : 'assigned'
    });
  }

  return {
    metrics: {
      todayReports: stats.todayReports,
      autoFileRate: stats.aiAutoFileRate,
      avgResponseHours: stats.avgResponseHours,
      completionRate: stats.completionRate
    },
    heatPoints: latest.map((t) => ({
      lng: t.lng,
      lat: t.lat,
      weight: t.severity === 'urgent' ? 3 : t.severity === 'medium' ? 2 : 1,
      type: t.type,
      severity: t.severity
    })),
    typeDistribution: PROBLEM_TYPES.map((type) => ({
      type,
      label: TYPE_META[type].label,
      count: tickets.filter((t) => t.type === type).length,
      color: TYPE_META[type].color
    })),
    districtRanking: stats.districtRanking,
    recentEvents: recentEvents.sort((a, b) => b.at.localeCompare(a.at)),
    totalTickets: tickets.length,
    updatedAt: new Date().toISOString()
  };
}

export interface AuditRow extends AiRun {
  ticketCode: string | null;
  ticketTitle: string | null;
  steps: number;
}

export function listAuditRuns(filter: {
  code?: string;
  stage?: AiRun['stage'];
  model?: string;
  from?: string;
  to?: string;
  fallbackOnly?: boolean;
  limit?: number;
}): AuditRow[] {
  const storage = getStorage();
  const runs = storage.ai.listRuns(filter);
  return runs.slice(0, filter.limit ?? 60).map((r) => {
    const t = r.ticketId ? storage.tickets.getById(r.ticketId) : undefined;
    return {
      ...r,
      ticketCode: t?.code ?? null,
      ticketTitle: t?.title ?? null,
      steps: r.stage === 'dispatch' ? storage.ai.stepsByRun(r.id).length : 0
    };
  });
}

export interface DepartmentOption {
  name: string;
  types: ProblemType[];
}

// 部门到问题类型的映射，供改派下拉展示
const DEPARTMENTS_TYPES: Record<string, ProblemType[]> = {
  市政设施中心: ['T01'],
  交通管理大队: ['T02'],
  环境卫生中心: ['T03'],
  照明管理中心: ['T04'],
  水务管理中心: ['T05'],
  城市管理执法大队: ['T06'],
  指挥中心: ['T07']
};

export const DEPARTMENT_OPTIONS: DepartmentOption[] = DEPARTMENTS.map((d) => ({
  name: d,
  types: DEPARTMENTS_TYPES[d] ?? []
}));

export function severityLabel(s: Severity): string {
  return SEVERITY_META[s].label;
}
