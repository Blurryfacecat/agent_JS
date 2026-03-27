# 骑手智能客服 Agent 分析与拓展方案

## 一、当前架构

```
用户消息 → 工具选择(LLM判断) → 工具调用(5个) → LLM生成回复
                ↓ 否
            带历史上下文直接对话
```

### 核心文件

- `src/agents/riderAgent.ts` — Agent 主逻辑（工具选择、会话管理、回复生成）
- `src/agents/tools/index.ts` — 工具函数集合（5个已注册工具）
- `src/services/documentProcessor.ts` — RAG 向量搜索（已接入 ChromaDB）

### 现有工具

| 工具 | 功能 | 数据来源 | 状态 |
|------|------|---------|------|
| `query_order` | 订单查询 | 模拟数据 | 待接入真实数据 |
| `query_income` | 收入查询 | 模拟数据 | 待接入真实数据 |
| `penalty_appeal` | 罚单申诉 | 模拟数据 | 待接入真实数据 |
| `search_knowledge` | 知识库搜索 | ChromaDB 向量搜索 | 已接入 |
| `transfer_to_human` | 转人工客服 | 模拟 | 待接入 |

### 现有问题

1. **工具选择只支持单工具** — `selectTool` 每次只能选一个工具，不能组合调用（比如同时查订单+知识库）
2. **会话历史用内存 Map** — 服务重启丢失，注释里也写了应该用 Redis
3. **历史上下文只取最近10条** — 长对话会丢失早期重要信息
4. **4个工具还是模拟数据** — 没有接入真实业务系统
5. **没有流式输出** — 用户需要等待完整回复生成，体验差

---

## 二、架构层面拓展

| 拓展方向 | 说明 | 优先级 |
|---------|------|--------|
| **流式输出(SSE)** | 用 `stream: true` 逐字输出，前端打字机效果 | 高 |
| **多轮工具调用** | 先查知识库确认规则，再查订单判断是否适用，最后生成回复 | 高 |
| **Redis 会话存储** | 替换 InMemoryMap，支持分布式部署和持久化 | 中 |
| **意图识别+槽位填充** | 识别"申诉"意图后追问罚单ID、申诉理由等槽位 | 中 |

### 2.1 流式输出(SSE)

当前 `processMessage` 返回完整字符串，改为流式：

```typescript
export async function* streamMessage(riderId, sessionId, userMessage) {
  // ... 工具选择逻辑不变

  const stream = await zhipuLLMService.streamChat(fullPrompt, SYSTEM_PROMPT);
  for await (const chunk of stream) {
    yield chunk;  // 逐字推送
  }
}
```

前端通过 `EventSource` 或 `fetch + ReadableStream` 接收。

### 2.2 多轮工具调用

将单次工具选择改为 Agent Loop：

```typescript
// 当前：选一次工具就结束
const toolSelection = await selectTool(userMessage);
if (toolSelection.toolName) { ... }

// 改进：最多循环3次，直到不需要工具或达到上限
let context = userMessage;
for (let i = 0; i < 3; i++) {
  const tool = await selectTool(context);
  if (!tool.toolName) break;
  const result = await invokeTool(tool.toolName, ...);
  context += `\n工具结果: ${result}`;
}
// 最后用累积的 context 生成最终回复
```

---

## 三、新增工具

| 工具名 | 功能 | 触发场景示例 |
|--------|------|------------|
| `query_weather` | 查天气 | "今天下雨要加配送费吗" |
| `query_location` | 查配送地址/导航 | "这个地址怎么走" |
| `submit_feedback` | 提交反馈/建议 | "我要反馈一个问题" |
| `report_accident` | 上报异常 | "配送出了事故" |
| `query_balance` | 查余额/提现 | "我账户还有多少钱" |
| `update_profile` | 修改个人信息 | "我要换手机号" |
| `query_schedule` | 查排班/在线时长 | "今天上了多少小时" |

### 3.1 天气查询工具示例

```typescript
export const queryWeatherTool = new DynamicStructuredTool({
  name: 'query_weather',
  description: `查询天气信息。当用户询问以下问题时使用：
  - "今天天气怎么样"
  - "下雨能送吗"
  - "恶劣天气加收什么费用"`,
  schema: z.object({
    city: z.string().describe('城市名称'),
  }),
  func: async ({ city }) => {
    // 调用天气 API
    const weather = await fetchWeatherAPI(city);
    return JSON.stringify(weather);
  },
});
```

