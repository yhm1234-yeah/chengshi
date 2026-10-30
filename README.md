# 城事 · AI 城市治理随手拍参与平台（演示版）

「城事」让市民随手一拍就能上报城市问题，AI 负责识别、归类、派单、跟踪与回访，管理端负责复核与督办，指挥大屏实时掌握全域态势。本项目为**可直接运行的完整演示系统**，默认走 Mock 数据，不依赖外网模型服务。

## 三端入口

| 端 | 路径 | 说明 |
| --- | --- | --- |
| 市民端 | `/m` | 手机壳界面：上报（拍照 → AI 识别 → 定位 → 分派预览 → 提交）、我的工单、办理助手、积分 |
| 管理端 | `/admin` | 复核台、工单处置、超时督办、审计日志、知识库、AI/MCP 调试 |
| 指挥大屏 | `/screen` | SSE 实时刷新：KPI、热力地图、事件流、区域排名、AI 链路健康 |
| 登录 | `/login` | 演示账号一键登录 |

**演示账号**：`13800000000` / `13900000000` / `13700000000`，验证码固定 `123456`。

## 技术栈

- Next.js 15（App Router）+ React 19 + TypeScript strict
- TailwindCSS 3 + Framer Motion + lucide-react
- ECharts（动态加载）+ 自绘 SVG 虚构城市地图
- Zustand / TanStack Query / Zod
- 存储层为接口 + 内存单例（`globalThis`），重启即重置，不写磁盘

## 目录结构

```
app/                页面与 API 路由（m / admin / screen / api）
src/domain/         领域模型、常量、工单状态机、隐私脱敏
src/ai/             VLM 识别、Agent 分派、RAG 问答、MCP 工具、Provider 抽象
src/server/         工单服务、统计聚合
src/storage/        种子数据（206 条工单）与 Mock 存储实现
src/components/     通用 UI 组件、证据框、地图、图表
public/images/      演示照片（AI 生成，仅用于演示）
```

## 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
# 或生产模式
npm run build && npm start
```

## AI 能力说明

- **识别**：VLM 输出归一化证据框、多问题候选、质量标记（遮挡/模糊/夜间）
- **分派**：Agent 8 步 plan/act/observe/decide/reflect，全链路写入 `agent_steps`
- **RAG**：向量 + 关键词混合检索（RRF），证据不足主动拒答
- **MCP**：`dispatch_ticket` / `notify_responsible` / `query_workload` / `schedule_followup`
- **安全闸门**：置信度 ≥ 0.75 自动立案；拆单 ≥ 0.7；紧急单先派后审且 100% 复核；低置信转人工
- **审计**：所有 AI 调用写入 `ai_runs`，可回溯

未配置真实模型时全部走本地 Mock；在 `.env` 填入密钥后自动切换真实模型，接口与审计保持不变（见 `.env.example`）。

## 说明

- 城市、区域、街道、部门均为虚构，仅用于演示
- 演示照片由 AI 生成，非真实场景
- 数据保存在内存中，刷新或重启后会重置为种子数据

## 部署限制

本项目包含 API 路由、SSE 与服务端中间件，**无法用 GitHub Pages 这类纯静态托管**，需部署到支持 Node.js 的平台（Vercel / Render / 自有服务器，`npm run build && npm start`）。
