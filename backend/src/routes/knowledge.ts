import { Router, Request, Response } from 'express';
import { successResponse, errorResponse } from '@/utils/response';
import logger from '@/utils/logger';
import { chromaService, Document } from '@/services/chroma';

const router = Router();

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

export default router;
