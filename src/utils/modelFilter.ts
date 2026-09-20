import type { ModelInfo } from '../types';

/**
 * 高亮片段：一段文本及其是否为命中部分
 */
export interface HighlightSegment {
  /** 片段文本 */
  text: string;
  /** 是否为检索命中的片段 */
  matched: boolean;
}

/**
 * 按名称 / ID 过滤模型列表（大小写不敏感）
 * @param models 模型列表
 * @param query 检索关键词
 * @returns 命中的模型列表；关键词为空时返回原列表
 */
export function filterModels(models: ModelInfo[], query: string): ModelInfo[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) {
    return models;
  }

  return models.filter(
    (model) =>
      model.name.toLowerCase().includes(keyword) ||
      model.id.toLowerCase().includes(keyword)
  );
}

/**
 * 将文本按检索关键词拆分为高亮片段，命中部分大小写不敏感
 * @param text 原始文本
 * @param query 检索关键词
 * @returns 高亮片段数组，拼接后与原文本一致
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  const keyword = query.trim();
  if (!keyword || !text) {
    return [{ text, matched: false }];
  }

  const segments: HighlightSegment[] = [];
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let start = 0;

  while (start < text.length) {
    const hitIndex = lowerText.indexOf(lowerKeyword, start);
    if (hitIndex === -1) {
      break;
    }
    if (hitIndex > start) {
      segments.push({ text: text.slice(start, hitIndex), matched: false });
    }
    segments.push({ text: text.slice(hitIndex, hitIndex + keyword.length), matched: true });
    start = hitIndex + keyword.length;
  }

  if (start < text.length) {
    segments.push({ text: text.slice(start), matched: false });
  }

  return segments.length > 0 ? segments : [{ text, matched: false }];
}

/**
 * 合并远程模型列表与内置模型元数据（显示名称、描述、最大上下文）
 * 远程模型自带的描述 / 上下文优先，缺失时按 ID 回填内置元数据
 * @param remoteModels 远程获取的模型列表
 * @param knownModels 内置模型列表（作为元数据来源）
 * @returns 合并后的模型列表
 */
export function mergeModelMetadata(
  remoteModels: ModelInfo[],
  knownModels: ModelInfo[]
): ModelInfo[] {
  return remoteModels.map((model) => {
    const known = knownModels.find((item) => item.id === model.id);
    return {
      id: model.id,
      name: known?.name ?? (model.name || model.id),
      description: model.description ?? known?.description,
      maxContext: model.maxContext ?? known?.maxContext,
    };
  });
}

/**
 * 按 ID 精确查找模型，保证选中项与描述、最大上下文一一对应
 * @param models 模型列表
 * @param id 模型 ID
 * @returns 命中的模型，未找到时返回 undefined
 */
export function findModelById(models: ModelInfo[], id: string): ModelInfo | undefined {
  return models.find((model) => model.id === id);
}
