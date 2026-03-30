# 外卖骑手智能客服系统

基于大语言模型的骑手 7x24 智能客服，支持订单查询、收入查询、罚单申诉、知识问答、天气查询等业务场景，采用 SSE 流式输出实现打字机效果。

## 技术栈

### 后端

| 技术 | 用途 |
|------|------|
| Node.js 20+ / TypeScript | 运行时 / 开发语言 |
| Express | Web 框架 |
| 智谱AI GLM-4-Flash | 大语言模型（对话 + Embedding） |
| LangChain | Agent 框架 & 工具编排 |
| ChromaDB | 向量数据库（RAG 知识检索） |
| SQLite (better-sqlite3) | 关系数据库（会话、消息、知识条目等） |
| MinIO | 对象存储（文档上传） |
| Winston | 日志系统 |
| SSE (Server-Sent Events) | 流式响应 |

### 前端

| 技术 | 用途 |
|------|------|
| React 18 | UI 框架 |
| Vite | 构建工具 |
| Ant Design 6 | UI 组件库（管理后台） |
| React Router | 路由 |
| Fetch + ReadableStream | SSE 流式通信 |

## 项目结构

```
agent_JS/
├── backend/                     # 后端服务
│   ├── src/
│   │   ├── agents/              # AI Agent（意图识别、工具调用、流式输出）
│   │   │   ├── riderAgent.ts     # 主控 Agent
│   │   │   └── tools/            # 6 个业务工具
│   │   ├── routes/              # API 路由
│   │   │   ├── chat.ts           # 对话接口（同步 + SSE 流式）
│   │   │   ├── knowledge.ts      # 知识库管理
│   │   │   ├── documents.ts      # 文档上传 & RAG
│   │   │   ├── feedback.ts       # 用户反馈
│   │   │   └── suggestions.ts    # 猜你想问
│   │   ├── services/             # 业务服务
│   │   │   ├── llm.ts            # 智谱AI 封装（同步 + 流式）
│   │   │   ├── chroma.ts         # ChromaDB 向量操作
│   │   │   ├── embeddings.ts     # Embedding 生成
│   │   │   ├── documentProcessor.ts # 文档解析、分块、向量化
│   │   │   └── minio.ts          # 文件存储
│   │   ├── utils/                # 工具函数（数据库、日志、响应格式化）
│   │   ├── config/               # 配置
│   │   └── server.ts             # 入口
│   ├── data/                     # SQLite 数据库文件
│   ├── logs/                     # 日志文件
│   ├── uploads/                  # 上传文件
│   └── package.json
├── frontend/                    # 前端应用
│   ├── src/
│   │   ├── pages/                # 页面组件
│   │   │   ├── CustomerService.jsx  # 骑手聊天界面（流式对话）
│   │   │   └── admin/               # 管理后台
│   │   ├── services/api.js       # API 调用（含 SSE 流式解析）
│   │   └── layouts/              # 布局组件
│   ├── vite.config.js
│   └── package.json
├── doc/                         # 项目文档
└── README.md                    # 本文件
```

## 快速开始

### 环境要求

- Node.js >= 20
- 智谱AI API Key（[获取地址](https://open.bigmodel.cn/)）
- ChromaDB（向量检索，可选，无则自动降级为模拟数据）

### 1. 克隆项目

```bash
git clone <repo-url>
cd agent_JS
```

### 2. 启动后端

```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 ZHIPU_API_KEY

npm run dev    # 开发模式（热重载），默认端口 3001
```

后端 API 地址：`http://localhost:3001/api/v1`

### 3. 启动前端

```bash
cd frontend
npm install

npm run dev    # Vite 开发服务器，默认端口 3000
```

前端会自动将 `/api` 请求代理到后端 `http://localhost:3001`。

打开浏览器访问 `http://localhost:3000` 即可使用。

## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/chat` | 同步对话 |
| POST | `/api/v1/chat/stream` | SSE 流式对话 |
| GET | `/api/v1/session/:sessionId` | 会话历史 |
| POST | `/api/v1/feedback` | 提交反馈 |
| GET | `/api/v1/suggestions` | 猜你想问 |
| POST | `/api/v1/knowledge/search` | 知识库向量搜索 |

## 业务工具

| 工具 | 功能 | 数据来源 |
|------|------|---------|
| `query_order` | 订单查询 | SQLite |
| `query_income` | 收入查询 | SQLite |
| `penalty_appeal` | 罚单查询/申诉 | SQLite |
| `search_knowledge` | 知识库搜索 | ChromaDB + SQLite |
| `query_weather` | 天气查询 | wttr.in API |
| `transfer_to_human` | 转人工客服 | 模拟 |

## 文档

详细设计文档位于 `doc/` 目录：

- [项目总览](./doc/项目总览.md) — 项目概览与开发计划
- [子智能体业务划分需求分析](./doc/子智能体业务划分需求分析.md) — 多 Agent 架构设计
- [智谱AI集成实现文档](./doc/智谱AI集成实现文档.md) — LLM 接入细节
- [RAG功能实现总结](./doc/RAG功能实现总结.md) — 知识库与向量检索
