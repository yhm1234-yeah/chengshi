import type {
  AssignmentSource,
  ProblemType,
  Role,
  Severity,
  TicketStatus,
  KnowledgeDocType
} from './types';

/** 问题类型表（T01–T07 共 7 类，编码可配置） */
export interface TypeMeta {
  code: ProblemType;
  label: string;
  short: string;
  defaultSeverity: Severity;
  department: string;
  slaHours: number;
  color: string;
  soft: string;
  sampleImage: string;
  demoCase: string;
  description: string;
  keywords: string[];
}

export const TYPE_META: Record<ProblemType, TypeMeta> = {
  T01: {
    code: 'T01',
    label: '井盖破损/缺失',
    short: '井盖',
    defaultSeverity: 'urgent',
    department: '市政设施中心',
    slaHours: 2,
    color: '#F04438',
    soft: '#FFF1F1',
    sampleImage: '/images/manhole.jpg',
    demoCase: 'manhole',
    description: '井盖缺失、破损、下沉或异响，存在行人车辆坠落风险',
    keywords: ['井盖', '井圈', '缺失', '破损', '市政']
  },
  T02: {
    code: 'T02',
    label: '违停占道',
    short: '违停',
    defaultSeverity: 'medium',
    department: '交通管理大队',
    slaHours: 24,
    color: '#F59300',
    soft: '#FFF8EB',
    sampleImage: '/images/parking.jpg',
    demoCase: 'parking',
    description: '机动车违规停放占用消防通道、人行道或非机动车道',
    keywords: ['违停', '占道', '停车', '人行道', '交管']
  },
  T03: {
    code: 'T03',
    label: '垃圾堆积',
    short: '垃圾',
    defaultSeverity: 'medium',
    department: '环境卫生中心',
    slaHours: 24,
    color: '#12A38F',
    soft: '#E9FBF7',
    sampleImage: '/images/garbage.jpg',
    demoCase: 'garbage',
    description: '生活垃圾、装修垃圾长期堆积未清运，影响市容与卫生',
    keywords: ['垃圾', '堆积', '清运', '环卫', '异味']
  },
  T04: {
    code: 'T04',
    label: '路灯故障',
    short: '路灯',
    defaultSeverity: 'low',
    department: '照明管理中心',
    slaHours: 48,
    color: '#4C5DF0',
    soft: '#EEF1FF',
    sampleImage: '/images/streetlight.jpg',
    demoCase: 'streetlight',
    description: '路灯不亮、闪烁、灯杆倾斜或线缆外露',
    keywords: ['路灯', '不亮', '照明', '灯杆', '线缆']
  },
  T05: {
    code: 'T05',
    label: '积水内涝',
    short: '积水',
    defaultSeverity: 'urgent',
    department: '水务管理中心',
    slaHours: 2,
    color: '#2E90FA',
    soft: '#EFF8FF',
    sampleImage: '/images/flood.jpg',
    demoCase: 'flood',
    description: '道路积水、排水口堵塞、雨水倒灌，影响通行安全',
    keywords: ['积水', '内涝', '排水', '雨水', '水务']
  },
  T06: {
    code: 'T06',
    label: '广告牌隐患',
    short: '广告牌',
    defaultSeverity: 'medium',
    department: '城市管理执法大队',
    slaHours: 24,
    color: '#7A5AF8',
    soft: '#F4F1FF',
    sampleImage: '/images/billboard.jpg',
    demoCase: 'billboard',
    description: '户外广告牌松动、锈蚀、倾斜或遮挡视线',
    keywords: ['广告牌', '松动', '锈蚀', '城管', '户外广告']
  },
  T07: {
    code: 'T07',
    label: '其他问题',
    short: '其他',
    defaultSeverity: 'low',
    department: '指挥中心',
    slaHours: 48,
    color: '#667085',
    soft: '#F2F4F7',
    sampleImage: '/images/other.jpg',
    demoCase: 'other',
    description: '未归入上述类别、需人工研判的城市管理问题',
    keywords: ['其他', '人工', '研判', '指挥中心']
  }
};

export const PROBLEM_TYPES: ProblemType[] = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07'];

export interface SeverityMeta {
  code: Severity;
  label: string;
  slaHours: number;
  color: string;
  soft: string;
  text: string;
}

export const SEVERITY_META: Record<Severity, SeverityMeta> = {
  low: { code: 'low', label: '一般', slaHours: 48, color: '#667085', soft: '#F2F4F7', text: 'text-ink-500' },
  medium: { code: 'medium', label: '较重', slaHours: 24, color: '#F59300', soft: '#FFF8EB', text: 'text-amber-600' },
  urgent: { code: 'urgent', label: '紧急', slaHours: 2, color: '#F04438', soft: '#FFF1F1', text: 'text-danger-600' }
};

