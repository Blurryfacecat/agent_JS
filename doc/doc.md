# 外卖骑手智能客服系统 详细设计说明书

本文档为**毕业设计完整版详细设计**，整合**上下文管理、LangChain意图识别、LangGraph业务工作流、RAG知识库、日志系统**全模块，遵循软件工程规范，包含架构、模块、数据、流程、接口、异常、部署全维度设计，可直接用于论文撰写。

## 一、系统概述

### 1.1 系统定位

本系统是基于 **Node.js + LangChain.js + LangGraph** 构建的**外卖骑手专属智能客服系统**，实现骑手咨询的**意图自动识别、业务工作流智能调度、多轮对话上下文持久化、私有知识精准检索**，覆盖罚单申诉、订单异常上报、收入查询三大核心业务，解决传统客服响应慢、重复提问、流程繁琐的痛点。

### 1.2 设计目标

1. **意图识别准确率≥95%**，支持骑手口语化提问；
2. **一键触发业务工作流**，无需手动操作；
3. **上下文永不丢失**，支持多设备同步、模糊指代；
4. **响应时间≤2秒**，满足骑手高峰期使用需求；
5. **模块化可扩展**，新增业务无需重构核心代码。

### 1.3 技术栈总览

| 层级        | 技术选型                              |
| ----------- | ------------------------------------- |
| 后端框架    | Node.js 20 + Express 4.x              |
| AI核心框架  | LangChain.js v0.2 + LangGraph         |
| 大模型服务  | OpenAI GPT-3.5-turbo（对话/意图识别） |
| 向量存储    | Chroma 本地向量库                     |
| 缓存/上下文 | Redis（加密存储+持久化）              |
| 业务数据库  | MySQL 8.0                             |
| 日志系统    | Winston + 按天切割文件                |

---

## 二、总体架构详细设计

采用**6层分层架构 + 7大核心业务模块**，解耦清晰、易于维护，符合企业级开发规范。

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│  接入层：API接口、请求校验、跨域处理、鉴权           │
├─────────────────────────────────────────────────────┤
│  调度层：意图识别、LangGraph路由、会话分发           │
├─────────────────────────────────────────────────────┤
│  核心层：智能Agent、上下文管理、业务工作流执行        │
├─────────────────────────────────────────────────────┤
│  支撑层：RAG知识库、工具函数、数据解析               │
├─────────────────────────────────────────────────────┤
│  存储层：MySQL、Redis、Chroma、日志文件              │
├─────────────────────────────────────────────────────┤
│  基础设施层：异常处理、日志记录、监控告警、定时任务   │
└─────────────────────────────────────────────────────┘
```

### 2.2 核心模块总图

1. **意图识别与路由模块**（核心调度）
2. **上下文管理模块**（对话持久化）
3. **LangGraph业务工作流模块**（3大核心业务）
4. **智能对话Agent模块**（自然语言交互）
5. **RAG知识库模块**（规则检索）
6. **日志系统模块**（全链路审计）
7. **API接口模块**（前端对接）

---

## 三、核心模块详细设计

### 3.1 意图识别与路由模块（LangChain + LangGraph 核心）

**核心职责**：解析骑手提问 → 标准化意图 → 路由至对应LangGraph工作流。

#### 3.1.1 子模块划分

1. **意图分类子模块**：LLM零样本分类，支持4类意图；
2. **实体提取子模块**：自动提取订单号、罚单ID、骑手ID；
3. **路由决策子模块**：根据意图调度LangGraph工作流；
4. **结果校验子模块**：置信度过滤，低置信度转人工。

#### 3.1.2 数据结构定义

```typescript
// 意图枚举
export enum UserIntent {
  PENALTY_APPEAL = "penalty_appeal", // 罚单申诉
  ORDER_ISSUE = "order_issue", // 异常上报
  INCOME_QUERY = "income_query", // 收入查询
  GENERAL = "general", // 普通咨询(RAG)
}

// 意图识别输出标准结构
export interface IntentResult {
  intent: UserIntent;
  confidence: number; // 置信度0-1
  entities: {
    riderId?: string;
    orderNo?: string;
    penaltyId?: string;
    reason?: string;
    date?: string;
  };
  needWorkflow: boolean; // 是否启动工作流
  transferHuman: boolean; // 是否转人工
}
```

#### 3.1.3 核心执行流程

```
骑手提问 → 上下文注入 → LLM意图识别 → 实体提取 → 置信度校验
  ↓
路由决策：
  罚单申诉 → 罚单申诉工作流
  异常上报 → 异常上报工作流
  收入查询 → 收入查询工作流
  普通咨询 → RAG检索回答
  低置信度 → 人工接管
```

#### 3.1.4 核心代码（LangChain 意图链）

```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";

