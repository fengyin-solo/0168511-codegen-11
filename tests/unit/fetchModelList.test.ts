import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock openai 模块，避免真实网络请求
const { listMock, constructorSpy, MockAPIConnectionTimeoutError } = vi.hoisted(() => {
  class MockAPIConnectionTimeoutError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'APIConnectionTimeoutError';
    }
  }
  return {
    listMock: vi.fn(),
    constructorSpy: vi.fn(),
    MockAPIConnectionTimeoutError,
  };
});

vi.mock('openai', () => {
  class MockOpenAI {
    static APIConnectionTimeoutError = MockAPIConnectionTimeoutError;
    models = { list: listMock };
    constructor(options: Record<string, unknown>) {
      constructorSpy(options);
    }
  }
  return { default: MockOpenAI };
});

import { fetchModelList, isTimeoutError, MODELS_FETCH_TIMEOUT } from '../../src/services/api';

describe('fetchModelList', () => {
  beforeEach(() => {
    listMock.mockReset();
    constructorSpy.mockClear();
  });

  it('将响应数据映射为模型列表', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'model-a' }, { id: 'model-b' }],
    });

    const result = await fetchModelList('sk-test', 'https://api.example.com/v1');

    expect(result).toEqual([
      { id: 'model-a', name: 'model-a' },
      { id: 'model-b', name: 'model-b' },
    ]);
  });

  it('向客户端传入超时时间并禁用重试', async () => {
    listMock.mockResolvedValue({ data: [] });

    await fetchModelList('sk-test', 'https://api.example.com/v1', 5000);

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-test',
        baseURL: 'https://api.example.com/v1',
        timeout: 5000,
        maxRetries: 0,
      })
    );
  });

  it('默认超时时间为 MODELS_FETCH_TIMEOUT', async () => {
    listMock.mockResolvedValue({ data: [] });

    await fetchModelList('sk-test', 'https://api.example.com/v1');

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timeout: MODELS_FETCH_TIMEOUT })
    );
  });

  it('请求失败时抛出异常而不是返回空列表', async () => {
    listMock.mockRejectedValue(new MockAPIConnectionTimeoutError('Request timed out.'));

    await expect(fetchModelList('sk-test', 'https://api.example.com/v1')).rejects.toBeInstanceOf(
      MockAPIConnectionTimeoutError
    );
  });
});

describe('isTimeoutError', () => {
  it('识别超时错误', () => {
    expect(isTimeoutError(new MockAPIConnectionTimeoutError('timeout'))).toBe(true);
  });

  it('普通错误不识别为超时', () => {
    expect(isTimeoutError(new Error('boom'))).toBe(false);
    expect(isTimeoutError('timeout')).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});
