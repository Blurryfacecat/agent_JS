import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';

const router = Router();

interface ChatRequest {
  riderId: string;
  message: string;
  sessionId?: string;
}

/**
 * 对话接口 (基础版本,后续集成LangChain)
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { riderId, message, sessionId }: ChatRequest = req.body;

    // 基础参数校验
    if (!riderId || !message) {
      return errorResponse(res, '缺少必要参数: riderId或message', 400, 400);
    }

    logger.info(`收到对话请求`, {
      riderId,
      message,
      sessionId,
    });

    // TODO: 集成LangChain意图识别
    // TODO: 集成LangGraph工作流
    // TODO: 集成上下文管理

    // 临时返回测试响应
    const response = {
      riderId,
      reply: `收到你的消息: ${message}`,
      intent: 'general',
      timestamp: new Date().toISOString(),
    };

    successResponse(res, response, 'success');
  } catch (error: any) {
    logger.error('对话接口错误:', error);
    errorResponse(res, '处理请求失败', 500, 500);
  }
});

/**
 * 获取会话历史接口
 */
router.get('/session/:riderId', async (req: Request, res: Response) => {
  try {
    const { riderId } = req.params;

    logger.info(`查询会话历史`, { riderId });

    // TODO: 从Redis获取会话历史

    const sessionData = {
      riderId,
      messages: [],
      sessionId: `temp-${riderId}`,
      createdAt: new Date().toISOString(),
    };

    successResponse(res, sessionData);
  } catch (error: any) {
    logger.error('获取会话历史错误:', error);
    errorResponse(res, '获取会话失败', 500, 500);
  }
});

export default router;
