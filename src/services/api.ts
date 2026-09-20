import OpenAI from 'openai';
import type { APIConfig, APIMessage } from '../types';

/**
 * 创建 OpenAI 客户端实例
 */
function createClient(config: APIConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    dangerouslyAllowBrowser: true, // 允许在浏览器中使用
  });
}

/**
 * 发送消息并获取流式响应
 * @param messages 消息数组
 * @param config API 配置
 * @returns 异步迭代器，产出响应内容片段
 */
export async function* sendMessageStream(
  messages: APIMessage[],
  config: APIConfig
): AsyncGenerator<string, void, unknown> {
  const client = createClient(config);
  
  const stream = await client.chat.completions.create({
    model: config.model,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: true,
  });
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * 发送消息并获取完整响应（非流式）
 * @param messages 消息数组
 * @param config API 配置
 * @returns 响应内容和使用统计
 */
export async function sendMessage(
  messages: APIMessage[],
  config: APIConfig
): Promise<{
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}> {
  const client = createClient(config);
  
  const response = await client.chat.completions.create({
    model: config.model,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  });
  
  const content = response.choices[0]?.message?.content || '';
  const usage = response.usage
    ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : undefined;
  
  return { content, usage };
}

/**
 * 验证 API Key 是否有效
 * @param apiKey API 密钥
 * @param baseUrl API 基础 URL
 * @returns 是否有效
 */
export async function validateAPIKeyOnline(
  apiKey: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      dangerouslyAllowBrowser: true,
    });
    
    // 发送一个简单的请求来验证 API Key
    await client.models.list();
    return true;
  } catch (error) {
    console.error('API Key validation failed:', error);
    return false;
  }
}

/**
 * 模型列表请求的默认超时时间（毫秒）
 */
export const MODEL_LIST_TIMEOUT = 10000;

/**
 * 模型列表请求超时错误
 * 用于与网络错误、鉴权错误等区分，便于界面给出明确提示
 */
export class ModelListTimeoutError extends Error {
  constructor(message = '获取模型列表超时，请稍后重试') {
    super(message);
    this.name = 'ModelListTimeoutError';
  }
}

/**
 * 为 Promise 增加超时限制
 * @param promise 原始 Promise
 * @param timeoutMs 超时时间（毫秒）
 * @returns 带超时限制的 Promise，超时后 reject ModelListTimeoutError
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ModelListTimeoutError());
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * 获取可用模型列表
 * @param apiKey API 密钥
 * @param baseUrl API 基础 URL
 * @param timeoutMs 超时时间（毫秒），默认 MODEL_LIST_TIMEOUT
 * @returns 模型 ID 列表
 * @throws ModelListTimeoutError 请求超时
 * @throws 请求失败时抛出原始错误，由调用方决定如何提示
 */
export async function fetchAvailableModels(
  apiKey: string,
  baseUrl: string,
  timeoutMs: number = MODEL_LIST_TIMEOUT
): Promise<string[]> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseUrl,
    dangerouslyAllowBrowser: true,
  });

  const response = await withTimeout(client.models.list(), timeoutMs);
  return response.data.map(model => model.id);
}