export const STATUS_META: Record<
  TicketStatus,
  { label: string; short: string; color: string; soft: string; step: number }
> = {
  submitted: { label: '已提交', short: '已提交', color: '#667085', soft: '#F2F4F7', step: 0 },
  ai_filed: { label: 'AI 已立案', short: 'AI立案', color: '#4C5DF0', soft: '#EEF1FF', step: 1 },
  pending_review: { label: '待人工复核', short: '待复核', color: '#F59300', soft: '#FFF8EB', step: 2 },
  assigned: { label: '已分派', short: '已分派', color: '#2E90FA', soft: '#EFF8FF', step: 3 },
  processing: { label: '处置中', short: '处置中', color: '#12A38F', soft: '#E9FBF7', step: 4 },
  closed: { label: '已办结', short: '已办结', color: '#12A38F', soft: '#E9FBF7', step: 5 },
  rated: { label: '已评价', short: '已评价', color: '#039855', soft: '#ECFDF3', step: 6 },
  reopened: { label: '督办重办', short: '督办重办', color: '#F04438', soft: '#FFF1F1', step: 5 }
};

export const ROLE_META: Record<Role, { label: string; portal: string }> = {
  citizen: { label: '市民', portal: '/m' },
  staff: { label: '网格坐席', portal: '/admin' },
  command: { label: '指挥中心', portal: '/admin' }
};

export const DISTRICTS = ['云溪区', '青梧区'] as const;

export interface GridMeta {
  code: string;
  district: string;
  street: string;
  center: { lng: number; lat: number };
}

/** 2 个行政区 × 6 个网格（虚构名称） */
export const GRIDS: GridMeta[] = [
  { code: 'YX-01', district: '云溪区', street: '青梧街道', center: { lng: 120.148, lat: 30.272 } },
  { code: 'YX-02', district: '云溪区', street: '云溪街道', center: { lng: 120.164, lat: 30.281 } },
  { code: 'YX-03', district: '云溪区', street: '南湖街道', center: { lng: 120.172, lat: 30.266 } },
  { code: 'QW-04', district: '青梧区', street: '望江街道', center: { lng: 120.186, lat: 30.279 } },
  { code: 'QW-05', district: '青梧区', street: '白鹭街道', center: { lng: 120.196, lat: 30.268 } },
  { code: 'QW-06', district: '青梧区', street: '东屿街道', center: { lng: 120.181, lat: 30.292 } }
];

export const DEPARTMENTS = [
  '市政设施中心',
  '交通管理大队',
  '环境卫生中心',
  '照明管理中心',
  '水务管理中心',
  '城市管理执法大队',
  '指挥中心'
] as const;

export const DEPARTMENT_BASE: Record<ProblemType, string> = {
  T01: '市政设施中心',
  T02: '交通管理大队',
  T03: '环境卫生中心',
  T04: '照明管理中心',
  T05: '水务管理中心',
  T06: '城市管理执法大队',
  T07: '指挥中心'
};

export const KNOWLEDGE_DOC_TYPE_META: Record<KnowledgeDocType, { label: string; color: string; soft: string }> = {
  responsibility: { label: '职责划分', color: '#4C5DF0', soft: '#EEF1FF' },
  timelimit: { label: '处置时限', color: '#F59300', soft: '#FFF8EB' },
  technical: { label: '技术规范', color: '#12A38F', soft: '#E9FBF7' }
};

export const ASSIGNMENT_SOURCE_META: Record<AssignmentSource, { label: string; color: string; soft: string }> = {
  agent: { label: 'AI 分派', color: '#4C5DF0', soft: '#EEF1FF' },
  manual: { label: '人工改派', color: '#12A38F', soft: '#E9FBF7' }
};

/** 严格取自设计说明书附录 B */
export const THRESHOLDS = {
  confidence: 0.75,
  splitConfidence: 0.7,
  ragScore: 0.2,
  maxImage: 3,
  maxAgentSteps: 8,
  ragTopK: 3,
  auditRetentionDays: 90
} as const;

export const DEMO_ACCOUNTS: { role: Role; phone: string; code: string; name: string; desc: string }[] = [
  { role: 'citizen', phone: '13800000000', code: '123456', name: '林晓', desc: '市民端 · 上报 / 查询 / 评价' },
  { role: 'staff', phone: '13900000000', code: '123456', name: '周敏', desc: '网格坐席 · 复核 / 改派 / 督办' },
  { role: 'command', phone: '13700000000', code: '123456', name: '陈默', desc: '指挥中心 · 大屏 / 报表 / 知识库' }
];

export const DISCLAIMER = '演示数据，非真实政务系统';
