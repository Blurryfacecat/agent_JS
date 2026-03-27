import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { processMessage, streamMessage } from '@/agents/riderAgent';
import { getSessionMessages, saveMessage } from '@/utils/db';

const router = Router();

/** 从请求头提取骑手经纬度 */
function parseLocationFromHeaders(req: Request) {
  const lat = req.headers['x-rider-latitude'];
  const lng = req.headers['x-rider-longitude'];
  if (lat && lng) {
    return { latitude: Number(lat), longitude: Number(lng) };
  }
  return undefined;
}

interface ChatRequest {
  riderId: string;
  message: string;
  sessionId?: string;
}

/**
 * 对话接口 (已集成智谱AI)
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { riderId, message, sessionId }: ChatRequest = req.body;
    const location = parseLocationFromHeaders(req);

    // 基础参数校验
    if (!riderId || !message) {
      return errorResponse(res, '缺少必要参数: riderId或message', 400, 400);
    }

    // 生成或使用现有 sessionId
    const currentSessionId = sessionId || `session_${Date.now()}_${riderId}`;

    logger.info(`收到对话请求`, {
      riderId,
      message,
      sessionId: currentSessionId,
      location,
    });

    // 保存用户消息
    saveMessage({
      sessionId: currentSessionId,
      userId: riderId,
      role: 'user',
      content: message,
    });

    // 使用 Agent 处理消息（包含工具调用、历史记录、数据库保存）
    let reply: string;
    try {
      reply = await processMessage(riderId, currentSessionId, message, location);
      logger.info('Agent 处理成功,回复长度:', reply.length);
    } catch (agentError: any) {
      logger.error('Agent 处理失败:', agentError.message);
      const errorMsg = `抱歉，我现在无法正常回复。${agentError.message}\n\n您可以稍后再试或联系人工客服`;
      return errorResponse(res, errorMsg, 503, 503);
    }

    // 保存助手回复并获取消息ID
    saveMessage({
      sessionId: currentSessionId,
      userId: riderId,
      role: 'assistant',
      content: reply,
    });

    // 获取最新消息的数据库ID（助手回复）
    const messages = getSessionMessages(currentSessionId);
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();

    const response = {
      riderId,
      sessionId: currentSessionId,
      reply,
      messageId: lastAssistantMessage?.id, // 返回数据库消息ID用于反馈
      timestamp: new Date().toISOString(),
      model: 'rider-agent-v1',
    };

    logger.info('对话接口返回成功', {
      replyLength: reply.length,
      messageId: lastAssistantMessage?.id,
      model: response.model,
    });

    successResponse(res, response, 'success');
  } catch (error: any) {
    logger.error('对话接口错误:', error);
    errorResponse(res, '处理请求失败', 500, 500);
  }
});

/**
 * 流式对话接口 (SSE)
 */
router.post('/chat/stream', async (req: Request, res: Response) => {
  const { riderId, message, sessionId }: ChatRequest = req.body;
  const location = parseLocationFromHeaders(req);

  if (!riderId || !message) {
    return errorResponse(res, '缺少必要参数: riderId或message', 400, 400);
  }

  const currentSessionId = sessionId || `session_${Date.now()}_${riderId}`;

  logger.info(`收到流式对话请求`, {
    riderId,
    message,
    sessionId: currentSessionId,
    location,
  });

  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 发送 session 事件
  res.write(`event: session\ndata: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

  try {
    const generator = streamMessage(riderId, currentSessionId, message, location);

    for await (const event of generator) {
      if (event.type === 'chunk') {
        res.write(`event: message\ndata: ${JSON.stringify({ content: event.content })}\n\n`);
      } else if (event.type === 'done') {
        res.write(`event: done\ndata: ${JSON.stringify({ messageId: event.messageId })}\n\n`);
        logger.info('流式对话完成', { messageId: event.messageId });
      } else if (event.type === 'error') {
        res.write(`event: error\ndata: ${JSON.stringify({ message: event.message })}\n\n`);
      }
    }

    res.end();
  } catch (error: any) {
    logger.error('流式对话接口错误:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: '服务异常' })}\n\n`);
    res.end();
  }
});

/**
 * 获取会话历史接口
 */
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    logger.info(`查询会话历史`, { sessionId });

    const messages = getSessionMessages(sessionId);

    const sessionData = {
      sessionId,
      messages,
      messageCount: messages.length,
    };

    successResponse(res, sessionData);
  } catch (error: any) {
    logger.error('获取会话历史错误:', error);
    errorResponse(res, '获取会话失败', 500, 500);
  }
});

export default router;
