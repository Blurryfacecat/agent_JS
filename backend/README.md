# 外卖骑手智能客服系统 - 后端服务

基于 Node.js + Express + LangChain + LangGraph 构建的智能客服后端系统。

## 技术栈

- **运行时**: Node.js 20+
- **框架**: Express 4.x
- **语言**: TypeScript 5.x
- **AI框架**: LangChain.js, LangGraph
- **数据库**: MySQL 8.0, Redis
- **日志**: Winston

## 项目结构

```
backend/
├── src/
│   ├── config/          # 配置文件
│   ├── middleware/      # 中间件
│   ├── routes/          # 路由
│   ├── utils/           # 工具函数
│   ├── services/        # 业务服务(后续添加)
│   ├── agents/          # AI Agent(后续添加)
│   ├── workflows/       # LangGraph工作流(后续添加)
│   ├── index.ts         # App类
│   └── server.ts        # 入口文件
├── logs/                # 日志目录
├── dist/                # 编译输出
├── .env.example         # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置:

\`\`\`bash
cp .env.example .env
\`\`\`

编辑 `.env` 文件,配置以下必要参数:

\`\`\`env
# 服务器配置
NODE_ENV=development
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rider_cs

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key_here
\`\`\`

### 3. 启动服务

开发模式(支持热重载):

\`\`\`bash
npm run dev
\`\`\`

生产模式:

\`\`\`bash
npm run build
npm start
\`\`\`

### 4. 测试接口

服务启动后,访问以下地址测试:

- 健康检查: http://localhost:3000/health
- 版本信息: http://localhost:3000/version

## API接口文档

### 基础信息

- **Base URL**: `http://localhost:3000/api/v1`
- **响应格式**: JSON

### 核心接口

#### 1. 健康检查

\`\`\`
GET /health
\`\`\`

**响应示例**:

\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": {
    "status": "ok",
    "timestamp": "2026-03-22T10:30:00.000Z",
    "uptime": 123.456,
    "environment": "development"
  }
}
\`\`\`

#### 2. 对话接口

\`\`\`
POST /api/v1/chat
\`\`\`

**请求参数**:

\`\`\`json
{
  "riderId": "rider001",
  "message": "我要申诉罚单123456",
  "sessionId": "optional-session-id"
}
\`\`\`

**响应示例**:

\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": {
    "riderId": "rider001",
    "reply": "收到你的消息: 我要申诉罚单123456",
    "intent": "general",
    "timestamp": "2026-03-22T10:30:00.000Z"
  }
}
\`\`\`

#### 3. 获取会话历史

\`\`\`
GET /api/v1/session/:riderId
\`\`\`

**响应示例**:

\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": {
    "riderId": "rider001",
    "messages": [],
    "sessionId": "temp-rider001",
    "createdAt": "2026-03-22T10:30:00.000Z"
  }
}
\`\`\`

## 开发计划

- [x] 项目初始化和基础配置
- [x] Express服务器搭建
- [x] 日志系统实现
- [x] 健康检查接口
- [x] 对话接口基础版本
- ] LangChain意图识别
- ] LangGraph工作流
- ] 上下文管理
- ] RAG知识库
- ] 完整业务逻辑

## 注意事项

1. **数据库**: 首次运行前需要创建MySQL数据库 `rider_cs`
2. **Redis**: 确保Redis服务已启动
3. **OpenAI**: 需要配置有效的API密钥才能使用AI功能
4. **日志**: 生产环境日志文件会按天自动切割

## 许可证

MIT
