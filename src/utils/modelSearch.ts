import type { ModelInfo } from '../types';

/**
 * 高亮片段：将文本按检索词命中情况切分后的片段
 */
export interface HighlightSegment {
  /** 片段文本（保留原文大小写） */
  text: string;
  /** 是否为命中片段 */
  matched: boolean;
}

/**
 * 键盘移动方向
 */
export type MoveDirection = 'up' | 'down';

/**
 * 规范化检索词：去除首尾空白并转小写（检索大小写不敏感）
 * @param query 原始检索词
 * @returns 规范化后的检索词
 */
export function normalizeQuery(query: string): string {
  return (query ?? '').trim().toLowerCase();
}

/**
 * 按名称检索模型（大小写不敏感）
 * 检索词为空（或仅空白）时返回完整列表，否则返回名称包含检索词的模型，保持原有顺序
 * @param models 模型列表
 * @param query 检索词
 * @returns 命中的模型列表
 */
export function filterModels(models: ModelInfo[], query: string): ModelInfo[] {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return models;
  }
  return models.filter((model) => model.name.toLowerCase().includes(normalized));
}

/**
 * 将文本按检索词命中情况切分为片段，用于高亮展示
 * 匹配大小写不敏感，但片段保留原文；检索词为空时返回单个未命中片段
 * @param text 原始文本
 * @param query 检索词
 * @returns 高亮片段数组，拼接后与原文一致
 */
export function highlightText(text: string, query: string): HighlightSegment[] {
  const normalized = normalizeQuery(query);
  if (!text || !normalized) {
    return [{ text, matched: false }];
  }

  const segments: HighlightSegment[] = [];
  const lowerText = text.toLowerCase();
  let start = 0;
  let index = lowerText.indexOf(normalized);

  while (index !== -1) {
    if (index > start) {
      segments.push({ text: text.slice(start, index), matched: false });
    }
    segments.push({ text: text.slice(index, index + normalized.length), matched: true });
    start = index + normalized.length;
    index = lowerText.indexOf(normalized, start);
  }

  if (start < text.length) {
    segments.push({ text: text.slice(start), matched: false });
  }

  return segments;
}

/**
 * 计算键盘上下移动后的激活索引（循环移动）
 * @param current 当前激活索引，-1 表示无激活项
 * @param direction 移动方向
 * @param count 列表长度
 * @returns 新的激活索引；列表为空时返回 -1
 */
export function moveActiveIndex(current: number, direction: MoveDirection, count: number): number {
  if (count <= 0) {
    return -1;
  }
  if (current < 0 || current >= count) {
    return direction === 'down' ? 0 : count - 1;
  }
  return direction === 'down' ? (current + 1) % count : (current - 1 + count) % count;
}

/**
 * 查找模型在列表中的索引
 * @param models 模型列表
 * @param modelId 模型 ID
 * @returns 索引，未找到返回 -1
 */
export function findModelIndex(models: ModelInfo[], modelId: string): number {
  return models.findIndex((model) => model.id === modelId);
}

/**
 * 合并远程获取的模型 ID 与本地模型元数据
 * - 远程模型命中本地元数据时，补全显示名称、描述与最大上下文（按 id 一一对应）
 * - 本地内置模型始终保留在列表末尾，确保已保存的选择不会因远程列表变化而丢失
 * - 结果按 id 去重
 * @param remoteIds 远程获取的模型 ID 列表
 * @param localModels 本地内置模型列表
 * @returns 合并后的模型列表
 */
export function mergeModelOptions(remoteIds: string[], localModels: ModelInfo[]): ModelInfo[] {
  const localById = new Map(localModels.map((model) => [model.id, model]));
  const seen = new Set<string>();
  const merged: ModelInfo[] = [];

  for (const id of remoteIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(localById.get(id) ?? { id, name: id });
  }

  for (const model of localModels) {
    if (!seen.has(model.id)) {
      seen.add(model.id);
      merged.push(model);
    }
  }

  return merged;
}

/**
 * 确保指定模型出现在列表中
 * 当前选中项不在列表时，优先用本地元数据补全后追加，
 * 保证选中模型与其描述、最大上下文始终一一对应
 * @param models 模型列表
 * @param modelId 需要保留的模型 ID
 * @param localModels 本地内置模型列表（用于补全元数据）
 * @returns 包含指定模型的列表
 */
export function ensureModelPresent(
  models: ModelInfo[],
  modelId: string,
  localModels: ModelInfo[]
): ModelInfo[] {
  if (!modelId || models.some((model) => model.id === modelId)) {
    return models;
  }
  const known = localModels.find((model) => model.id === modelId);
  return [...models, known ?? { id: modelId, name: modelId }];
}