// 低温度保证意图稳定性
const model = new ChatOpenAI({ temperature: 0.1, modelName: "gpt-3.5-turbo" });

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是外卖骑手客服意图识别器，输出固定JSON格式，提取实体、判断意图、置信度",
  ],
  ["human", "用户问题：{question}\n对话历史：{chatHistory}"],
]);

// 意图识别链
export const intentChain = prompt
  .pipe(model)
  .pipe(new JsonOutputParser<IntentResult>());
```

---

### 3.2 LangGraph 业务工作流模块

**核心职责**：将三大核心业务封装为独立工作流，支持可视化、断点续跑、异常回滚。

#### 3.2.1 统一状态定义（全局共享上下文）

```typescript
export interface WorkflowState {
  riderId: string; // 骑手ID
  question: string; // 用户提问
  intentResult: IntentResult; // 意图结果
  entities: Record<string, any>; // 业务实体
  messages: any[]; // 对话历史
  stepStatus: string; // 流程步骤
  result: any; // 执行结果
  error?: string; // 异常信息
}
```

#### 3.2.2 三大工作流详细设计

##### （1）罚单申诉工作流

**流程**：参数校验 → 罚单查询 → 申诉理由补充 → 提交申诉 → 结果反馈
**节点**：`checkParams` → `queryPenalty` → `fillReason` → `submitAppeal` → `feedback`

##### （2）订单异常上报工作流

**流程**：订单校验 → 异常类型选择 → 上传凭证 → 提交上报 → 进度通知
**节点**：`verifyOrder` → `selectIssueType` → `uploadEvidence` → `submitReport` → `notify`

##### （3）收入查询工作流

**流程**：时间筛选 → 收入统计 → 明细查询 → 数据汇总 → 口语化输出
**节点**：`parseDate` → `statIncome` → `queryDetail` → `summary` → `formatOutput`

#### 3.2.3 主调度图（Supervisor）

```typescript
import { StateGraph, END } from "@langchain/langgraph";

// 构建主工作流
const supervisorGraph = new StateGraph<WorkflowState>()
  .addNode("intent", intentNode) // 意图识别
  .addNode("penalty", penaltyWorkflow) // 罚单申诉
  .addNode("order", orderWorkflow) // 异常上报
  .addNode("income", incomeWorkflow) // 收入查询
  .addNode("rag", ragNode) // 普通问答
  // 条件路由
  .addConditionalEdges("intent", routerFn)
  .addEdge("penalty", END)
  .addEdge("order", END)
  .addEdge("income", END)
  .addEdge("rag", END);

export const supervisor = supervisorGraph.compile();
```

---

### 3.3 上下文管理模块（深化完整版）

**核心职责**：会话持久化、多设备同步、模糊指代、状态管控，解决骑手重复输入问题。

#### 3.3.1 五层架构

1. 会话存储层（Redis加密存储）
2. 信息提取层（正则+LLM提取实体）
3. 更新维护层（过期清理、数据备份）
4. 状态管控层（正常/等待/人工/暂停）
5. 多设备同步层（版本控制防冲突）

#### 3.3.2 Redis 存储结构（Key-Value）

```
Key: rider:session:{骑手ID}
Value: {
  sessionId: "uuid-xxx",      // 会话ID
  chatHistory: [...],         // 对话历史
  entities: {orderNo, penaltyId}, // 业务实体
  status: "normal",           // 会话状态
  deviceId: "device-xxx",     // 设备标识
  version: 1,                 // 版本号（防冲突）
  createTime: "2026-03-22",
  expireTime: 1800            // 30分钟过期
}
```

#### 3.3.3 核心功能

1. **自动提取**：订单号、罚单ID正则匹配；
2. **模糊指代**：识别「刚才那单」「那笔罚单」自动关联；
3. **多设备同步**：实时同步+版本控制；
4. **状态切换**：等待信息、人工接管、会话暂停；
5. **数据安全**：AES加密存储，每日备份。

---

### 3.4 其余核心模块简要设计

#### 3.4.1 智能对话Agent模块

- 基于LangChain构建，接收工作流结果生成口语化回答；
- 绑定上下文，支持多轮对话；
- 兜底机制：异常时返回标准话术。

#### 3.4.2 RAG知识库模块

- 文档：PDF/Word/TXT解析；
- 分割：递归字符分割，适配中文；
- 检索：混合检索（向量+关键词）；
- 存储：Chroma向量库。

#### 3.4.3 日志系统模块

- 6大类日志：API、对话、工作流、RAG、异常、审计；
- 存储：文件按天切割+MySQL审计日志；
- 脱敏：手机号、身份证加密隐藏；
- 告警：错误频率超限自动提醒。

#### 3.4.4 API接口模块

- RESTful风格，统一响应格式；
- 鉴权：骑手ID校验；
- 核心接口：对话接口、工作流回调、知识库管理、日志查询。

---

## 四、数据存储详细设计

### 4.1 MySQL 业务表设计（核心表）

1. **rider_info（骑手信息表）**：骑手ID、手机号、站点ID；
2. **order_info（订单表）**：订单号、骑手ID、状态、金额；
3. **penalty_info（罚单表）**：罚单ID、订单号、扣款金额、原因；
4. **appeal_record（申诉记录表）**：申诉ID、罚单ID、状态、处理结果；
5. **audit_log（审计日志表）**：操作人、操作类型、时间、业务数据。

### 4.2 Redis 存储设计

1. 会话上下文：`rider:session:{riderId}`（30分钟过期）；
2. 工作流临时状态：`workflow:state:{sessionId}`；
3. 高频缓存：订单/罚单信息（5分钟过期）。

### 4.3 Chroma 向量库设计

- 集合名：`rider-customer-service-kb`；
- 元数据：分类、上传时间、文档名称；
- 向量维度：1536（OpenAI Embedding）。

---

## 五、核心业务数据流设计

### 5.1 罚单申诉完整数据流

```
骑手：我要申诉罚单123456
  ↓
