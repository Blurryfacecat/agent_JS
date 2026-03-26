import { ChromaClient, Collection } from 'chromadb';
import { ZhipuEmbeddingFunction, TextChunker } from './embeddings';
import config from '@/config';
import logger from '@/utils/logger';

/**
 * 文档元数据接口
 */
export interface DocumentMetadata {
  category?: string;
  subcategory?: string;
  tags?: string[];
  priority?: number;
  source?: string;
  created_at?: string;
  updated_at?: string;
  document_id?: string;
  chunk_index?: number;
}

/**
 * 文档接口
 */
export interface Document {
  id: string;
  text: string;
  metadata?: DocumentMetadata;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  text: string;
  metadata?: DocumentMetadata;
  score: number; // 相似度分数 (0-1, 越高越相似)
}

/**
 * ChromaDB 服务类
 * 用于管理向量数据库和文档检索
 */
export class ChromaService {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private embedder: ZhipuEmbeddingFunction;
  private chunker: TextChunker;

  constructor() {
    // 初始化ChromaDB客户端
    this.client = new ChromaClient({
      path: config.chroma?.url || 'http://localhost:8000',
    });

    // 初始化嵌入函数
    this.embedder = new ZhipuEmbeddingFunction();

    // 初始化文本分块器
    this.chunker = new TextChunker(500, 50);

    logger.info('ChromaDB服务初始化完成');
  }

  /**
   * 初始化集合
   */
  async init(collectionName: string = 'rider_knowledge_base'): Promise<void> {
    try {
      // 获取或创建集合
      this.collection = await this.client.getOrCreateCollection({
        name: collectionName,
        metadata: {
          description: '外卖骑手知识库',
          created_at: new Date().toISOString(),
        },
        // 注意: 不在这里设置embeddingFunction,我们手动生成嵌入
      });

      const count = await this.collection.count();
      logger.info(`集合初始化成功: ${collectionName}, 文档数量: ${count}`);
    } catch (error: any) {
      logger.error('集合初始化失败:', error);
      throw new Error(`集合初始化失败: ${error.message}`);
    }
  }

  /**
   * 添加预分块的文档（不再次分块）
   */
  async addPreChunkedDocuments(
    items: Array<{ id: string; text: string; metadata?: DocumentMetadata }>
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      logger.info(`开始添加预分块文档,数量: ${items.length}`);

      const ids: string[] = [];
      const texts: string[] = [];
      const metadatas: DocumentMetadata[] = [];

      for (const item of items) {
        ids.push(item.id);
        texts.push(item.text);
        metadatas.push(item.metadata || {});
      }

      if (ids.length === 0) {
        throw new Error('没有有效的文档分块');
      }

      // 生成嵌入向量
      logger.info(`开始生成嵌入向量,文本数量: ${texts.length}`);
      const embeddings = await this.embedder.generate(texts);

      // 添加到集合
      await this.collection.add({
        ids,
        embeddings,
        documents: texts,
        metadatas: metadatas as any,
      });

      logger.info(`预分块文档添加成功,总块数: ${ids.length}`);
    } catch (error: any) {
      logger.error('添加预分块文档失败:', error);
      throw error;
    }
  }

  /**
   * 添加文档
   */
  async addDocuments(documents: Document[]): Promise<void> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      logger.info(`开始添加文档,数量: ${documents.length}`);

      const ids: string[] = [];
      const texts: string[] = [];
      const metadatas: DocumentMetadata[] = [];

      // 处理每个文档
      for (const doc of documents) {
        // 分块处理
        const chunks = this.chunker.chunkByParagraph(doc.text);

        for (let i = 0; i < chunks.length; i++) {
          const chunkId = `${doc.id}_chunk_${i}`;
          ids.push(chunkId);
          texts.push(chunks[i]);
          metadatas.push({
            ...doc.metadata,
            document_id: doc.id,
            chunk_index: i,
            created_at: new Date().toISOString(),
          });
        }
      }

      // 生成嵌入向量
      logger.info(`开始生成嵌入向量,文本数量: ${texts.length}`);
      const embeddings = await this.embedder.generate(texts);

      // 添加到集合
      await this.collection.add({
        ids,
        embeddings,
        documents: texts,
        metadatas: metadatas as any,
      });

      logger.info(`文档添加成功,总块数: ${ids.length}`);
    } catch (error: any) {
      logger.error('添加文档失败:', error);
      throw new Error(`添加文档失败: ${error.message}`);
    }
  }

  /**
   * 搜索相似文档
   */
  async search(
    query: string,
    topK: number = 3,
    filter?: Record<string, any>
  ): Promise<SearchResult[]> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      logger.info(`开始搜索,查询: "${query}", topK: ${topK}`);

      // 生成查询向量
      const queryEmbedding = await this.embedder.generateSingle(query);

      // 执行查询
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: topK,
        where: filter,
      });

      // 转换结果
      const searchResults: SearchResult[] = [];

      if (results.ids[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const distance = results.distances?.[0]?.[i] || 0;
          const score = 1 - distance; // 将距离转换为相似度分数

          searchResults.push({
            id: results.ids[0][i],
            text: results.documents[0][i] || '',
            metadata: results.metadatas[0][i] as DocumentMetadata,
            score,
          });
        }
      }

      logger.info(`搜索完成,返回结果数: ${searchResults.length}`);

      return searchResults;
    } catch (error: any) {
      logger.error('搜索失败:', error);
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 删除文档
   */
  async deleteDocuments(documentIds: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      logger.info(`开始删除文档,数量: ${documentIds.length}`);

      // 获取所有要删除的chunk ID
      const allIds = await this.collection.get();
      const chunkIds = allIds.ids.filter((id: string) =>
        documentIds.some(docId => id.startsWith(`${docId}_chunk_`))
      );

      if (chunkIds.length > 0) {
        await this.collection.delete({
          ids: chunkIds,
        });

        logger.info(`文档删除成功,删除块数: ${chunkIds.length}`);
      } else {
        logger.info('未找到要删除的文档');
      }
    } catch (error: any) {
      logger.error('删除文档失败:', error);
      throw new Error(`删除文档失败: ${error.message}`);
    }
  }

  /**
   * 更新文档
   */
  async updateDocuments(documents: Document[]): Promise<void> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      logger.info(`开始更新文档,数量: ${documents.length}`);

      // 先删除旧文档
      await this.deleteDocuments(documents.map(doc => doc.id));

      // 再添加新文档
      await this.addDocuments(documents);

      logger.info('文档更新成功');
    } catch (error: any) {
      logger.error('更新文档失败:', error);
      throw new Error(`更新文档失败: ${error.message}`);
    }
  }

  /**
   * 获取文档数量
   */
  async count(): Promise<number> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      const count = await this.collection.count();
      return count;
    } catch (error: any) {
      logger.error('获取文档数量失败:', error);
      throw new Error(`获取文档数量失败: ${error.message}`);
    }
  }

  /**
   * 清空集合
   */
  async clear(): Promise<void> {
    if (!this.collection) {
      throw new Error('集合未初始化,请先调用init()');
    }

    try {
      // 获取所有文档ID
      const all = await this.collection.get();

      if (all.ids.length > 0) {
        await this.collection.delete({
          ids: all.ids,
        });

        logger.info(`集合清空成功,删除文档数: ${all.ids.length}`);
      }
    } catch (error: any) {
      logger.error('清空集合失败:', error);
      throw new Error(`清空集合失败: ${error.message}`);
    }
  }
}

// 导出单例
export const chromaService = new ChromaService();
