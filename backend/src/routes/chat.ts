import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { processMessage } from '@/agents/riderAgent';
import { getSessionMessages } from '@/utils/db';

const router = Router();

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
    });

    // 使用 Agent 处理消息（包含工具调用、历史记录、数据库保存）
    let reply: string;
    try {
      reply = await processMessage(riderId, currentSessionId, message);
      logger.info('Agent 处理成功,回复长度:', reply.length);
    } catch (agentError: any) {
      logger.error('Agent 处理失败:', agentError.message);
      const errorMsg = `抱歉，我现在无法正常回复。${agentError.message}\n\n您可以稍后再试或联系人工客服`;
      return errorResponse(res, errorMsg, 503, 503);
    }

    const response = {
      riderId,
      sessionId: currentSessionId,
      reply,
      timestamp: new Date().toISOString(),
      model: 'rider-agent-v1',
    };

    logger.info('对话接口返回成功', {
      replyLength: reply.length,
      model: response.model,
    });

    successResponse(res, response, 'success');
  } catch (error: any) {
    logger.error('对话接口错误:', error);
    errorResponse(res, '处理请求失败', 500, 500);
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
