# 🚀 智谱AI集成快速开始

## ✅ 已完成功能

- ✅ 智谱AI LLM服务封装
- ✅ 对话接口集成
- ✅ 自动错误处理和降级
- ✅ 完整日志记录
- ✅ 测试脚本

## 📝 配置步骤

### 1. 获取智谱AI API Key

访问 [智谱AI开放平台](https://open.bigmodel.cn/) 注册并获取API Key

### 2. 配置环境变量

编辑 `backend/.env` 文件:

```env
ZHIPU_API_KEY=你的真实API_Key
ZHIPU_MODEL=glm-4-flash
ZHIPU_TEMPERATURE=0.7
```

### 3. 重启服务

```bash
cd backend
npm run dev
```

### 4. 测试对话

```bash
node test-chat.js
```

## 📡 API使用

### 基础对话

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "test001",
    "message": "你好,请问超时罚款怎么申诉?"
  }'
```

### 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "riderId": "test001",
    "reply": "你好!关于超时罚款申诉,你可以...",
    "intent": "general",
    "timestamp": "2026-03-22T12:00:00.000Z",
    "model": "zhipu-glm"
  }
}
```

## 🔧 技术实现

### 核心文件

```
src/
├── services/
│   └── llm.ts              # 智谱AI服务类
├── routes/
│   └── chat.ts             # 对话接口(已集成)
├── config/
│   └── index.ts            # 配置文件
└── utils/
    ├── logger.ts           # 日志工具
    └── response.ts         # 响应工具
```

### ZhipuLLMService 类

```typescript
// 简单对话
const reply = await zhipuLLMService.simpleChat(
  "用户消息",
  "系统提示词"
);

// 多轮对话
const reply = await zhipuLLMService.multiChat(
  [
    { role: "user", content: "第一轮" },
    { role: "assistant", content: "回复1" },
    { role: "user", content: "第二轮" }
  ],
  "系统提示词"
);
```

## 📊 当前状态

✅ **基础功能** - 已实现
- 单轮对话
- 自定义系统提示词
- 错误处理和降级

⏳ **待实现** - 后续开发
- 多轮对话(需要上下文管理)
- 意图识别(LangChain)
- 业务工作流(LangGraph)
- 流式输出
- 对话历史持久化

## 🎯 下一步建议

1. **配置真实API Key** - 测试实际对话效果
2. **实现上下文管理** - 支持多轮对话
3. **添加意图识别** - 识别用户意图
4. **实现工作流** - 处理具体业务

## 📚 相关文档

- [智谱AI集成说明](./ZHIPU_INTEGRATION.md)
- [项目README](../README.md)
- [API文档](./API.md)

## ⚠️ 常见问题

### Q: 返回降级响应?
A: 需要配置真实的 `ZHIPU_API_KEY`

### Q: API Key无效?
A: 检查 `.env` 文件中的Key是否正确

### Q: 网络超时?
A: 检查网络连接,或增加超时时间

---

**状态**: ✅ 可以跑通
**下一步**: 配置真实API Key测试完整功能
