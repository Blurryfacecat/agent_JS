# 智谱AI集成说明

## 配置步骤

### 1. 获取智谱AI API Key

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 进入控制台,创建API Key
4. 复制API Key

### 2. 配置环境变量

编辑 `.env` 文件,填入你的智谱AI API Key:

```env
ZHIPU_API_KEY=你的实际API_Key
ZHIPU_MODEL=glm-4-flash
ZHIPU_TEMPERATURE=0.7
```

### 3. 启动服务

```bash
npm run dev
```

### 4. 测试对话接口

使用curl测试:

```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "test001",
    "message": "你好,我是外卖骑手,请问超时罚款怎么申诉?"
  }'
```

## 支持的模型

| 模型名称 | 说明 | 价格 |
|---------|------|------|
| `glm-4-flash` | 速响版本,适合对话 | 免费/低价 |
| `glm-4` | 标准版本 | 按tokens计费 |
| `glm-4-plus` | 增强版本 | 按tokens计费 |

建议开发环境使用 `glm-4-flash`,生产环境使用 `glm-4`。

## 功能特性

- ✅ 基础对话功能
- ✅ 支持自定义系统提示词
- ✅ 支持多轮对话(待实现上下文管理)
- ✅ 自动错误处理和降级
- ✅ 完整的日志记录

## 代码结构

```
src/services/llm.ts         # 智谱AI服务类
src/routes/chat.ts          # 对话接口(已集成LLM)
src/config/index.ts         # 配置文件
```

## 常见问题

### 1. API Key无效

错误信息: `智谱AI API Key无效`

解决: 检查 `.env` 文件中的 `ZHIPU_API_KEY` 是否正确

### 2. 网络超时

错误信息: `LLM服务异常: timeout`

解决: 检查网络连接,或增加 `src/services/llm.ts` 中的超时时间

### 3. 返回空响应

错误信息: `智谱AI返回空响应`

解决: 检查模型名称是否正确,或查看智谱AI控制台的配额

## 下一步

- [ ] 实现上下文管理(Redis存储对话历史)
- [ ] 集成LangChain意图识别
- [ ] 实现LangGraph工作流
- [ ] 添加流式输出支持
