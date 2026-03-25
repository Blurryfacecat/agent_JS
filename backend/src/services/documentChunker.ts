/**
 * 文档分块服务
 * 将文档内容分割成适合向量化的小块
 */

import { ragConfig } from '@/config/rag';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/utils/logger';

export interface Chunk {
  chunkId: string;
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  docId: string;
  chunkIndex: number;
  title?: string;
  category?: string;
  chunkSize: number;
  startPosition?: number;
  endPosition?: number;
}

/**
 * 分块策略
 */
export enum ChunkStrategy {
  FIXED_SIZE = 'fixed_size',      // 固定大小
  PARAGRAPH = 'paragraph',         // 按段落
  SENTENCE = 'sentence',           // 按句子
  SEMANTIC = 'semantic',           // 语义分块（需要额外支持）
}

/**
 * 文档分块
 */
export const chunkDocument = async (
  docId: string,
  content: string,
  title?: string,
  category?: string,
  strategy: ChunkStrategy = ChunkStrategy.FIXED_SIZE,
): Promise<Chunk[]> => {
  logger.info('开始文档分块', {
    docId,
    contentLength: content.length,
    strategy,
  });

  let chunks: Chunk[];

  switch (strategy) {
    case ChunkStrategy.FIXED_SIZE:
      chunks = chunkByFixedSize(docId, content, title, category);
      break;
    case ChunkStrategy.PARAGRAPH:
      chunks = chunkByParagraph(docId, content, title, category);
      break;
    case ChunkStrategy.SENTENCE:
      chunks = chunkBySentence(docId, content, title, category);
      break;
    default:
      chunks = chunkByFixedSize(docId, content, title, category);
  }

  logger.info('文档分块完成', {
    docId,
    chunkCount: chunks.length,
  });

  return chunks;
};

/**
 * 固定大小分块
 */
const chunkByFixedSize = (
  docId: string,
  content: string,
  title?: string,
  category?: string,
): Chunk[] => {
  const chunks: Chunk[] = [];
  const chunkSize = ragConfig.chunkSize;
  const overlap = ragConfig.chunkOverlap;
  const minChunkSize = ragConfig.minChunkSize;

  let startPosition = 0;
  let chunkIndex = 0;

  while (startPosition < content.length) {
    // 计算当前块的结束位置
    let endPosition = startPosition + chunkSize;

    // 如果不是最后一块，尝试在边界处找到合适的断点
    if (endPosition < content.length) {
      // 优先在换行符处断开
      const breakPoint = findBreakPoint(content, endPosition, ['\n\n', '\n', '。', '！', '？', '.', '!', '?']);
      if (breakPoint > startPosition + minChunkSize) {
        endPosition = breakPoint;
      }
    } else {
      endPosition = content.length;
    }

    // 提取分块内容
    const chunkContent = content.slice(startPosition, endPosition).trim();

    // 跳过太短的块
    if (chunkContent.length >= minChunkSize) {
      chunks.push({
        chunkId: `chunk_${uuidv4()}`,
        chunkIndex,
        content: chunkContent,
        metadata: {
          docId,
          chunkIndex,
          title,
          category,
          chunkSize: chunkContent.length,
          startPosition,
          endPosition,
        },
      });

      chunkIndex++;
    }

    // 移动到下一个块（考虑重叠）
    startPosition = endPosition - overlap;

    // 避免无限循环
    if (startPosition >= endPosition) {
      startPosition = endPosition;
    }
  }

  return chunks;
};

/**
 * 按段落分块
 */