### 3.2 提交反馈工具示例

```typescript
export const submitFeedbackTool = new DynamicStructuredTool({
  name: 'submit_feedback',
  description: `提交用户反馈或建议。当用户说：
  - "我要反馈"
  - "投诉一下"
  - "建议你们改进"`,
  schema: z.object({
    content: z.string().describe('反馈内容'),
    category: z.enum(['complaint', 'suggestion', 'bug']).describe('反馈类型'),
  }),
  func: async ({ content, category }) => {
    // 写入数据库 feedback 表
    saveFeedback({ riderId, content, category });
    return JSON.stringify({ success: true, message: '反馈已提交' });
  },
});
```

---

## 四、RAG 增强

| 拓展方向 | 说明 | 优先级 |
|---------|------|--------|
| **对话前自动 RAG** | 不依赖工具选择器，每次对话先检索相关知识注入 prompt | 高 |
| **混合检索** | 向量搜索 + 关键词搜索，提高召回率 | 中 |
| **Rerank 重排序** | 对检索结果做二次排序，提高准确率 | 中 |
| **来源引用** | 回复中标注"参考：配送规范第3条"，增加可信度 | 低 |

### 4.1 自动 RAG 注入

当前流程：LLM 决定是否调用 `search_knowledge` → 可能漏掉

改进流程：每次对话都先检索 → 将相关知识注入 system prompt

```typescript
export const processMessage = async (riderId, sessionId, userMessage) => {
  // 1. 自动检索相关知识（不依赖工具选择）
  const ragResults = await searchDocuments(userMessage, 3);
  const knowledgeContext = ragResults.length > 0
    ? `\n\n相关知识库内容:\n${ragResults.map(r => r.content).join('\n---\n')}`
    : '';

  // 2. 增强后的 system prompt
  const enhancedPrompt = SYSTEM_PROMPT + knowledgeContext;

  // 3. 后续流程不变...
};
```

### 4.2 混合检索

```typescript
const hybridSearch = async (query, topK) => {
  // 向量搜索（语义相似）
  const vectorResults = await chromaService.search(query, topK * 2);

  // 关键词搜索（精确匹配）
  const keywordResults = await dbSearch(query, topK * 2);

  // 合并去重
  const merged = mergeAndRank(vectorResults, keywordResults, topK);
  return merged;
};
```

---

## 五、体验优化

| 拓展方向 | 说明 | 优先级 |
|---------|------|--------|
| **满意度评价** | 每次回复后收集用户反馈 | 高（已建表） |
| **推荐问题联动** | 回复后根据上下文推荐相关问题 | 高 |
| **多模态** | 支持图片识别（拍罚单照片自动申诉） | 中 |
| **定时提醒** | "提醒我2小时后去取餐" | 低 |

### 5.1 满意度评价

数据库已有 `message_feedback` 表，需要：

1. 前端回复卡片增加 👍👎 按钮
2. 后端新增接口：`POST /api/v1/chat/feedback`
3. Agent 根据历史反馈调整回复策略

### 5.2 推荐问题联动

```typescript
// 回复时根据用户问题推荐相关问题
const getRelatedSuggestions = (userMessage, answer) => {
  const allSuggestions = getAllSuggestions(); // 从数据库获取
  // 用向量相似度匹配
  return allSuggestions
    .filter(s => s.is_active)
    .sort((a, b) => similarity(b.content, userMessage) - similarity(a.content, userMessage))
    .slice(0, 3);
};
```

---

## 六、实施建议

### 第一阶段（基础增强）

- [ ] 接入流式输出(SSE)
- [ ] 实现自动 RAG 注入（每次对话先检索）
- [ ] 满意度评价功能闭环
- [ ] Redis 会话存储替换内存 Map

### 第二阶段（工具增强）

- [ ] 新增天气查询工具
- [ ] 新增反馈提交工具
- [ ] 多轮工具调用（Agent Loop）
- [ ] 推荐问题联动

### 第三阶段（高级功能）

- [ ] 混合检索 + Rerank
- [ ] 意图识别 + 槽位填充
- [ ] 多模态支持（图片识别）
- [ ] 定时提醒功能
