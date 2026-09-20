import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock openai 客户端，避免真实网络请求
const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    models = { list: listMock };
  },
}));

import {
  fetchAvailableModels,
  withTimeout,
  ModelListTimeoutError,
  MODEL_LIST_TIMEOUT,
} from '../../src/services/api';

describe('withTimeout', () => {
  it('Promise 在超时前完成时返回结果', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('Promise 超时未结束时抛出 ModelListTimeoutError', async () => {
    const hanging = new Promise(() => {});
    await expect(withTimeout(hanging, 20)).rejects.toBeInstanceOf(ModelListTimeoutError);
  });

  it('原始 Promise 拒绝时透传原始错误', async () => {
    const failure = new Error('boom');
    await expect(withTimeout(Promise.reject(failure), 50)).rejects.toBe(failure);
  });
});

describe('fetchAvailableModels', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('成功时返回模型 ID 列表', async () => {
    listMock.mockResolvedValue({
      data: [{ id: 'model-a' }, { id: 'model-b' }],
    });

    await expect(fetchAvailableModels('sk-test-key', 'https://api.example.com/v1')).resolves.toEqual([
      'model-a',
      'model-b',
    ]);
  });

  it('请求超时时抛出 ModelListTimeoutError 而不是静默返回空列表', async () => {
    listMock.mockReturnValue(new Promise(() => {}));

    await expect(
      fetchAvailableModels('sk-test-key', 'https://api.example.com/v1', 20)
    ).rejects.toBeInstanceOf(ModelListTimeoutError);
  });

  it('接口报错时透传原始错误', async () => {
    const apiError = Object.assign(new Error('Incorrect API key'), { status: 401 });
    listMock.mockRejectedValue(apiError);

    await expect(
      fetchAvailableModels('sk-test-key', 'https://api.example.com/v1')
    ).rejects.toBe(apiError);
  });

  it('默认超时时间为 MODEL_LIST_TIMEOUT', () => {
    expect(MODEL_LIST_TIMEOUT).toBeGreaterThan(0);
  });
});
