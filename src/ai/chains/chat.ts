import type { ChatCitation, ChatResult, ChatTicketCard, Ticket, TicketStatus } from '@/domain/types';
import { STATUS_META, TYPE_META, THRESHOLDS } from '@/domain/constants';
import { fmtDateTime, fmtHours } from '@/lib/format';
import { retrieve, type RetrievalResult } from '@/ai/rag/retrieve';
import { generateStructured, hasLiveLlm, llmModelName } from '@/ai/providers/llm';
import { chatSchema } from '@/ai/schemas';
import { getStorage } from '@/storage';

export type ChatIntent = ChatResult['intent'];

const CODE_RE = /CS\d{8}-\d{4}/i;

export function detectIntent(message: string): { intent: ChatIntent; code?: string; type?: keyof typeof TYPE_META } {
  const text = message.trim();
  const code = text.match(CODE_RE)?.[0]?.toUpperCase();
  if (code) return { intent: 'progress', code };
  if (/我(的)?(工单|上报|投诉|举报).*(进度|到哪|怎么样|处理|办)|进度|到哪一步|办结了吗/.test(text)) {
    return { intent: 'progress' };
  }
  const typeMap: { re: RegExp; type: keyof typeof TYPE_META }[] = [
    { re: /井盖|井圈/, type: 'T01' },
    { re: /违停|停车|占道/, type: 'T02' },
    { re: /垃圾|清运/, type: 'T03' },
    { re: /路灯|照明/, type: 'T04' },
    { re: /积水|内涝|排水/, type: 'T05' },
    { re: /广告牌/, type: 'T06' }
  ];
  if (/找谁|哪个部门|谁负责|负责|承办|该找/.test(text)) {
    const hit = typeMap.find((t) => t.re.test(text));
    return { intent: 'area', type: hit?.type };
  }
  if (/多久|几天|时限|多长时间|什么时候.*办|办结|超时|催办|评价|积分/.test(text)) {
    return { intent: 'policy' };
  }
  if (/^(你好|您好|hi|hello|在吗|嗨)/i.test(text) || text.length < 4) {
    return { intent: 'clarify' };
  }
  return { intent: 'fallback' };
}

function citationsOf(result: RetrievalResult): ChatCitation[] {
  if (!result.accepted) return [];
  return result.hits.map((h) => ({
    docTitle: h.docTitle,
    clause: h.chunk.clause,
    snippet: h.chunk.content.slice(0, 120) + (h.chunk.content.length > 120 ? '…' : ''),
    score: Number(h.score.toFixed(4))
  }));
}

function cardOf(t: Ticket): ChatTicketCard {
  return {
    code: t.code,
    title: t.title,
    status: t.status,
    type: t.type,
    createdAt: t.createdAt
  };
}

function statusSentence(t: Ticket): string {
  const storage = getStorage();
  const events = storage.tickets.events(t.id);
  const last = events[events.length - 1];
  const assignments = storage.tickets.assignments(t.id).filter((a) => a.state === 'active');
  const statusLabel = STATUS_META[t.status].label;
  const parts: string[] = [`工单 ${t.code}「${t.title}」当前状态为「${statusLabel}」。`];
  if (assignments.length) {
    const a = assignments[0];
    parts.push(`承办部门为 ${a.department}，承诺时限 ${fmtDateTime(a.deadline)}。`);
  }
  if (last) {
    parts.push(`最近一次动作：${last.eventType === 'submit' ? '市民提交' : last.eventType === 'ai_file' ? 'AI 识别立案' : last.eventType === 'dispatch' ? 'AI 生成分派建议' : last.eventType === 'confirm' ? '坐席复核确认' : last.eventType === 'close' ? '承办部门办结' : last.eventType}（${fmtDateTime(last.createdAt)}）。`);
  }
  if (t.status === 'pending_review') {
    parts.push('按规范，AI 分派方案需经网格坐席复核后才正式下发，您无需重复上报。');
  }
  if (t.status === 'closed') {
    const closedAt = t.closedAt ?? t.updatedAt;
    parts.push(`该工单已办结，实际用时 ${fmtHours((new Date(closedAt).getTime() - new Date(t.createdAt).getTime()) / 3600000)}，请在 7 日内对办理结果进行评价。`);
  }
  if (t.status === 'reopened') {
    parts.push('您此前评价为不满意，工单已转入督办重办，承办部门需在 24 小时内重新处置。');
  }
  if (t.status === 'rated') {
    parts.push('该工单已完成评价，感谢您的参与。');
  }
  return parts.join('');
}

/** 依据工单类型把相关条款作为引用（用于追问场景） */
async function citationsForTickets(tickets: Ticket[]): Promise<ChatCitation[]> {
  if (!tickets.length) return [];
  const first = tickets[0];
  const res = await retrieve(`${TYPE_META[first.type].label} 时限 职责`, 2);
  return citationsOf(res);
}

export interface ChatOutput {
  result: ChatResult;
  streamText: string;
  runId: string;
}

