import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  ensureModelPresent,
  filterModels,
  findModelIndex,
  highlightText,
  mergeModelOptions,
  moveActiveIndex,
} from '../../src/utils/modelSearch';
import { saveConfig, loadConfig } from '../../src/services/storage';
import type { AppConfig, ModelInfo } from '../../src/types';

// 模型名称/检索词使用可打印 ASCII，保证大小写转换不改变长度
const textArb = fc.string();

const modelArb: fc.Arbitrary<ModelInfo> = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string(),
  description: fc.option(fc.string(), { nil: undefined }),
  maxContext: fc.option(fc.nat(), { nil: undefined }),
});

const modelListArb = fc.uniqueArray(modelArb, { selector: (m) => m.id });

const normalize = (s: string) => s.trim().toLowerCase();

describe('filterModels 属性', () => {
  it('空白检索词返回完整列表', () => {
    fc.assert(
      fc.property(modelListArb, fc.constantFrom('', ' ', '   ', '\t'), (models, query) => {
        expect(filterModels(models, query)).toEqual(models);
      })
    );
  });

  it('结果恰好是所有名称命中检索词的模型，且保持原有顺序', () => {
    fc.assert(
      fc.property(modelListArb, textArb, (models, query) => {
        const result = filterModels(models, query);
        const normalized = normalize(query);

        // 每个结果都必须命中
        for (const model of result) {
          expect(model.name.toLowerCase()).toContain(normalized);
        }
        // 所有命中的模型都必须出现在结果中
        const expectedCount = models.filter((m) =>
          m.name.toLowerCase().includes(normalized)
        ).length;
        expect(result).toHaveLength(expectedCount);
        // 结果是原列表的子序列（顺序保持）
        let cursor = 0;
        for (const model of result) {
          const found = models.findIndex((m, i) => i >= cursor && m === model);
          expect(found).toBeGreaterThanOrEqual(cursor);
          cursor = found + 1;
        }
      })
    );
  });
});

describe('highlightText 属性', () => {
  it('片段拼接后还原原文', () => {
    fc.assert(
      fc.property(textArb, textArb, (text, query) => {
        const segments = highlightText(text, query);
        expect(segments.map((s) => s.text).join('')).toBe(text);
      })
    );
  });

  it('命中片段等于检索词，未命中片段不再包含检索词', () => {
    fc.assert(
      fc.property(textArb, textArb, (text, query) => {
        const normalized = normalize(query);
        fc.pre(normalized.length > 0);
        for (const segment of highlightText(text, query)) {
          if (segment.matched) {
            expect(segment.text.toLowerCase()).toBe(normalized);
          } else {
            expect(segment.text.toLowerCase()).not.toContain(normalized);
          }
        }
      })
    );
  });

  it('命中文本的每个名称都能产生至少一个高亮片段', () => {
    fc.assert(
      fc.property(modelListArb, textArb, (models, query) => {
        const normalized = normalize(query);
        fc.pre(normalized.length > 0);
        for (const model of filterModels(models, query)) {
          const segments = highlightText(model.name, query);
          expect(segments.some((s) => s.matched)).toBe(true);
        }
      })
    );
  });
});

describe('moveActiveIndex 属性', () => {
  it('非空列表中移动后索引始终落在合法范围内', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 100 }),
        fc.constantFrom('up', 'down'),
        fc.integer({ min: 1, max: 100 }),
        (current, direction, count) => {
          const next = moveActiveIndex(current, direction as 'up' | 'down', count);
          expect(next).toBeGreaterThanOrEqual(0);
          expect(next).toBeLessThan(count);
        }
      )
    );
  });

  it('先下后上（或先上后下）回到原索引', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 99 }),
        (count, rawIndex) => {
          const index = rawIndex % count;
          expect(moveActiveIndex(moveActiveIndex(index, 'down', count), 'up', count)).toBe(index);
          expect(moveActiveIndex(moveActiveIndex(index, 'up', count), 'down', count)).toBe(index);
        }
      )
    );
  });

  it('空列表始终返回 -1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 10 }),
        fc.constantFrom('up', 'down'),
        (current, direction) => {
          expect(moveActiveIndex(current, direction as 'up' | 'down', 0)).toBe(-1);
        }
      )
    );
  });
});

describe('mergeModelOptions 属性', () => {
  it('远程与本地模型全部保留且无重复', () => {
    fc.assert(
      fc.property(fc.array(textArb), modelListArb, (remoteIds, localModels) => {
        const merged = mergeModelOptions(remoteIds, localModels);
        const ids = merged.map((m) => m.id);

        expect(new Set(ids).size).toBe(ids.length);
        for (const id of remoteIds) {
          expect(ids).toContain(id);
        }
        for (const local of localModels) {
          expect(ids).toContain(local.id);
        }
      })
    );
  });

  it('命中本地元数据的模型与描述、最大上下文一一对应', () => {
    fc.assert(
      fc.property(fc.array(textArb), modelListArb, (remoteIds, localModels) => {
        const merged = mergeModelOptions(remoteIds, localModels);
        const localById = new Map(localModels.map((m) => [m.id, m]));

        for (const entry of merged) {
          const local = localById.get(entry.id);
          if (local) {
            // 元数据一一对应：描述与最大上下文必须来自同一条本地记录
            expect(entry).toEqual(local);
          } else {
            expect(entry).toEqual({ id: entry.id, name: entry.id });
          }
        }
      })
    );
  });
});

describe('ensureModelPresent 属性', () => {
  it('调用后目标模型必然存在，已存在时列表不变', () => {
    fc.assert(
      fc.property(modelListArb, textArb, modelListArb, (models, targetId, localModels) => {
        const result = ensureModelPresent(models, targetId, localModels);

        if (!targetId) {
          expect(result).toBe(models);
          return;
        }
        expect(findModelIndex(result, targetId)).not.toBe(-1);
        if (models.some((m) => m.id === targetId)) {
          expect(result).toBe(models);
        } else {
          expect(result).toHaveLength(models.length + 1);
          expect(result[result.length - 1]?.id).toBe(targetId);
        }
      })
    );
  });
});

describe('配置持久化属性', () => {
  it('saveConfig / loadConfig 往返后配置不变（含模型选择）', () => {
    const configArb: fc.Arbitrary<AppConfig> = fc.record({
      apiKey: textArb,
      model: textArb,
      temperature: fc.double({ noNaN: true, noDefaultInfinity: true }),
      maxTokens: fc.integer(),
      baseUrl: textArb,
    });

    fc.assert(
      fc.property(configArb, (config) => {
        saveConfig(config);
        expect(loadConfig()).toEqual(config);
      })
    );
  });
});
