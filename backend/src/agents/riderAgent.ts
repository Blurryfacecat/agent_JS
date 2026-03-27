/**
 * 骑手智能客服 - LangChain Agent 实现
 *
 * 基于智谱AI + LangChain 实现的多轮对话智能体
 * 支持工具调用和历史上下文记忆
 */

import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage } from "@langchain/core/messages";
import { riderTools } from "./tools";
import { zhipuLLMService } from "@/services/llm";
import { getSessionMessages, saveMessage } from "@/utils/db";
import logger from "@/utils/logger";

// 会话历史存储（生产环境应使用 Redis）
const sessionHistories = new Map<string, InMemoryChatMessageHistory>();

/**
 * 获取会话历史
 */
const getChatHistory = (sessionId: string): InMemoryChatMessageHistory => {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId)!;
};

/**
 * 从数据库加载会话历史到内存
 */
const loadSessionHistory = async (sessionId: string): Promise<void> => {
  const history = getChatHistory(sessionId);
  const messages = getSessionMessages(sessionId, 50);

  // 清空现有历史
  await history.clear();

  // 从数据库加载
  for (const msg of messages) {
    if (msg.role === "user") {
      await history.addUserMessage(msg.content);
    } else if (msg.role === "assistant") {
      await history.addAIMessage(msg.content);
    }
  }

  logger.debug("加载会话历史", { sessionId, messageCount: messages.length });
};

/**
 * 工具选择器 - 使用 LLM 智能选择工具
 */
const selectTool = async (
  userMessage: string,
): Promise<{ toolName: string | null; params: Record<string, any> }> => {
  // 构建工具列表描述
  const toolsInfo = riderTools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");

  const toolSelectionPrompt = `你是一个工具选择器。根据用户问题，判断是否需要调用工具。

可用工具：
${toolsInfo}

如果用户问题不需要调用任何工具（比如普通问候、感谢、闲聊等），返回：NO_TOOL
如果需要调用工具，返回：TOOL:工具名称

用户问题：${userMessage}

请只返回工具名称或 NO_TOOL，不要其他内容。`;

  try {
    const response = await zhipuLLMService.simpleChat(
      toolSelectionPrompt,
      "你是一个工具选择助手。",
    );

    const trimmed = response.trim();
    logger.info("工具选择结果", { userMessage, selection: trimmed });

    if (trimmed === "NO_TOOL" || !trimmed) {
      return { toolName: null, params: {} };
    }

    // 提取工具名称
    const toolName = trimmed.replace("TOOL:", "").trim();
    const validTool = riderTools.find((t) => t.name === toolName);

    if (validTool) {
      return { toolName, params: {} };
    }

    return { toolName: null, params: {} };
  } catch (error) {
    logger.error("工具选择失败", { error });
    return { toolName: null, params: {} };
  }
};

/**
 * 从历史消息构建对话上下文
 */