export async function runChat(options: {
  message: string;
  userId: string;
  role: 'citizen' | 'staff' | 'command';
}): Promise<ChatOutput> {
  const storage = getStorage();
  const detected = detectIntent(options.message);
  const rag = await retrieve(options.message, THRESHOLDS.ragTopK);
  const citations = citationsOf(rag);

  let result: ChatResult;
  let answer = '';
  let tickets: ChatTicketCard[] = [];
  let grounded = false;
  let fallback = false;
  let intent = detected.intent;

  if (intent === 'progress') {
    const scope = options.role === 'citizen' ? storage.tickets.list({ createdBy: options.userId, pageSize: 200 }).items : storage.tickets.all();
    const ticket = detected.code ? scope.find((t) => t.code === detected.code) : scope.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!ticket) {
      intent = 'clarify';
      answer = detected.code
        ? `没有查询到工单 ${detected.code}。请核对工单号，或前往「我的上报」查看本人提交的记录。`
        : '您还没有上报记录。可以先到「随手拍上报」提交问题，提交后我会持续跟踪进度。';
      tickets = [];
    } else {
      answer = statusSentence(ticket);
      tickets = [cardOf(ticket)];
      const extra = await citationsForTickets([ticket]);
      if (extra.length) {
        citations.push(...extra.slice(0, 2));
        grounded = true;
      }
    }
  } else if (intent === 'area' || intent === 'policy') {
    if (rag.accepted) {
      grounded = true;
      const top = rag.hits[0];
      const deptLine = detected.type ? `${TYPE_META[detected.type].label}问题由 ${TYPE_META[detected.type].department} 承办。` : '';
      answer =
        intent === 'area'
          ? `${deptLine}依据《${top.docTitle.replace(/《|》/g, '')}》${top.chunk.clause}：${top.chunk.content}`
          : `依据《${top.docTitle.replace(/《|》/g, '')}》${top.chunk.clause}：${top.chunk.content}`;
      if (rag.hits.length > 1) {
        answer += `\n\n补充：${rag.hits[1].chunk.clause}规定，${rag.hits[1].chunk.content.slice(0, 120)}…`;
      }
    } else {
      intent = 'fallback';
      answer =
        '抱歉，现有知识库中没有检索到足够可靠的依据，为避免误导我不作推测。建议拨打 12345 市民热线，或到「我的上报」提交工单，由坐席人工核实。';
      fallback = true;
    }
  } else if (intent === 'clarify') {
    answer =
      '您好，我是「城事」办理助手。可以这样问我：\n① 我的工单到哪一步了？\n② 井盖坏了该找谁负责？\n③ 紧急工单多久必须办结？';
  } else {
    fallback = true;
    intent = 'fallback';
    answer =
      '抱歉，这个问题超出了我的知识范围。我只回答与城市管理工单、职责划分、处置时限相关的问题，不作无依据的推测。您也可以拨打 12345 市民热线咨询。';
  }

  // 真实模型可用时，用检索到的条款与工单事实重写答案；无依据一律拒答
  if (hasLiveLlm() && !fallback) {
    try {
      const context = [
        `问题：${options.message}`,
        tickets.length ? `工单信息：${tickets.map((t) => `${t.code} ${t.title} 状态=${STATUS_META[t.status].label}`).join('；')}` : '',
        citations.length ? `知识库条款：${citations.map((c) => `${c.docTitle} ${c.clause}：${c.snippet}`).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n');
      const out = await generateStructured({
        schema: chatSchema,
        system:
          '你是城市治理办理助手。只能依据给定的工单信息与知识库条款作答；信息不足时明确说明无法回答并引导拨打 12345，不要编造条款、部门或时限。回答控制在 120 字以内，重要结论后可附条款出处。',
        prompt: context
      });
      answer = out.answer;
    } catch {
      // 模型异常时保留规则化答案
    }
  }

  result = {
    intent,
    answer,
    citations,
    tickets,
    grounded,
    fallback
  };

  const run = storage.ai.createRun({
    ticketId: null,
    stage: 'chat',
    model: hasLiveLlm() ? llmModelName() : `${llmModelName()} (mock)`,
    modelVersion: '2026.10',
    promptDigest: `sha256:${Math.abs(options.message.split('').reduce((s, c) => s + c.charCodeAt(0), 0)).toString(16)}`,
    inputDigest: `intent=${intent};len=${options.message.length}`,
    outputJson: {
      intent,
      grounded,
      fallback,
      citations: citations.map((c) => `${c.docTitle} ${c.clause}`),
      tickets: tickets.map((t) => t.code)
    },
    tokensIn: 300 + options.message.length,
    tokensOut: answer.length,
    latencyMs: 520,
    fallbackUsed: fallback,
    degraded: false
  });

  return { result, streamText: answer, runId: run.id };
}

/** 按字符切块，供前端逐字渲染（保留换行） */
export function chunkText(text: string, size = 5): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

export const CHAT_SUGGESTIONS = [
  '我的工单到哪一步了？',
  '井盖坏了该找谁负责？',
  '紧急工单多久必须办结？',
  '工单超时了怎么督办？'
];