const chunkByParagraph = (
  docId: string,
  content: string,
  title?: string,
  category?: string,
): Chunk[] => {
  const chunks: Chunk[] = [];
  const paragraphs = content.split(/\n\n+/);
  const chunkSize = ragConfig.chunkSize;

  let currentChunk = '';
  let chunkIndex = 0;
  let startPosition = 0;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // 如果当前段落加入后超过块大小，保存当前块
    if (currentChunk && currentChunk.length + trimmed.length > chunkSize) {
      if (currentChunk.length >= ragConfig.minChunkSize) {
        chunks.push({
          chunkId: `chunk_${uuidv4()}`,
          chunkIndex,
          content: currentChunk.trim(),
          metadata: {
            docId,
            chunkIndex,
            title,
            category,
            chunkSize: currentChunk.length,
            startPosition,
          },
        });
        chunkIndex++;
        startPosition += currentChunk.length;
      }
      currentChunk = trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }
  }

  // 保存最后一个块
  if (currentChunk.length >= ragConfig.minChunkSize) {
    chunks.push({
      chunkId: `chunk_${uuidv4()}`,
      chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        docId,
        chunkIndex,
        title,
        category,
        chunkSize: currentChunk.length,
        startPosition,
      },
    });
  }

  return chunks;
};

/**
 * 按句子分块
 */
const chunkBySentence = (
  docId: string,
  content: string,
  title?: string,
  category?: string,
): Chunk[] => {
  const chunks: Chunk[] = [];
  const chunkSize = ragConfig.chunkSize;

  // 使用正则表达式分割句子
  const sentences = content.match(/[^。！？.!?]+[。！？.!?]*/g) || [content];

  let currentChunk = '';
  let chunkIndex = 0;
  let startPosition = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    // 如果当前句子加入后超过块大小，保存当前块
    if (currentChunk && currentChunk.length + trimmed.length > chunkSize) {
      if (currentChunk.length >= ragConfig.minChunkSize) {
        chunks.push({
          chunkId: `chunk_${uuidv4()}`,
          chunkIndex,
          content: currentChunk.trim(),
          metadata: {
            docId,
            chunkIndex,
            title,
            category,
            chunkSize: currentChunk.length,
            startPosition,
          },
        });
        chunkIndex++;
        startPosition += currentChunk.length;
      }
      currentChunk = trimmed;
    } else {
      currentChunk += trimmed;
    }
  }

  // 保存最后一个块
  if (currentChunk.length >= ragConfig.minChunkSize) {
    chunks.push({
      chunkId: `chunk_${uuidv4()}`,
      chunkIndex,
      content: currentChunk.trim(),
      metadata: {
        docId,
        chunkIndex,
        title,
        category,
        chunkSize: currentChunk.length,
        startPosition,
      },
    });
  }

  return chunks;
};

/**
 * 在指定位置附近找到合适的断点
 */
const findBreakPoint = (
  content: string,
  position: number,
  delimiters: string[],
): number => {
  const searchRange = 100; // 在 position 前后 100 字符范围内搜索
  const start = Math.max(0, position - searchRange);
  const end = Math.min(content.length, position + searchRange);

  // 从 position 向前搜索最近的断点
  for (let i = position; i >= start; i--) {
    for (const delimiter of delimiters) {
      if (content.slice(i, i + delimiter.length) === delimiter) {
        return i + delimiter.length;
      }
    }
  }

  // 如果没找到，从 position 向后搜索
  for (let i = position; i <= end; i++) {
    for (const delimiter of delimiters) {
      if (content.slice(i, i + delimiter.length) === delimiter) {
        return i + delimiter.length;
      }
    }
  }

  // 都没找到，返回原位置
  return position;
};

/**
 * 合并小片段到相邻块
 */
export const mergeSmallChunks = (chunks: Chunk[], minSize: number = 100): Chunk[] => {
  const merged: Chunk[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // 如果当前块太小，合并到下一个块
    if (chunk.content.length < minSize && i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      nextChunk.content = chunk.content + '\n\n' + nextChunk.content;
      nextChunk.chunkIndex = chunk.chunkIndex;
      nextChunk.metadata.chunkSize = nextChunk.content.length;
      // 跳过下一个块
      i++;
    }

    merged.push(chunk);
  }

  return merged;
};
