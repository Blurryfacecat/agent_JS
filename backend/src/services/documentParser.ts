/**
 * 文档解析服务
 * 支持解析 PDF、TXT、Markdown 等格式
 */

import fs from 'fs';
import path from 'path';
import logger from '@/utils/logger';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// CommonJS 模块导入
const __filename = fileURLToPath(import.meta.url);
const _require = createRequire(import.meta.url);
const pdf = _require('pdf-parse');

export interface ParseResult {
  content: string;
  metadata: {
    title?: string;
    author?: string;
    pages?: number;
    fileType: string;
  };
}

/**
 * 解析文档
 */
export const parseDocument = async (
  filePath: string,
  fileType: string,
): Promise<ParseResult> => {
  logger.info('开始解析文档', { filePath, fileType });

  try {
    switch (fileType) {
      case 'pdf':
        return await parsePDF(filePath);
      case 'txt':
        return await parseText(filePath);
      case 'md':
        return await parseMarkdown(filePath);
      default:
        throw new Error(`不支持的文件类型: ${fileType}`);
    }
  } catch (error) {
    logger.error('文档解析失败', { filePath, fileType, error });
    throw error;
  }
};

/**
 * 解析 PDF 文件
 */
const parsePDF = async (filePath: string): Promise<ParseResult> => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    // 提取文本内容
    let content = data.text;

    // 清理文本（移除过多空白）
    content = content
      .replace(/\s+\n/g, '\n')  // 移除行尾空白
      .replace(/\n{3,}/g, '\n\n')  // 最多保留两个换行
      .trim();

    logger.info('PDF 解析成功', {
      pages: data.numpages,
      contentLength: content.length,
    });

    return {
      content,
      metadata: {
        title: data.info?.Title || path.basename(filePath),
        author: data.info?.Author,
        pages: data.numpages,
        fileType: 'pdf',
      },
    };
  } catch (error) {
    throw new Error(`PDF 解析失败: ${error}`);
  }
};

/**
 * 解析纯文本文件
 */
const parseText = async (filePath: string): Promise<ParseResult> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    logger.info('TXT 解析成功', { contentLength: content.length });

    return {
      content,
      metadata: {
        title: path.basename(filePath, '.txt'),
        fileType: 'txt',
      },
    };
  } catch (error) {
    throw new Error(`TXT 解析失败: ${error}`);
  }
};

/**
 * 解析 Markdown 文件
 */
const parseMarkdown = async (filePath: string): Promise<ParseResult> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 提取 Markdown 标题作为文档标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : path.basename(filePath, '.md');

    logger.info('Markdown 解析成功', {
      title,
      contentLength: content.length,
    });

    return {
      content,
      metadata: {
        title,
        fileType: 'md',
      },
    };
  } catch (error) {
    throw new Error(`Markdown 解析失败: ${error}`);
  }
};

/**
 * 验证文件类型是否支持
 */
export const isSupportedFileType = (fileType: string): boolean => {
  const supportedTypes = ['pdf', 'txt', 'md'];
  return supportedTypes.includes(fileType.toLowerCase());
};

/**
 * 从文件名提取文件类型
 */
export const extractFileType = (fileName: string): string => {
  const ext = path.extname(fileName).toLowerCase().slice(1);
  return ext;
};
