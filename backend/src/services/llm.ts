import axios, { AxiosInstance } from 'axios';
import config from '@/config';
import logger from '@/utils/logger';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 智谱AI LLM服务类
 */
export class ZhipuLLMService {
  private client: AxiosInstance;
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor() {
    this.apiKey = config.zhipu.apiKey;
    this.model = config.zhipu.model;
    this.temperature = config.zhipu.temperature;

    if (!this.apiKey) {
      logger.warn('⚠️  智谱AI API Key未配置,LLM功能将不可用');
    }

    this.client = axios.create({
      baseURL: config.zhipu.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * 基础对话方法
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('智谱AI API Key未配置');
    }

    try {
      logger.info('发送请求到智谱AI', {
        model: this.model,
        messagesCount: messages.length,
      });

      const response = await this.client.post<ChatResponse>('', {
        model: this.model,
        messages,
        temperature: options?.temperature ?? this.temperature,
        max_tokens: options?.maxTokens || 2000,
      });

      if (response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content;

        logger.info('智谱AI响应成功', {
          usage: response.data.usage,
          finishReason: response.data.choices[0].finish_reason,
        });

        return content;
      }

      throw new Error('智谱AI返回空响应');
    } catch (error: any) {
      logger.error('智谱AI请求失败', {
        message: error.message,
        response: error.response?.data,
      });

      if (error.response?.status === 401) {
        throw new Error('智谱AI API Key无效');
      }

      throw new Error(`LLM服务异常: ${error.message}`);
    }
  }

  /**
   * 简单对话(单轮)
   */
  async simpleChat(
    userMessage: string,
    systemPrompt?: string
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    return this.chat(messages);
  }

  /**
   * 多轮对话
   */
  async multiChat(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push(...conversationHistory);

    return this.chat(messages);
  }

  /**
   * 流式对话方法
   * 智谱AI SSE格式：每行 data: {"choices":[{"delta":{"content":"xx"}}]}\n\n
   * 结束标志：data: [DONE]
   */
  async *streamChat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): AsyncGenerator<string> {
    if (!this.apiKey) {
      throw new Error('智谱AI API Key未配置');
    }

    logger.info('发送流式请求到智谱AI', {
      model: this.model,
      messagesCount: messages.length,
    });

    const response = await axios.post(
      config.zhipu.apiUrl,
      {
        model: this.model,
        messages,
        stream: true,
        temperature: options?.temperature ?? this.temperature,
        max_tokens: options?.maxTokens || 2000,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        responseType: 'stream',
      },
    );

    const stream = response.data;
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  }

  /**
   * 更换模型
   */
  setModel(model: string): void {
    this.model = model;
    logger.info(`模型已切换为: ${model}`);
  }

  /**
   * 更换温度参数
   */
  setTemperature(temperature: number): void {
    this.temperature = temperature;
    logger.info(`温度参数已设置为: ${temperature}`);
  }
}

// 导出单例
export const zhipuLLMService = new ZhipuLLMService();