API接收 → 上下文管理提取罚单ID → 意图识别（penalty_appeal）
  ↓
LangGraph路由 → 启动罚单申诉工作流
  ↓
校验罚单 → 补充申诉理由 → 提交申诉 → 数据库写入记录
  ↓
Agent生成回答 → 上下文更新 → 返回骑手
```

### 5.2 普通咨询数据流

```
骑手：超时扣款规则是什么
  ↓
意图识别（general）→ 路由RAG模块
  ↓
向量检索 → 匹配知识库规则 → 生成回答
  ↓
返回骑手 → 记录对话日志
```

---

## 六、接口详细设计

### 6.1 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "sessionId": "uuid-xxx"
}
```

### 6.2 核心接口

1. **POST /api/chat**：对话入口（支持意图识别+工作流）；
2. **POST /api/workflow/callback**：工作流步骤回调；
3. **GET /api/session/info**：获取当前会话上下文；
4. **POST /api/rag/upload**：知识库文档上传；
5. **GET /api/log/query**：日志查询（管理员）。

---

## 七、异常处理详细设计

### 7.1 全局异常分类

1. **业务异常**：订单不存在、罚单无效、参数缺失；
2. **系统异常**：Redis断开、大模型调用失败、工作流中断；
3. **权限异常**：未登录、非法访问；
4. **第三方异常**：向量库超时、数据库连接失败。

### 7.2 处理策略

1. 业务异常：友好提示，引导补充信息；
2. 系统异常：自动重试（3次），失败转人工；
3. 全局捕获：统一返回格式，记录错误日志；
4. 工作流异常：断点续跑，保留上下文。

---

## 八、非功能详细设计

### 8.1 性能设计

- 会话查询：≤100ms；
- 意图识别：≤500ms；
- 整体响应：≤2s；
- 并发支持：100QPS。

### 8.2 安全设计

- 敏感数据AES加密；
- 请求鉴权，防止越权；
- 日志脱敏，保护隐私；
- 文件上传病毒扫描。

### 8.3 可靠性设计

- Redis混合持久化，防止数据丢失；
- 会话每日备份，支持恢复；
- 服务熔断降级，核心功能可用。

---

## 九、部署架构详细设计

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  前端（H5） │───→│ Nginx 反向代理 │───→│ Node.js服务  │
└─────────────┘    └─────────────┘    └─────────────┘
                                              ↓
              ┌─────────┬─────────┬─────────┐
              │ Redis   │ MySQL   │ Chroma  │
              └─────────┴─────────┴─────────┘
                      ↓
              ┌─────────────────┐
              │ 日志文件服务器   │
              └─────────────────┘
```

---

## 十、设计亮点（毕业设计专用）

1. **LLM零样本意图识别**：无需训练，适配骑手口语化提问；
2. **LangGraph工作流编排**：三大业务可视化、可监控、可扩展；
3. **上下文全链路管理**：多设备同步、模糊指代、状态管控；
4. **模块化架构**：低耦合，新增业务仅需添加工作流；
5. **全链路日志审计**：可追溯、可排查、满足合规要求。

---

### 总结

本详细设计完整覆盖**系统架构、核心模块、数据存储、业务流程、接口、异常、部署**全维度内容，深度整合 **LangChain意图识别 + LangGraph工作流 + 上下文管理** 三大核心技术，完全符合外卖骑手智能客服的业务场景，**可直接作为毕业设计论文的「详细设计」章节使用**。

我可以为你生成：

1. 系统架构**Visio/流程图**（论文插图）；
2. 三大业务工作流**时序图**；
3. 全套**数据库建表SQL**；
4. 完整可运行的**项目代码**。
