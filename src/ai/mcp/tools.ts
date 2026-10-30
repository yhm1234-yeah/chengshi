import type { Severity } from '@/domain/types';
import { getStorage } from '@/storage';
import { hash32 } from '@/lib/utils';

// MCP 工具定义的唯一实现层：替换真实政务系统时只改这一文件，Agent 编排层不变

export interface McpToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples: { input: Record<string, unknown>; output: Record<string, unknown> }[];
}

export interface ToolCallResult {
  ok: boolean;
  resultCode: 'ok' | 'invalid' | 'timeout' | 'downstream_error';
  summary: string;
  data: Record<string, unknown>;
}

export interface ToolContext {
  runId: string;
  stepSeq: number;
  actor: string;
}

export const MCP_TOOLS: McpToolDescriptor[] = [
  {
    name: 'dispatch_ticket',
    description: '将子任务分派结果推送至模拟工单系统，写入 assignments（state=proposed，待坐席确认）并返回派单回执号。有副作用。',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string', description: '工单内部 ID' },
        findingId: { type: 'string', description: '子问题 ID' },
        department: { type: 'string', description: '承办部门' },
        grid: { type: 'string', description: '网格编码' },
        deadline: { type: 'string', description: '承诺办结时限 ISO 时间' },
        reason: { type: 'string', description: '分派理由' }
      },
      required: ['ticketId', 'findingId', 'department', 'grid', 'deadline', 'reason']
    },
    outputSchema: {
      type: 'object',
      properties: {
        receiptNo: { type: 'string' },
        assignmentId: { type: 'string' },
        summary: { type: 'string' }
      },
      required: ['receiptNo', 'assignmentId', 'summary']
    },
    examples: [
      {
        input: {
          ticketId: 'tk-001',
          findingId: 'fd-001',
          department: '云溪区市政设施中心',
          grid: 'YX-01',
          deadline: '2026-11-18T10:30:00.000Z',
          reason: '依据职责划分规范第 1.1 条'
        },
        output: { receiptNo: 'MCP-D-00042', assignmentId: 'asg-001', summary: '派单成功，等待坐席复核' }
      },
      {
        input: {
          ticketId: 'tk-002',
          findingId: 'fd-004',
          department: '云溪区交通管理大队',
          grid: 'YX-02',
          deadline: '2026-11-19T10:30:00.000Z',
          reason: '依据职责划分规范第 1.2 条'
        },
        output: { receiptNo: 'MCP-D-00043', assignmentId: 'asg-002', summary: '派单成功，等待坐席复核' }
      }
    ]
  },
  {
    name: 'notify_responsible',
    description: '生成并发送站内模拟通知给承办部门（紧急单必须调用）。有副作用。',
    inputSchema: {
      type: 'object',
      properties: {
        department: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        urgency: { type: 'string', enum: ['low', 'medium', 'urgent'] }
      },
      required: ['department', 'title', 'body', 'urgency']
    },
    outputSchema: {
      type: 'object',
      properties: { notificationId: { type: 'string' }, summary: { type: 'string' } },
      required: ['notificationId', 'summary']
    },
    examples: [
      {
        input: { department: '云溪区市政设施中心', title: '紧急井盖工单', body: '请 2 小时内到场', urgency: 'urgent' },
        output: { notificationId: 'MCP-N-00101', summary: '已向承办部门发送站内通知' }
      },
      {
        input: { department: '云溪区环境卫生中心', title: '垃圾清运提醒', body: '请按 24 小时时限处理', urgency: 'medium' },
        output: { notificationId: 'MCP-N-00102', summary: '已向承办部门发送站内通知' }
      }
    ]
  },
  {
    name: 'query_workload',
    description: '查询指定网格当前待办量与平均处理时长，用于分派时做负载均衡。只读。',
    inputSchema: {
      type: 'object',
      properties: { grid: { type: 'string' } },
      required: ['grid']
    },
    outputSchema: {
      type: 'object',
      properties: {
        grid: { type: 'string' },
        pending: { type: 'number' },
        avgHandleHours: { type: 'number' },
        summary: { type: 'string' }
      },
      required: ['grid', 'pending', 'avgHandleHours', 'summary']
    },
    examples: [
      { input: { grid: 'YX-01' }, output: { grid: 'YX-01', pending: 7, avgHandleHours: 5.2, summary: 'YX-01 网格待办 7 件' } },
      { input: { grid: 'QW-04' }, output: { grid: 'QW-04', pending: 3, avgHandleHours: 3.8, summary: 'QW-04 网格待办 3 件' } }
    ]
  },
  {
    name: 'schedule_followup',
    description: '按处置时限创建督办提醒，时限前 25% 与超时后各触发一次。有副作用。',
    inputSchema: {
      type: 'object',
      properties: {
        ticketId: { type: 'string' },
        receiptNo: { type: 'string' },
        deadline: { type: 'string' }
      },
      required: ['ticketId', 'receiptNo', 'deadline']
    },
    outputSchema: {
      type: 'object',
      properties: { followupId: { type: 'string' }, summary: { type: 'string' } },
      required: ['followupId', 'summary']
    },
    examples: [
      {
        input: { ticketId: 'tk-001', receiptNo: 'MCP-D-00042', deadline: '2026-11-18T10:30:00.000Z' },
        output: { followupId: 'MCP-F-00031', summary: '已创建督办提醒' }
      },
      {
        input: { ticketId: 'tk-002', receiptNo: 'MCP-D-00043', deadline: '2026-11-19T10:30:00.000Z' },
        output: { followupId: 'MCP-F-00032', summary: '已创建督办提醒' }
      }
    ]
  }
];

