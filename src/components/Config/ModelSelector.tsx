
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spin, Typography } from 'antd';
import {
  CheckOutlined,
  DownOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ModelInfo } from '../../types';
import { AVAILABLE_MODELS, DEFAULT_CONFIG } from '../../types';
import { fetchModelList, isTimeoutError } from '../../services/api';
import {
  filterModels,
  findModelById,
  mergeModelMetadata,
  splitHighlightSegments,
} from '../../utils/modelFilter';
import './ModelSelector.css';

const { Text } = Typography;

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  /** API 密钥（用于拉取远程模型列表） */
  apiKey?: string;
  /** API 基础 URL */
  baseUrl?: string;
}

/** 模型列表加载状态 */
type LoadState = 'idle' | 'loading' | 'success' | 'error';

/**
 * 高亮文本：将检索命中的片段用 <mark> 标出
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = splitHighlightSegments(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark key={index} className="model-highlight">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

/**
 * 模型选择器组件
 * 支持按名称检索、命中高亮、键盘上下移动与回车确认；
 * 远程拉取模型列表，超时或失败时回退到内置列表并明确提示
 */
export function ModelSelector({ value, onChange, apiKey, baseUrl }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>(AVAILABLE_MODELS);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const requestIdRef = useRef(0);

  // 拉取远程模型列表（带超时），失败时回退到内置列表并提示
  const loadModels = useCallback(() => {
    if (!apiKey) {
      // 未配置 API Key 时直接使用内置列表
      setModels(AVAILABLE_MODELS);
      setLoadState('idle');
      setLoadError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoadState('loading');
    setLoadError(null);

    fetchModelList(apiKey, baseUrl || DEFAULT_CONFIG.baseUrl)
      .then((remoteModels) => {
        if (requestId !== requestIdRef.current) return; // 已过期响应
        setModels(
          remoteModels.length > 0
            ? mergeModelMetadata(remoteModels, AVAILABLE_MODELS)
            : AVAILABLE_MODELS
        );
        setLoadState('success');
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) return; // 已过期响应
        console.error('Failed to load models:', error);
        setModels(AVAILABLE_MODELS);
        setLoadState('error');
        setLoadError(isTimeoutError(error) ? '模型列表加载超时' : '模型列表加载失败');
      });
  }, [apiKey, baseUrl]);

  // 防抖加载，避免输入 API Key 时频繁请求；卸载或依赖变化时使在途请求失效
  useEffect(() => {
    const timer = setTimeout(loadModels, 400);
    return () => {
      clearTimeout(timer);
      requestIdRef.current += 1;
    };
  }, [loadModels]);

  // 检索过滤（按名称 / ID）
  const filteredModels = useMemo(
    () => filterModels(models, searchTerm),
    [models, searchTerm]
  );

  // 当前选中模型：始终按 ID 从当前列表精确查找，保证名称、描述、最大上下文一一对应
  const selectedModel = useMemo(
    () => findModelById(models, value) ?? findModelById(AVAILABLE_MODELS, value),
    [models, value]
  );

  const closeDropdown = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    setSearchTerm('');
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // 打开下拉并定位到当前选中项
  const openDropdown = useCallback(() => {
    setSearchTerm('');
    const selectedIndex = models.findIndex((model) => model.id === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }, [models, value]);

  // 高亮项变化时滚动到可视区域（打开时也会定位到选中项）
  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  // 点击组件外部时关闭下拉
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDropdown]);

  const selectModel = (model: ModelInfo) => {
    onChange(model.id);
    closeDropdown(true);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setActiveIndex(0); // 定位到第一个命中项
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          openDropdown();
          return;
        }
        setActiveIndex((index) => {
          if (filteredModels.length === 0) return 0;
          return event.key === 'ArrowDown'
            ? (index + 1) % filteredModels.length
            : (index - 1 + filteredModels.length) % filteredModels.length;
        });
        break;
      case 'Enter': {
        // 下拉关闭时交给触发按钮的原生行为打开下拉
        if (!isOpen) return;
        event.preventDefault();
        const target = filteredModels[activeIndex];
        if (target) {
          selectModel(target);
        }
        break;
      }
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        closeDropdown(true);
        break;
    }
  };

  // 每次渲染时重置选项引用，由 ref 回调重新填充
  optionRefs.current = [];

  return (
    <div className="model-selector">
      <label className="input-label" id="model-selector-label">
        模型
      </label>

      {loadState === 'error' && loadError && (
        <div className="model-load-warning" role="alert">
          <WarningOutlined />
          <span>{loadError}，已回退到内置模型列表</span>
          <button type="button" className="model-retry-button" onClick={loadModels}>
            <ReloadOutlined />
            重试
          </button>
        </div>
      )}

      <div className="model-combobox" ref={containerRef}>
        <button
          type="button"
          ref={triggerRef}
          className="model-combobox-trigger"
          onClick={() => (isOpen ? closeDropdown() : openDropdown())}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby="model-selector-label"
        >
          <span className="model-combobox-value">
            {selectedModel?.name ?? (value || '请选择模型')}
          </span>
          <DownOutlined className={`model-combobox-arrow${isOpen ? ' open' : ''}`} />
        </button>

        {isOpen && (
          <div className="model-dropdown">
            <div className="model-search">
              <SearchOutlined className="model-search-icon" />
              <input
                type="text"
                className="model-search-input"
                placeholder="搜索模型名称…"
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                autoFocus
                role="combobox"
                aria-expanded={isOpen}
                aria-controls="model-listbox"
                aria-activedescendant={
                  filteredModels.length > 0 ? `model-option-${activeIndex}` : undefined
                }
              />
            </div>

            {loadState === 'loading' && (
              <div className="model-loading">
                <Spin size="small" />
                <span>正在加载模型列表…</span>
              </div>
            )}

            <div className="model-options" role="listbox" id="model-listbox">
              {filteredModels.length === 0 ? (
                <div className="model-empty">未找到与“{searchTerm}”匹配的模型</div>
              ) : (
                filteredModels.map((model, index) => (
                  <div
                    key={model.id}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    role="option"
                    id={`model-option-${index}`}
                    aria-selected={model.id === value}
                    className={[
                      'model-option',
                      index === activeIndex ? 'active' : '',
                      model.id === value ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectModel(model)}
                  >
                    <div className="model-option-main">
                      <span className="model-name">
                        <HighlightedText text={model.name} query={searchTerm} />
                      </span>
                      {model.id === value && <CheckOutlined className="model-check" />}
                    </div>
                    <span className="model-id">
                      <HighlightedText text={model.id} query={searchTerm} />
                    </span>
                    {model.description && (
                      <span className="model-desc">{model.description}</span>
                    )}
                    {model.maxContext != null && (
                      <span className="model-context">
                        最大上下文: {model.maxContext.toLocaleString()} tokens
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {selectedModel?.description && (
        <Text type="secondary" className="model-description">
          {selectedModel.description}
          {selectedModel.maxContext != null &&
            ` · 最大上下文: ${selectedModel.maxContext.toLocaleString()} tokens`}
        </Text>
      )}
    </div>
  );
}
