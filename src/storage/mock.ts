import type { AgentStep, AiRun, Assignment, Feedback, PointsLedger, Ticket, TicketEvent, TicketFinding, TicketImage, User } from '@/domain/types';
import { STATUS_META } from '@/domain/constants';
import { makeTicketCode } from '@/lib/format';
import { db as getDb } from './store';
import type { AiRunCreateInput, AgentStepCreateInput, Storage, TicketFilter } from './types';

function nextId(prefix: string): string {
  const d = getDb();
  d.counters.entity += 1;
  return `${prefix}-${d.counters.entity.toString(36).padStart(4, '0')}`;
}

function now(): string {
  return new Date().toISOString();
}

export const mockStorage: Storage = {
  users: {
    get(id) {
      return getDb().users.find((u) => u.id === id);
    },
    byPhoneHash(hash) {
      return getDb().users.find((u) => u.phoneHash === hash);
    },
    list() {
      return getDb().users;
    },
    addPoints(input) {
      const d = getDb();
      const ledger: PointsLedger = {
        id: nextId('pt'),
        userId: input.userId,
        delta: input.delta,
        reason: input.reason,
        refId: input.refId,
        createdAt: now()
      };
      d.points.push(ledger);
      const user = d.users.find((u) => u.id === input.userId);
      if (user) user.points += input.delta;
      return ledger;
    },
    ledger(userId) {
      return getDb()
        .points.filter((p) => p.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  },
  tickets: {
    create(input) {
      const d = getDb();
      d.counters.ticket += 1;
      const createdAt = now();
      const ticket: Ticket = {
        id: nextId('tk'),
        code: makeTicketCode(d.counters.ticket),
        createdBy: input.createdBy,
        type: input.type,
        severity: input.severity,
        confidence: input.confidence,
        lng: input.lng,
        lat: input.lat,
        address: input.address,
        district: input.district,
        gridCode: input.gridCode,
        description: input.description,
        status: input.status,
        needsReview: input.needsReview,
        degraded: input.degraded,
        title: input.title,
        createdAt,
        updatedAt: createdAt
      };
      d.tickets.push(ticket);
      input.images.forEach((img, idx) => {
        d.images.push({
          id: nextId('img'),
          ticketId: ticket.id,
          url: img.url,
          width: img.width,
          height: img.height,
          exifTime: img.exifTime,
          sort: idx
        });
      });
      input.findings.forEach((f) => {
        d.findings.push({ id: nextId('fd'), ticketId: ticket.id, status: 'open', ...f });
      });
      d.events.push({
        id: nextId('evt'),
        ticketId: ticket.id,
        eventType: 'submit',
        actor: '市民',
        payload: { code: ticket.code, type: ticket.type },
        createdAt
      });
      return ticket;
    },
    getByCode(code) {
      return getDb().tickets.find((t) => t.code === code);
    },
    getById(id) {
      return getDb().tickets.find((t) => t.id === id);
    },
    list(filter: TicketFilter = {}) {
      const d = getDb();
      let items = [...d.tickets];
      if (filter.createdBy) items = items.filter((t) => t.createdBy === filter.createdBy);
      if (filter.status?.length) items = items.filter((t) => filter.status?.includes(t.status));
      if (filter.type?.length) items = items.filter((t) => filter.type?.includes(t.type));
      if (filter.severity?.length) items = items.filter((t) => filter.severity?.includes(t.severity));
      if (filter.district) items = items.filter((t) => t.district === filter.district);
      if (filter.gridCode) items = items.filter((t) => t.gridCode === filter.gridCode);
      if (filter.needsReview !== undefined) items = items.filter((t) => t.needsReview === filter.needsReview);
      if (filter.minConfidence !== undefined) items = items.filter((t) => t.confidence >= filter.minConfidence!);
      if (filter.maxConfidence !== undefined) items = items.filter((t) => t.confidence <= filter.maxConfidence!);
      if (filter.q) {
        const q = filter.q.trim();
        items = items.filter((t) => t.code.includes(q) || t.title.includes(q) || t.address.includes(q) || t.description.includes(q));
      }
      items.sort((a, b) => (filter.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
      const total = items.length;
      const pageSize = filter.pageSize ?? 20;
      const page = filter.page ?? 1;
      return { items: items.slice((page - 1) * pageSize, page * pageSize), total };
    },
    update(id, patch) {
      const t = getDb().tickets.find((x) => x.id === id);
      if (!t) throw new Error(`工单不存在：${id}`);
      Object.assign(t, patch, { updatedAt: now() });
      return t;
    },
    addImage(input) {
      const d = getDb();
      const image: TicketImage = { id: nextId('img'), ...input };
      d.images.push(image);
      return image;
    },
    images(ticketId) {
      return getDb()
        .images.filter((i) => i.ticketId === ticketId)
        .sort((a, b) => a.sort - b.sort);
    },
    addFinding(input) {
      const d = getDb();
      const f: TicketFinding = { id: nextId('fd'), status: 'open', ...input };
      d.findings.push(f);
      return f;
    },
    findings(ticketId) {
      return getDb().findings.filter((f) => f.ticketId === ticketId);
    },
    addAssignment(input) {
      const d = getDb();
      const a: Assignment = { id: nextId('asg'), createdAt: now(), ...input };
      d.assignments.push(a);
      return a;
    },
    updateAssignment(id, patch) {
      const a = getDb().assignments.find((x) => x.id === id);
      if (!a) throw new Error(`分派不存在：${id}`);
      Object.assign(a, patch);
      return a;
    },
    assignments(ticketId) {
      return getDb().assignments.filter((a) => a.ticketId === ticketId);
    },
    addEvent(input) {
      const d = getDb();
      const evt: TicketEvent = {
        id: nextId('evt'),
        ticketId: input.ticketId,
        eventType: input.eventType,
        actor: input.actor,
        payload: input.payload ?? {},
        createdAt: now()
      };
      d.events.push(evt);
      return evt;
    },
    events(ticketId) {
      return getDb()
        .events.filter((e) => e.ticketId === ticketId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    addFeedback(input) {
      const d = getDb();
      const fb: Feedback = { id: nextId('fb'), createdAt: now(), ...input };
      d.feedbacks.push(fb);
      return fb;
    },
    feedback(ticketId) {
      return getDb().feedbacks.find((f) => f.ticketId === ticketId) ?? null;
    },
    all() {
      return getDb().tickets;
    },
    allAssignments() {
      return getDb().assignments;
    },
    allFeedback() {
      return getDb().feedbacks;
    }
  },
  ai: {
    createRun(input: AiRunCreateInput) {
      const d = getDb();
      const run: AiRun = {
        id: nextId('run'),
        createdAt: now(),
        humanAction: 'none',
        ...input
      };
      d.aiRuns.push(run);
      return run;
    },
    updateRun(id, patch) {
      const run = getDb().aiRuns.find((r) => r.id === id);
      if (!run) throw new Error(`AI 运行记录不存在：${id}`);
      Object.assign(run, patch);
      return run;
    },
    getRun(id) {
      return getDb().aiRuns.find((r) => r.id === id);
    },
    runsByTicket(ticketId) {
      return getDb()
        .aiRuns.filter((r) => r.ticketId === ticketId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    listRuns(filter = {}) {
      let runs = [...getDb().aiRuns];
      const tickets = getDb().tickets;
      if (filter.ticketId) runs = runs.filter((r) => r.ticketId === filter.ticketId);
      if (filter.code) {
        const t = tickets.find((x) => x.code === filter.code);
        runs = runs.filter((r) => (t ? r.ticketId === t.id : false));
      }
      if (filter.stage) runs = runs.filter((r) => r.stage === filter.stage);
      if (filter.model) runs = runs.filter((r) => r.model.includes(filter.model!));
      if (filter.from) runs = runs.filter((r) => r.createdAt >= filter.from!);
      if (filter.to) runs = runs.filter((r) => r.createdAt <= filter.to!);
      if (filter.fallbackOnly) runs = runs.filter((r) => r.fallbackUsed);
      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    allRuns() {
      return getDb().aiRuns;
    },
    addStep(input: AgentStepCreateInput) {
      const d = getDb();
      const step: AgentStep = { id: nextId('step'), ...input };
      d.agentSteps.push(step);
      return step;
    },
    stepsByRun(runId) {
      return getDb()
        .agentSteps.filter((s) => s.runId === runId)
        .sort((a, b) => a.seq - b.seq);
    },
    stepsByTicket(ticketId) {
      const runIds = getDb().aiRuns.filter((r) => r.ticketId === ticketId).map((r) => r.id);
      return getDb()
        .agentSteps.filter((s) => runIds.includes(s.runId))
        .sort((a, b) => a.seq - b.seq);
    },
    updateRunTicket(id, ticketId) {
      const run = getDb().aiRuns.find((r) => r.id === id);
      if (run) run.ticketId = ticketId;
    }
  },
  knowledge: {
    docs() {
      return getDb().docs;
    },
    chunks() {
      return getDb().chunks;
    },
    getDoc(id) {
      return getDb().docs.find((d) => d.id === id);
    },
    setDocStatus(id, status) {
      const d = getDb();
      const doc = d.docs.find((x) => x.id === id);
      if (doc) doc.status = status;
      d.chunks.forEach((c) => {
        if (c.docId === id) c.status = status;
      });
    },
    addDoc(doc, chunks) {
      const d = getDb();
      d.docs.push(doc);
      d.chunks.push(...chunks);
    },
    replaceChunks(chunks) {
      getDb().chunks = chunks;
    }
  }
};

/** 状态徽标所需的辅助信息（前端本地计算，避免重复映射） */
export function statusStep(status: Ticket['status']): number {
  return STATUS_META[status].step;
}

export type { User, Assignment };
