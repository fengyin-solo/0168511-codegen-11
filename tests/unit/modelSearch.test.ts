import { describe, it, expect } from 'vitest';
import {
  ensureModelPresent,
  filterModels,
  findModelIndex,
  highlightText,
  mergeModelOptions,
  moveActiveIndex,
} from '../../src/utils/modelSearch';
import { AVAILABLE_MODELS } from '../../src/types';
import type { ModelInfo } from '../../src/types';

const models: ModelInfo[] = [
  { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', description: 'DeepSeek 最新模型', maxContext: 64000 },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', description: '通义千问大模型', maxContext: 32000 },
  { id: 'Qwen/Qwen2.5-32B-Instruct', name: 'Qwen 2.5 32B', description: '通义千问中等规模模型', maxContext: 32000 },
  { id: 'meta-llama/Llama-3.1-8B', name: 'Llama 3.1 8B' },
];

describe('filterModels', () => {
  it('空检索词返回完整列表', () => {
    expect(filterModels(models, '')).toEqual(models);
    expect(filterModels(models, '   ')).toEqual(models);
  });

  it('按名称检索，大小写不敏感', () => {
    const result = filterModels(models, 'qwen');
    expect(result.map((m) => m.id)).toEqual([
      'Qwen/Qwen2.5-72B-Instruct',
      'Qwen/Qwen2.5-32B-Instruct',
    ]);
  });

  it('检索词前后空白不影响结果', () => {
    expect(filterModels(models, '  deepseek  ')).toEqual([models[0]]);
  });

  it('检索不到时返回空数组', () => {
    expect(filterModels(models, 'gpt-4o')).toEqual([]);
  });

  it('保持原有顺序且不修改入参', () => {
    const original = [...models];
    const result = filterModels(models, '2.5');
    expect(result.map((m) => m.name)).toEqual(['Qwen 2.5 72B', 'Qwen 2.5 32B']);
    expect(models).toEqual(original);
  });
});

describe('highlightText', () => {
  it('空检索词返回单个未命中片段', () => {
    expect(highlightText('DeepSeek V3', '')).toEqual([{ text: 'DeepSeek V3', matched: false }]);
    expect(highlightText('DeepSeek V3', '  ')).toEqual([{ text: 'DeepSeek V3', matched: false }]);
  });

  it('命中片段被标记且保留原文大小写', () => {
    expect(highlightText('DeepSeek V3', 'deep')).toEqual([
      { text: 'Deep', matched: true },
      { text: 'Seek V3', matched: false },
    ]);
  });

  it('支持多处命中', () => {
    expect(highlightText('Qwen 2.5 72B', '2')).toEqual([
      { text: 'Qwen ', matched: false },
      { text: '2', matched: true },
      { text: '.5 7', matched: false },
      { text: '2', matched: true },
      { text: 'B', matched: false },
    ]);
  });

  it('未命中时返回单个未命中片段', () => {
    expect(highlightText('DeepSeek V3', 'gpt')).toEqual([{ text: 'DeepSeek V3', matched: false }]);
  });

  it('检索词包含正则特殊字符时按字面量匹配', () => {
    const segments = highlightText('Qwen 2.5 72B', '2.5');
    expect(segments).toEqual([
      { text: 'Qwen ', matched: false },
      { text: '2.5', matched: true },
      { text: ' 72B', matched: false },
    ]);
  });

  it('连续命中产生相邻的命中片段', () => {
    expect(highlightText('aaaa', 'aa')).toEqual([
      { text: 'aa', matched: true },
      { text: 'aa', matched: true },
    ]);
  });
});

describe('moveActiveIndex', () => {
  it('向下移动并循环', () => {
    expect(moveActiveIndex(0, 'down', 3)).toBe(1);
    expect(moveActiveIndex(2, 'down', 3)).toBe(0);
  });

  it('向上移动并循环', () => {
    expect(moveActiveIndex(2, 'up', 3)).toBe(1);
    expect(moveActiveIndex(0, 'up', 3)).toBe(2);
  });

  it('无激活项时向下选中第一项、向上选中最后一项', () => {
    expect(moveActiveIndex(-1, 'down', 3)).toBe(0);
    expect(moveActiveIndex(-1, 'up', 3)).toBe(2);
  });

  it('空列表返回 -1', () => {
    expect(moveActiveIndex(0, 'down', 0)).toBe(-1);
    expect(moveActiveIndex(-1, 'up', 0)).toBe(-1);
  });
});

describe('findModelIndex', () => {
  it('返回模型所在索引', () => {
    expect(findModelIndex(models, 'Qwen/Qwen2.5-32B-Instruct')).toBe(2);
  });

  it('找不到时返回 -1', () => {
    expect(findModelIndex(models, 'not-exist')).toBe(-1);
  });
});

describe('mergeModelOptions', () => {
  it('远程模型命中本地元数据时补全描述与最大上下文', () => {
    const merged = mergeModelOptions(['deepseek-ai/DeepSeek-V3'], AVAILABLE_MODELS);
    const target = merged.find((m) => m.id === 'deepseek-ai/DeepSeek-V3');
    expect(target?.description).toBe('DeepSeek 最新模型，性能强大');
    expect(target?.maxContext).toBe(64000);
  });

  it('远程未知模型以 id 作为名称兜底', () => {
    const merged = mergeModelOptions(['new-model-x'], []);
    expect(merged).toEqual([{ id: 'new-model-x', name: 'new-model-x' }]);
  });

  it('本地内置模型始终保留，远程列表变化不丢失已保存的选择', () => {
    const merged = mergeModelOptions(['other-model'], AVAILABLE_MODELS);
    for (const local of AVAILABLE_MODELS) {
      expect(merged.some((m) => m.id === local.id)).toBe(true);
    }
  });

  it('结果按 id 去重', () => {
    const merged = mergeModelOptions(
      ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-V3'],
      AVAILABLE_MODELS
    );
    const ids = merged.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ensureModelPresent', () => {
  it('已存在时不改变列表', () => {
    expect(ensureModelPresent(models, models[0]!.id, AVAILABLE_MODELS)).toBe(models);
  });

  it('空模型 ID 时不改变列表', () => {
    expect(ensureModelPresent(models, '', AVAILABLE_MODELS)).toBe(models);
  });

  it('缺失时用本地元数据补全后追加', () => {
    const partial = models.slice(0, 1);
    const result = ensureModelPresent(partial, 'Qwen/Qwen2.5-72B-Instruct', AVAILABLE_MODELS);
    const appended = result[result.length - 1];
    expect(appended?.id).toBe('Qwen/Qwen2.5-72B-Instruct');
    expect(appended?.description).toBe('通义千问大模型');
    expect(appended?.maxContext).toBe(32000);
  });

  it('本地也无元数据时以 id 兜底追加', () => {
    const result = ensureModelPresent([], 'unknown/model', AVAILABLE_MODELS);
    expect(result).toEqual([{ id: 'unknown/model', name: 'unknown/model' }]);
  });
});
