/**
 * 猜你想问路由
 * 处理快捷建议的增删改查操作
 */

import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import {
  createSuggestion,
  updateSuggestion,
  deleteSuggestion,
  getSuggestions,
  incrementSuggestionClick,
  getSuggestionById,
  getAllSuggestions,
} from '@/utils/db';

const router = Router();

interface CreateSuggestionRequest {
  title: string;
  content: string;
  icon?: string;
  category?: string;
  sortOrder?: number;
}

interface UpdateSuggestionRequest {
  title?: string;
  content?: string;
  icon?: string;
  category?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * 获取猜你想问列表（前端用户使用）
 * GET /api/v1/suggestions
 * query: category, limit, random
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, limit, random } = req.query;

    logger.info(`获取猜你想问列表`, { category, limit, random });

    const suggestions = getSuggestions({
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      random: random === 'true',
    });

    successResponse(res, {
      suggestions,
      count: suggestions.length,
    });
  } catch (error: any) {
    logger.error('获取猜你想问列表失败:', error);
    errorResponse(res, '获取猜你想问列表失败', 500, 500);
  }
});

/**
 * 获取猜你想问详情
 * GET /api/v1/suggestions/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    logger.info(`查询猜你想问详情`, { id });

    const suggestion = getSuggestionById(id);

    if (!suggestion) {
      return errorResponse(res, '猜你想问不存在', 404, 404);
    }

    successResponse(res, suggestion);
  } catch (error: any) {
    logger.error('获取猜你想问详情失败:', error);
    errorResponse(res, '获取猜你想问详情失败', 500, 500);
  }
});

/**
 * 创建猜你想问（管理员使用）
 * POST /api/v1/suggestions
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, content, icon, category, sortOrder }: CreateSuggestionRequest = req.body;

    // 参数校验
    if (!title || !content) {
      return errorResponse(res, '缺少必要参数: title 或 content', 400, 400);
    }

    logger.info(`创建猜你想问`, { title, category, sortOrder });

    const suggestionId = createSuggestion({
      title,
      content,
      icon,
      category,
      sortOrder,
    });

    const suggestion = getSuggestionById(suggestionId);

    logger.info('猜你想问创建成功', { suggestionId });
    successResponse(res, suggestion, 'suggestion created successfully');
  } catch (error: any) {
    logger.error('创建猜你想问失败:', error);
    errorResponse(res, '创建猜你想问失败', 500, 500);
  }
});

/**
 * 更新猜你想问（管理员使用）
 * PUT /api/v1/suggestions/:id
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    const { title, content, icon, category, sortOrder, isActive }: UpdateSuggestionRequest = req.body;

    logger.info(`更新猜你想问`, { id, title, category, isActive });

    const updated = updateSuggestion({
      id,
      title,
      content,
      icon,
      category,
      sortOrder,
      isActive,
    });

    if (!updated) {
      return errorResponse(res, '猜你想问不存在或更新失败', 404, 404);
    }

    const suggestion = getSuggestionById(id);

    logger.info('猜你想问更新成功', { id });
    successResponse(res, suggestion, 'suggestion updated successfully');
  } catch (error: any) {
    logger.error('更新猜你想问失败:', error);
    errorResponse(res, '更新猜你想问失败', 500, 500);
  }
});

/**
 * 删除猜你想问（管理员使用）
 * DELETE /api/v1/suggestions/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    logger.info(`删除猜你想问`, { id });

    const deleted = deleteSuggestion(id);

    if (!deleted) {
      return errorResponse(res, '猜你想问不存在', 404, 404);
    }

    logger.info('猜你想问删除成功', { id });
    successResponse(res, { id, message: '猜你想问删除成功' });
  } catch (error: any) {
    logger.error('删除猜你想问失败:', error);
    errorResponse(res, '删除猜你想问失败', 500, 500);
  }
});

/**
 * 记录点击次数
 * POST /api/v1/suggestions/:id/click
 */
router.post('/:id/click', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    logger.info(`记录猜你想问点击`, { id });

    const updated = incrementSuggestionClick(id);

    if (!updated) {
      return errorResponse(res, '猜你想问不存在', 404, 404);
    }

    successResponse(res, { message: '点击记录成功' });
  } catch (error: any) {
    logger.error('记录点击失败:', error);
    errorResponse(res, '记录点击失败', 500, 500);
  }
});

/**
 * 获取所有猜你想问（管理员使用，支持分页）
 * GET /api/v1/suggestions/admin/list
 * query: page, limit, category
 */
router.get('/admin/list', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const category = req.query.category as string | undefined;

    logger.info(`管理员查询猜你想问列表`, { page, limit, category });

    const result = getAllSuggestions({ page, limit, category });

    successResponse(res, result);
  } catch (error: any) {
    logger.error('获取猜你想问列表失败:', error);
    errorResponse(res, '获取猜你想问列表失败', 500, 500);
  }
});

/**
 * 批量创建猜你想问（初始化使用）
 * POST /api/v1/suggestions/batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { suggestions } = req.body;

    if (!suggestions || !Array.isArray(suggestions)) {
      return errorResponse(res, '缺少 suggestions 参数或格式错误', 400, 400);
    }

    logger.info(`批量创建猜你想问`, { count: suggestions.length });

    const createdIds: number[] = [];

    for (const suggestion of suggestions) {
      const id = createSuggestion({
        title: suggestion.title,
        content: suggestion.content,
        icon: suggestion.icon,
        category: suggestion.category,
        sortOrder: suggestion.sortOrder,
      });
      createdIds.push(id);
    }

    logger.info('批量创建猜你想问成功', { count: createdIds.length });
    successResponse(res, {
      createdCount: createdIds.length,
      ids: createdIds,
    });
  } catch (error: any) {
    logger.error('批量创建猜你想问失败:', error);
    errorResponse(res, '批量创建猜你想问失败', 500, 500);
  }
});

export default router;
