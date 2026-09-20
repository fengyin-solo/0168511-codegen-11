import { describe, it, expect } from 'vitest';
import type { ModelInfo } from '../../src/types';
import {
  filterModels,
  findModelById,
  mergeModelMetadata,
  splitHighlightSegments,
} from '../../src/utils/modelFilter';

const models: ModelInfo[] = [
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'DeepSeek V3',
    description: 'DeepSeek 最新模型，性能强大',
    maxContext: 64000,
  },
  {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B',
    description: '通义千问大模型',
    maxContext: 32000,
  },
  {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen 2.5 32B',
    description: '通义千问中等规模模型',
    maxContext: 32000,
  },
];

describe('filterModels', () => {
  it('关键词为空时返回全部模型', () => {
    expect(filterModels(models, '')).toHaveLength(3);
    expect(filterModels(models, '   ')).toHaveLength(3);
  });

  it('按名称检索，大小写不敏感', () => {
    const result = filterModels(models, 'deepseek');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('deepseek-ai/DeepSeek-V3');
  });

  it('支持按名称部分匹配多个结果', () => {
    const result = filterModels(models, 'qwen');
    expect(result).toHaveLength(2);
  });

  it('支持按 ID 检索', () => {
    const result = filterModels(models, '72B-Instruct');
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Qwen 2.5 72B');
  });

  it('检索不到时返回空数组', () => {
    expect(filterModels(models, '不存在的模型')).toHaveLength(0);
  });
});

describe('splitHighlightSegments', () => {
  it('关键词为空时整段文本不高亮', () => {
    expect(splitHighlightSegments('DeepSeek V3', '')).toEqual([
      { text: 'DeepSeek V3', matched: false },
    ]);
  });

  it('命中片段被正确拆分并标记', () => {
    expect(splitHighlightSegments('DeepSeek V3', 'Seek')).toEqual([
      { text: 'Deep', matched: false },
      { text: 'Seek', matched: true },
      { text: ' V3', matched: false },
    ]);
  });

  it('命中大小写不敏感，保留原文大小写', () => {
    expect(splitHighlightSegments('DeepSeek V3', 'deepseek')).toEqual([
      { text: 'DeepSeek', matched: true },
      { text: ' V3', matched: false },
    ]);
  });

  it('支持多处命中', () => {
    expect(splitHighlightSegments('abcabc', 'bc')).toEqual([
      { text: 'a', matched: false },
      { text: 'bc', matched: true },
      { text: 'a', matched: false },
      { text: 'bc', matched: true },
    ]);
  });

  it('未命中时整段文本不高亮', () => {
    expect(splitHighlightSegments('DeepSeek V3', 'xyz')).toEqual([
      { text: 'DeepSeek V3', matched: false },
    ]);
  });

  it('片段拼接后与原文本一致', () => {
    const text = 'Qwen 2.5 72B';
    const segments = splitHighlightSegments(text, 'wen 2');
    expect(segments.map((s) => s.text).join('')).toBe(text);
  });
});

describe('mergeModelMetadata', () => {
  it('按 ID 回填内置元数据（显示名称、描述、最大上下文）', () => {
    const remote: ModelInfo[] = [{ id: 'deepseek-ai/DeepSeek-V3', name: 'deepseek-ai/DeepSeek-V3' }];
    const merged = mergeModelMetadata(remote, models);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({
      id: 'deepseek-ai/DeepSeek-V3',
      name: 'DeepSeek V3',
      description: 'DeepSeek 最新模型，性能强大',
      maxContext: 64000,
    });
  });

  it('远程模型自带描述 / 上下文时优先使用远程数据', () => {
    const remote: ModelInfo[] = [
      {
        id: 'deepseek-ai/DeepSeek-V3',
        name: 'deepseek-ai/DeepSeek-V3',
        description: '远程描述',
        maxContext: 128000,
      },
    ];
    const merged = mergeModelMetadata(remote, models);

    expect(merged[0]?.description).toBe('远程描述');
    expect(merged[0]?.maxContext).toBe(128000);
  });

  it('未知远程模型保留原样，ID 作为显示名称兜底', () => {
    const remote: ModelInfo[] = [{ id: 'new-vendor/model-x', name: '' }];
    const merged = mergeModelMetadata(remote, models);

    expect(merged[0]).toEqual({
      id: 'new-vendor/model-x',
      name: 'new-vendor/model-x',
      description: undefined,
      maxContext: undefined,
    });
  });
});

describe('findModelById', () => {
  it('按 ID 精确命中，保证与描述、最大上下文一一对应', () => {
    const found = findModelById(models, 'Qwen/Qwen2.5-72B-Instruct');
    expect(found?.name).toBe('Qwen 2.5 72B');
    expect(found?.description).toBe('通义千问大模型');
    expect(found?.maxContext).toBe(32000);
  });

  it('ID 不存在时返回 undefined', () => {
    expect(findModelById(models, 'not-exist')).toBeUndefined();
  });
});