const buildChatContext = async (
  history: InMemoryChatMessageHistory,
): Promise<string> => {
  const messages = await history.getMessages();

  if (messages.length === 0) {
    return "";
  }

  // 只取最近的消息作为上下文
  const recentMessages = messages.slice(-10);
  const context = recentMessages
    .map((m: BaseMessage) => {
      // 使用 toDict() 或直接访问 content
      const content = String(m.content);
      // 使用 getType() 方法获取消息类型
      const role = m.constructor.name;
      if (role.includes("Human")) return `用户: ${content}`;
      if (role.includes("AI")) return `助手: ${content}`;
      if (role.includes("System")) return `系统: ${content}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");

  return `历史对话:\n${context}\n\n`;
};

/**
 * 系统提示词
 */
const SYSTEM_PROMPT = `你是一个外卖骑手智能客服助手。

你的职责：
1. 友好、专业地回答骑手的问题
2. 了解外卖配送、罚单申诉、订单异常、收入查询等相关业务
3. 用简洁、口语化的方式回复
4. 可以使用工具查询骑手的订单、收入等信息
5. 遇到无法解决的问题，建议转人工客服

回复风格：
- 友好亲切，像朋友一样交流
- 简洁明了，不要啰嗦
- 适当使用emoji让对话更生动`;

/**
 * 处理用户消息
 */
export const processMessage = async (
  riderId: string,
  sessionId: string,
  userMessage: string,
  location?: { latitude: number; longitude: number },
): Promise<string> => {
  try {
    // 加载会话历史
    await loadSessionHistory(sessionId);

    // 保存用户消息到数据库
    saveMessage({
      sessionId,
      userId: riderId,
      role: "user",
      content: userMessage,
    });

    // 获取历史
    const history = getChatHistory(sessionId);

    // 使用 LLM 智能选择工具
    const toolSelection = await selectTool(userMessage);

    let assistantReply: string;

    if (toolSelection.toolName) {
      // 调用工具
      logger.info("选择调用工具", { tool: toolSelection.toolName });
      const toolResult = await invokeTool(
        toolSelection.toolName,
        riderId,
        userMessage,
        location,
      );
      assistantReply = await generateReply(userMessage, toolResult);
    } else {
      // 直接对话，带上历史上下文
      const context = await buildChatContext(history);
      const fullPrompt = context + `用户当前问题: ${userMessage}`;
      assistantReply = await zhipuLLMService.simpleChat(
        fullPrompt,
        SYSTEM_PROMPT,
      );
    }

    // 保存助手回复到数据库
    saveMessage({
      sessionId,
      userId: riderId,
      role: "assistant",
      content: assistantReply,
    });

    // 更新内存历史
    await history.addUserMessage(userMessage);
    await history.addAIMessage(assistantReply);

    return assistantReply;
  } catch (error) {
    logger.error("处理消息失败", { sessionId, riderId, error });
    throw error;
  }
};

/**
 * 调用工具
 */
const invokeTool = async (
  toolName: string,
  riderId: string,
  userMessage: string,
  location?: { latitude: number; longitude: number },
): Promise<string> => {
  const tool = riderTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`工具 ${toolName} 不存在`);
  }

  // 根据工具类型准备输入参数
  let input: any = {};

  // 为不同工具添加特定参数
  switch (toolName) {
    case "query_order":
      input = { riderId, status: "all" };
      break;
    case "query_income":
      input = { riderId, period: "today" };
      break;
    case "penalty_appeal":
      input = { riderId, action: "query" };
      break;
    case "search_knowledge":
      input = { query: userMessage };
      break;
    case "transfer_to_human":
      input = { reason: userMessage, priority: "medium" };
      break;
    case "query_weather":
      input = { latitude: location?.latitude, longitude: location?.longitude };
      break;
  }

  // 调用工具的 func 函数而不是 invoke，避免类型问题
  const result = await (tool as any).func(input);
  logger.info("工具调用完成", { toolName, result });
  return result as string;
};

/**
 * 基于工具结果生成回复
 */
const generateReply = async (
  userMessage: string,
  toolResult: string,
): Promise<string> => {
  let toolData: any;
  try {
    toolData = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
  } catch (e) {
    toolData = { result: toolResult };
  }

  const summaryPrompt = `用户问题: ${userMessage}

工具返回结果:
${JSON.stringify(toolData, null, 2)}

请根据以上信息，用友好、口语化的方式回复用户。如果是查询结果，请清晰列出关键信息。
如果是操作成功，告知用户结果。
如果是错误信息，给出解决建议。`;

  return await zhipuLLMService.simpleChat(summaryPrompt, SYSTEM_PROMPT);
};

/**
 * 清除会话历史
 */
export const clearSessionHistory = (sessionId: string): void => {
  sessionHistories.delete(sessionId);
  logger.info("清除会话历史", { sessionId });
};

/**
 * 流式处理用户消息（异步生成器）
 * 每次 yield 一个文本片段，最后保存完整回复到数据库
 */
export async function* streamMessage(
  riderId: string,
  sessionId: string,
  userMessage: string,
  location?: { latitude: number; longitude: number },
): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'done'; messageId: number } | { type: 'error'; message: string }> {
  try {
    // 加载会话历史
    await loadSessionHistory(sessionId);

    // 保存用户消息到数据库
    saveMessage({
      sessionId,
      userId: riderId,
      role: "user",
      content: userMessage,
    });

    const history = getChatHistory(sessionId);

    // 使用 LLM 智能选择工具（同步阶段）
    const toolSelection = await selectTool(userMessage);

    let fullReply = '';

    if (toolSelection.toolName) {
      // 调用工具（同步阶段）
      logger.info("流式: 选择调用工具", { tool: toolSelection.toolName });
      const toolResult = await invokeTool(
        toolSelection.toolName,
        riderId,
        userMessage,
        location,
      );

      // 基于工具结果生成流式回复
      let toolData: any;
      try {
        toolData = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
      } catch {
        toolData = { result: toolResult };
      }

      const summaryPrompt = `用户问题: ${userMessage}

工具返回结果:
${JSON.stringify(toolData, null, 2)}

请根据以上信息，用友好、口语化的方式回复用户。如果是查询结果，请清晰列出关键信息。
如果是操作成功，告知用户结果。
如果是错误信息，给出解决建议。`;

      const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: summaryPrompt }];
      for await (const chunk of zhipuLLMService.streamChat(messages)) {
        fullReply += chunk;
        yield { type: 'chunk', content: chunk };
      }
    } else {
      // 直接对话，带上历史上下文
      const context = await buildChatContext(history);
      const fullPrompt = context + `用户当前问题: ${userMessage}`;
      const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: fullPrompt }];

      for await (const chunk of zhipuLLMService.streamChat(messages)) {
        fullReply += chunk;
        yield { type: 'chunk', content: chunk };
      }
    }

    // 保存完整助手回复到数据库
    const messageId = saveMessage({
      sessionId,
      userId: riderId,
      role: "assistant",
      content: fullReply,
    });

    // 更新内存历史
    await history.addUserMessage(userMessage);
    await history.addAIMessage(fullReply);

    yield { type: 'done', messageId };
  } catch (error: any) {
    logger.error("流式处理消息失败", { sessionId, riderId, error });
    yield { type: 'error', message: error.message || '处理消息失败' };
  }
}
