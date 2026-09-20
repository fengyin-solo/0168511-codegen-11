import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModelInfo } from '../types';
import { AVAILABLE_MODELS } from '../types';
import { fetchAvailableModels, ModelListTimeoutError } from '../services/api';
import { mergeModelOptions } from '../utils/modelSearch';
import { validateAPIKey } from '../utils/validators';

/**
 * 模型列表加载状态
 * - idle: 未发起请求（缺少有效 API Key）
 * - loading: 正在请求
 * - success: 远程列表获取成功
 * - timeout: 请求超时，已回退到内置列表
 * - error: 请求失败，已回退到内置列表
 */
export type ModelListStatus = 'idle' | 'loading' | 'success' | 'timeout' | 'error';

export interface UseModelListResult {
  /** 可供选择的模型列表（远程与内置合并，始终非空） */
  models: ModelInfo[];
  /** 加载状态 */
  status: ModelListStatus;
  /** 是否为远程获取的完整列表 */
  isRemote: boolean;
  /** 重新加载模型列表 */
  reload: () => void;
}

/**
 * 模型列表 Hook
 * 根据 API Key 与 Base URL 拉取远程模型列表，并与内置模型元数据合并；
 * 超时或失败时回退到内置列表，保证选择器始终可用且状态可感知
 * @param apiKey API 密钥
 * @param baseUrl API 基础 URL
 */
export function useModelList(apiKey: string, baseUrl: string): UseModelListResult {
  const [remoteIds, setRemoteIds] = useState<string[] | null>(null);
  const [status, setStatus] = useState<ModelListStatus>('idle');
  // 请求序号，避免慢请求覆盖新请求的结果
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    // 没有有效 API Key 时不发起请求，直接使用内置列表
    if (!validateAPIKey(apiKey)) {
      setRemoteIds(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    try {
      const ids = await fetchAvailableModels(apiKey, baseUrl);
      if (requestId === requestIdRef.current) {
        setRemoteIds(ids);
        setStatus('success');
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setRemoteIds(null);
        setStatus(error instanceof ModelListTimeoutError ? 'timeout' : 'error');
      }
    }
  }, [apiKey, baseUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const models = useMemo(
    () => (remoteIds ? mergeModelOptions(remoteIds, AVAILABLE_MODELS) : AVAILABLE_MODELS),
    [remoteIds]
  );

  return {
    models,
    status,
    isRemote: remoteIds !== null,
    reload: load,
  };
}
