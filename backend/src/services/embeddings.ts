import axios, { AxiosInstance } from "axios";
import config from "@/config";
import logger from "@/utils/logger";

/**
 * 智谱AI嵌入函数
 * 用于将文本转换为向量表示
 */
export class ZhipuEmbeddingFunction {
  private client: AxiosInstance;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.zhipu.apiKey;
    this.model = "embedding-3"; // 智谱AI嵌入模型 (2048维)

    if (!this.apiKey) {
      throw new Error("智谱AI API Key未配置");
    }

    this.client = axios.create({
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    logger.info("智谱AI嵌入函数初始化完成");
  }

  /**
   * 生成文本嵌入向量
   */
  async generate(texts: string[]): Promise<number[][]> {
    try {
      logger.info(`开始生成嵌入向量,文本数量: ${texts.length}`);

      const embeddings: number[][] = [];

      // 智谱AI的embedding API每次只支持一个文本
      for (const text of texts) {
        const response = await this.client.post("/embeddings", {
          model: this.model,
          input: text,
        });

        if (response.data.data && response.data.data.length > 0) {
          const embedding = response.data.data[0].embedding;
          embeddings.push(embedding);
        } else {
          throw new Error("智谱AI未返回嵌入向量");
        }
      }

      logger.info(`嵌入向量生成成功,维度: ${embeddings[0]?.length || 0}`);

      return embeddings;
    } catch (error: any) {
      logger.error("智谱AI嵌入向量生成失败:", {
        message: error.message,
        response: error.response?.data,
      });

      throw new Error(`嵌入向量生成失败: ${error.message}`);
    }
  }

  /**
   * 生成单个文本的嵌入向量
   */
  async generateSingle(text: string): Promise<number[]> {
    const embeddings = await this.generate([text]);
    return embeddings[0];
  }
}

/**
 * 文本分块工具
 * 将长文本分割成适合嵌入的小块
 */
export class TextChunker {
  private maxChunkSize: number;
  private overlap: number;

  constructor(maxChunkSize: number = 500, overlap: number = 50) {
    this.maxChunkSize = maxChunkSize;
    this.overlap = overlap;
  }

  /**
   * 按字符数分割文本
   */
  chunkByCharacter(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.maxChunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk.trim());

      start += this.maxChunkSize - this.overlap;
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  /**
   * 按段落分割文本
   */
  chunkByParagraph(text: string): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > this.maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 按句子分割文本
   */
  chunkBySentence(text: string): string[] {
    const sentences = text.split(/([。！？.!?])/);
    const chunks: string[] = [];
    let currentChunk = "";

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || "");

      if (currentChunk.length + sentence.length > this.maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