interface NotificationRecord {
  id: string;
  department: string;
  title: string;
  body: string;
  urgency: Severity;
  createdAt: string;
}

const globalMcp = globalThis as unknown as { __chengshiNotifications?: NotificationRecord[] };
function notifications(): NotificationRecord[] {
  if (!globalMcp.__chengshiNotifications) globalMcp.__chengshiNotifications = [];
  return globalMcp.__chengshiNotifications;
}

export function listNotifications(): NotificationRecord[] {
  return notifications();
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v) throw new Error(`参数 ${key} 缺失或类型错误`);
  return v;
}

function id(prefix: string, seed: string): string {
  return `${prefix}-${String(hash32(seed + Date.now()) % 100000).padStart(5, '0')}`;
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const storage = getStorage();
  switch (name) {
    case 'dispatch_ticket': {
      const ticketId = str(args, 'ticketId');
      const findingId = str(args, 'findingId');
      const department = str(args, 'department');
      const grid = str(args, 'grid');
      const deadline = str(args, 'deadline');
      const reason = str(args, 'reason');
      const ticket = storage.tickets.getById(ticketId);
      if (!ticket) return { ok: false, resultCode: 'invalid', summary: '工单不存在', data: {} };
      const receiptNo = id('MCP-D', `${ctx.runId}:${ctx.stepSeq}:${findingId}`);
      const assignment = storage.tickets.addAssignment({
        ticketId,
        findingId,
        grid,
        department,
        assignee: '网格坐席',
        deadline,
        source: 'agent',
        state: 'proposed',
        reason
      });
      return {
        ok: true,
        resultCode: 'ok',
        summary: `派单成功：${department}，回执 ${receiptNo}（proposed，待坐席确认）`,
        data: { receiptNo, assignmentId: assignment.id, summary: `已推送 ${department}` }
      };
    }
    case 'notify_responsible': {
      const department = str(args, 'department');
      const title = str(args, 'title');
      const body = str(args, 'body');
      const urgency = str(args, 'urgency') as Severity;
      const notificationId = id('MCP-N', department + title);
      notifications().unshift({
        id: notificationId,
        department,
        title,
        body,
        urgency,
        createdAt: new Date().toISOString()
      });
      return {
        ok: true,
        resultCode: 'ok',
        summary: `已发送通知至 ${department}`,
        data: { notificationId, summary: `通知 ${notificationId}` }
      };
    }
    case 'query_workload': {
      const grid = str(args, 'grid');
      const active = storage.tickets
        .allAssignments()
        .filter((a) => a.grid === grid && a.state !== 'superseded');
      const pending = active.length;
      const avgHandleHours = Number((3.2 + (hash32(grid) % 40) / 10).toFixed(1));
      return {
        ok: true,
        resultCode: 'ok',
        summary: `${grid} 网格待办 ${pending} 件，平均处理 ${avgHandleHours} 小时`,
        data: { grid, pending, avgHandleHours, summary: `待办 ${pending} 件` }
      };
    }
    case 'schedule_followup': {
      const ticketId = str(args, 'ticketId');
      const receiptNo = str(args, 'receiptNo');
      const followupId = id('MCP-F', ticketId + receiptNo);
      const deadline = str(args, 'deadline');
      return {
        ok: true,
        resultCode: 'ok',
        summary: `已创建督办提醒（时限 ${deadline}）`,
        data: { followupId, summary: `提醒 ${followupId}` }
      };
    }
    default:
      return { ok: false, resultCode: 'invalid', summary: `未知工具：${name}`, data: {} };
  }
}
