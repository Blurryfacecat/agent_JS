import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { saveFeedback, getFeedbackByMessageId, getFeedbackList } from '@/utils/db';

const router = Router();

interface FeedbackRequest {
  messageId: number;
  rating: number;
}

/**
 * 提交用户反馈
 * POST /api/feedback
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { messageId, rating }: FeedbackRequest = req.body;

    // 参数校验
    if (!messageId || !rating) {
      return errorResponse(res, '缺少必要参数: messageId 或 rating', 400, 400);
    }

    if (rating < 1 || rating > 5) {
      return errorResponse(res, '评分必须在1-5之间', 400, 400);
    }

    logger.info(`收到反馈提交`, { messageId, rating });

    // 保存反馈
    const feedbackId = saveFeedback({
      messageId,
      rating,
    });

    const response = {
      feedbackId,
      messageId,
      rating,
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
 * GET /api/feedback/message/:messageId
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

    successResponse(res, feedback);
  } catch (error: any) {
    logger.error('获取反馈错误:', error);
    errorResponse(res, '获取反馈失败', 500, 500);
  }
});

/**
 * 获取反馈列表（支持分页）
 * GET /api/feedback/list
 * query: page, limit, minRating, maxRating
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;
    const maxRating = req.query.maxRating ? parseInt(req.query.maxRating as string) : undefined;

    logger.info(`查询反馈列表`, { page, limit, minRating, maxRating });

    const result = getFeedbackList({
      page,
      limit,
      minRating,
      maxRating,
    });

    successResponse(res, result);
  } catch (error: any) {
    logger.error('获取反馈列表错误:', error);
    errorResponse(res, '获取反馈列表失败', 500, 500);
  }
});

/**
 * 获取反馈统计信息
 * GET /api/feedback/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const db = (await import('@/utils/db')).getSQLiteDB();

    // 平均评分
    const avgRating = db.prepare('SELECT AVG(rating) as avg FROM feedback').get() as { avg: number };

    // 总反馈数
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM feedback').get() as { count: number };

    // 各评分分布
    const distribution = db.prepare(`
      SELECT rating, COUNT(*) as count
      FROM feedback
      GROUP BY rating
      ORDER BY rating
    `).all();

    // 今日反馈数
    const todayCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM feedback
      WHERE DATE(created_at) = DATE('now')
    `).get() as { count: number };

    const stats = {
      averageRating: avgRating.avg || 0,
      totalFeedbacks: totalCount.count,
      todayFeedbacks: todayCount.count,
      ratingDistribution: distribution,
    };

    successResponse(res, stats);
  } catch (error: any) {
    logger.error('获取反馈统计错误:', error);
    errorResponse(res, '获取反馈统计失败', 500, 500);
  }
});

export default router;
