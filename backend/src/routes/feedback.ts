import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { saveFeedback, getFeedbackByMessageId, getFeedbackStats } from '@/utils/db';

const router = Router();

interface FeedbackRequest {
  messageId: number;
  isHelpful: boolean;
}

/**
 * 提交用户反馈（好/不好）
 * POST /api/v1/feedback
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { messageId, isHelpful }: FeedbackRequest = req.body;

    // 参数校验
    if (!messageId || typeof isHelpful !== 'boolean') {
      return errorResponse(res, '缺少必要参数: messageId 或 isHelpful', 400, 400);
    }

    logger.info(`收到反馈提交`, { messageId, isHelpful });

    // 保存反馈
    const feedbackId = saveFeedback({
      messageId,
      isHelpful,
    });

    const response = {
      feedbackId,
      messageId,
      isHelpful,
      timestamp: new Date().toISOString(),
    };

    logger.info('反馈保存成功', { feedbackId });
    successResponse(res, response, 'feedback submitted successfully');
  } catch (error: any) {
    logger.error('提交反馈错误:', error);
    errorResponse(res, '提交反馈失败', 500, 500);
  }
});

/**
 * 获取指定消息的反馈
 * GET /api/v1/feedback/message/:messageId
 */
router.get('/message/:messageId', async (req: Request, res: Response) => {
  try {
    const messageId = parseInt(req.params.messageId);

    if (isNaN(messageId)) {
      return errorResponse(res, '无效的 messageId', 400, 400);
    }

    logger.info(`查询消息反馈`, { messageId });

    const feedback = getFeedbackByMessageId(messageId);

    if (!feedback) {
      return errorResponse(res, '未找到该消息的反馈', 404, 404);
    }

    successResponse(res, {
      ...feedback,
      isHelpful: feedback.is_helpful === 1,
    });
  } catch (error: any) {
    logger.error('获取反馈错误:', error);
    errorResponse(res, '获取反馈失败', 500, 500);
  }
});

/**
 * 获取反馈统计信息
 * GET /api/v1/feedback/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = getFeedbackStats();

    successResponse(res, {
      totalFeedbacks: stats.total,
      helpfulCount: stats.helpful_count,
      notHelpfulCount: stats.not_helpful_count,
      helpfulRate: stats.total > 0
        ? ((stats.helpful_count / stats.total) * 100).toFixed(2) + '%'
        : '0%',
    });
  } catch (error: any) {
    logger.error('获取反馈统计错误:', error);
    errorResponse(res, '获取反馈统计失败', 500, 500);
  }
});

export default router;
