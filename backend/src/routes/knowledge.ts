import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { chromaService, Document } from '@/services/chroma';
import { getSQLiteDB } from '@/utils/db';

const router = Router();

// ==================== ChromaDB 向量知识库接口 ====================

/**
 * 初始化知识库
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const { collectionName = 'rider_knowledge_base' } = req.body;

    logger.info(`初始化知识库: ${collectionName}`);

    await chromaService.init(collectionName);

    const count = await chromaService.count();

    successResponse(res, {
      collectionName,
      documentCount: count,
      message: '知识库初始化成功',
    });
  } catch (error: any) {
    logger.error('初始化知识库失败:', error);
    errorResponse(res, `初始化失败: ${error.message}`, 500, 500);
  }
});

/**
 * 添加文档到知识库
 */
router.post('/documents', async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return errorResponse(res, '缺少documents参数或格式错误', 400, 400);
    }

    logger.info(`添加文档到知识库,数量: ${documents.length}`);

    await chromaService.addDocuments(documents as Document[]);

    const count = await chromaService.count();

    successResponse(res, {
      addedCount: documents.length,
      totalDocuments: count,
      message: '文档添加成功',
    });
  } catch (error: any) {
    logger.error('添加文档失败:', error);
    errorResponse(res, `添加失败: ${error.message}`, 500, 500);
  }
});

/**
 * 搜索知识库
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, topK = 3, filter } = req.body;

    if (!query) {
      return errorResponse(res, '缺少query参数', 400, 400);
    }

    logger.info(`搜索知识库,查询: "${query}", topK: ${topK}`);

    const results = await chromaService.search(query, topK, filter);

    successResponse(res, {
      query,
      results,
      count: results.length,
      message: '搜索成功',
    });
  } catch (error: any) {
    logger.error('搜索失败:', error);
    errorResponse(res, `搜索失败: ${error.message}`, 500, 500);
  }
});

/**
 * 更新文档
 */
router.put('/documents', async (req: Request, res: Response) => {
  try {
    const { documents } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return errorResponse(res, '缺少documents参数或格式错误', 400, 400);
    }

    logger.info(`更新文档,数量: ${documents.length}`);

    await chromaService.updateDocuments(documents as Document[]);

    successResponse(res, {
      updatedCount: documents.length,
      message: '文档更新成功',
    });
  } catch (error: any) {
    logger.error('更新文档失败:', error);
    errorResponse(res, `更新失败: ${error.message}`, 500, 500);
  }
});

/**
 * 删除文档
 */
router.delete('/documents', async (req: Request, res: Response) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds)) {
      return errorResponse(res, '缺少documentIds参数或格式错误', 400, 400);
    }

    logger.info(`删除文档,数量: ${documentIds.length}`);

    await chromaService.deleteDocuments(documentIds);

    const count = await chromaService.count();

    successResponse(res, {
      deletedCount: documentIds.length,
      remainingDocuments: count,
      message: '文档删除成功',
    });
  } catch (error: any) {
    logger.error('删除文档失败:', error);
    errorResponse(res, `删除失败: ${error.message}`, 500, 500);
  }
});

/**
 * 获取知识库统计信息
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const count = await chromaService.count();

    successResponse(res, {
      totalDocuments: count,
      message: '获取统计信息成功',
    });
  } catch (error: any) {
    logger.error('获取统计信息失败:', error);
    errorResponse(res, `获取失败: ${error.message}`, 500, 500);
  }
});

/**
 * 清空知识库
 */
router.delete('/clear', async (_req: Request, res: Response) => {
  try {
    logger.info('清空知识库');

    await chromaService.clear();

    successResponse(res, {
      message: '知识库已清空',
    });
  } catch (error: any) {
    logger.error('清空知识库失败:', error);
    errorResponse(res, `清空失败: ${error.message}`, 500, 500);
  }
});

// ==================== SQLite 知识库管理接口 ====================

/**
 * 获取知识库列表（支持分页和搜索）
 * GET /api/v1/knowledge/entries
 */
router.get('/entries', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      category,
      search
    } = req.query;

    const db = getSQLiteDB();
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (category) {
      whereClause += ' AND category = ?';
      params.push(category as string);
    }

    if (search) {
      whereClause += ' AND (title LIKE ? OR content LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // 查询总数
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total
      FROM knowledge
      ${whereClause}
    `);
    const countResult = countStmt.get(...params) as { total: number };

    // 查询列表
    const listStmt = db.prepare(`
      SELECT id, title, category, content, source, created_at, updated_at
      FROM knowledge
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const list = listStmt.all(...params, limitNum, offset);

    // 获取内容预览（前100字符）
    const listWithPreview = list.map((item: any) => ({
      ...item,
      content_preview: item.content ? item.content.substring(0, 100) + (item.content.length > 100 ? '...' : '') : '',
      content_length: item.content ? item.content.length : 0,
    }));

    successResponse(res, {
      list: listWithPreview,
      total: countResult.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(countResult.total / limitNum),
    });
  } catch (error: any) {
    logger.error('获取知识库列表失败:', error);
    errorResponse(res, '获取知识库列表失败', 500, 500);
  }
});

/**
 * 获取知识库统计
 * GET /api/v1/knowledge/entries/stats
 * 注意：必须在 /entries/:id 之前定义，否则会被 :id 路由拦截
 */
