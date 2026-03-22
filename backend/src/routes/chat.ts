import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { zhipuLLMService } from '@/services/llm';

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

    logger.info(`收到对话请求`, {
      riderId,
      message,
      sessionId,
    });

    // 调用智谱AI生成回复
    const systemPrompt = `你是一个外卖骑手智能客服助手,名字叫"小骑"。你的职责是:
1. 友好、专业地回答骑手的问题
2. 了解外卖配送、罚单申诉、订单异常、收入查询等相关业务
3. 用简洁、口语化的方式回复
4. 如果遇到无法回答的问题,建议联系人工客服

请用中文回复,保持友好和专业的态度。`;

    let reply: string;
    try {
      logger.info('开始调用智谱AI...');
      reply = await zhipuLLMService.simpleChat(message, systemPrompt);
      logger.info('智谱AI调用成功,回复长度:', reply.length);
    } catch (llmError: any) {
      logger.error('LLM调用失败,返回503错误:', llmError.message);
      const errorMsg = `抱歉,我现在无法正常回复。${llmError.message}

您可以:
1. 检查API Key是否配置正确
2. 稍后再试
3. 联系人工客服`;

      return errorResponse(res, errorMsg, 503, 503);
    }

    const response = {
      riderId,
      reply,
      intent: 'general', // 暂时固定为general,后续添加意图识别
      timestamp: new Date().toISOString(),
      model: 'zhipu-glm',
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