router.get('/entries/stats', async (_req: Request, res: Response) => {
  try {
    const db = getSQLiteDB();

    // 总数
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM knowledge');
    const { count: total } = totalStmt.get() as { count: number };

    // 按分类统计
    const categoryStmt = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM knowledge
      GROUP BY category
      ORDER BY count DESC
    `);
    const byCategory = categoryStmt.all();

    // 最近更新
    const recentStmt = db.prepare(`
      SELECT updated_at
      FROM knowledge
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const lastUpdate = recentStmt.get() as { updated_at: string } | undefined;

    successResponse(res, {
      total,
      byCategory,
      lastUpdate,
    });
  } catch (error: any) {
    logger.error('获取知识库统计失败:', error);
    errorResponse(res, '获取知识库统计失败', 500, 500);
  }
});

/**
 * 获取知识库详情
 * GET /api/v1/knowledge/entries/:id
 */
router.get('/entries/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    const db = getSQLiteDB();
    const stmt = db.prepare(`
      SELECT id, title, category, content, source, created_at, updated_at
      FROM knowledge
      WHERE id = ?
    `);

    const knowledge = stmt.get(id);

    if (!knowledge) {
      return errorResponse(res, '知识库条目不存在', 404, 404);
    }

    successResponse(res, knowledge);
  } catch (error: any) {
    logger.error('获取知识库详情失败:', error);
    errorResponse(res, '获取知识库详情失败', 500, 500);
  }
});

/**
 * 创建知识库条目
 * POST /api/v1/knowledge/entries
 */
router.post('/entries', async (req: Request, res: Response) => {
  try {
    const { title, category, content, source } = req.body;

    // 参数校验
    if (!title || !content) {
      return errorResponse(res, '缺少必要参数: title 或 content', 400, 400);
    }

    logger.info(`创建知识库条目`, { title, category });

    const db = getSQLiteDB();
    const stmt = db.prepare(`
      INSERT INTO knowledge (title, category, content, source)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(title, category || null, content, source || null);
    const insertId = result.lastInsertRowid as number;

    // 获取插入的数据
    const selectStmt = db.prepare(`
      SELECT id, title, category, content, source, created_at, updated_at
      FROM knowledge
      WHERE id = ?
    `);
    const inserted = selectStmt.get(insertId);

    logger.info('知识库条目创建成功', { id: insertId });
    successResponse(res, inserted, 'knowledge created successfully');
  } catch (error: any) {
    logger.error('创建知识库条目失败:', error);
    errorResponse(res, '创建知识库条目失败', 500, 500);
  }
});

/**
 * 更新知识库条目
 * PUT /api/v1/knowledge/entries/:id
 */
router.put('/entries/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    const { title, category, content, source } = req.body;

    logger.info(`更新知识库条目`, { id, title, category });

    const db = getSQLiteDB();

    // 检查是否存在
    const checkStmt = db.prepare('SELECT id FROM knowledge WHERE id = ?');
    const exists = checkStmt.get(id);
    if (!exists) {
      return errorResponse(res, '知识库条目不存在', 404, 404);
    }

    // 构建更新语句
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (source !== undefined) {
      updates.push('source = ?');
      values.push(source);
    }

    if (updates.length === 0) {
      return errorResponse(res, '没有要更新的字段', 400, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`
      UPDATE knowledge
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    // 获取更新后的数据
    const selectStmt = db.prepare(`
      SELECT id, title, category, content, source, created_at, updated_at
      FROM knowledge
      WHERE id = ?
    `);
    const updated = selectStmt.get(id);

    logger.info('知识库条目更新成功', { id });
    successResponse(res, updated, 'knowledge updated successfully');
  } catch (error: any) {
    logger.error('更新知识库条目失败:', error);
    errorResponse(res, '更新知识库条目失败', 500, 500);
  }
});

/**
 * 删除知识库条目
 * DELETE /api/v1/knowledge/entries/:id
 */
router.delete('/entries/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return errorResponse(res, '无效的 ID', 400, 400);
    }

    logger.info(`删除知识库条目`, { id });

    const db = getSQLiteDB();

    // 检查是否存在
    const checkStmt = db.prepare('SELECT id FROM knowledge WHERE id = ?');
    const exists = checkStmt.get(id);
    if (!exists) {
      return errorResponse(res, '知识库条目不存在', 404, 404);
    }

    const stmt = db.prepare('DELETE FROM knowledge WHERE id = ?');
    stmt.run(id);

    logger.info('知识库条目删除成功', { id });
    successResponse(res, { id, message: '知识库条目删除成功' });
  } catch (error: any) {
    logger.error('删除知识库条目失败:', error);
    errorResponse(res, '删除知识库条目失败', 500, 500);
  }
});

/**
 * 获取知识库分类列表
 * GET /api/v1/knowledge/categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const db = getSQLiteDB();
    const stmt = db.prepare(`
      SELECT DISTINCT category
      FROM knowledge
      WHERE category IS NOT NULL
      ORDER BY category
    `);

    const categories = stmt.all() as { category: string }[];

    successResponse(res, {
      categories: categories.map(c => c.category),
      count: categories.length,
    });
  } catch (error: any) {
    logger.error('获取知识库分类失败:', error);
    errorResponse(res, '获取知识库分类失败', 500, 500);
  }
});

export default router;
