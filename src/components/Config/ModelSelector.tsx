
import { useMemo, useState } from 'react';
import { Button, Empty, Select, Spin, Typography } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { AVAILABLE_MODELS } from '../../types';
import { useConfigStore } from '../../stores/configStore';
import { useModelList } from '../../hooks/useModelList';
import {
  ensureModelPresent,
  filterModels,
  highlightText,
} from '../../utils/modelSearch';
import './ModelSelector.css';

const { Text } = Typography;

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 模型选择器组件
 * 支持按名称检索、命中片段高亮、键盘上下移动与回车确认；
 * 检索无结果或请求超时/失败时给出明确提示，内置列表兜底
 */
export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const apiKey = useConfigStore((state) => state.config.apiKey);
  const baseUrl = useConfigStore((state) => state.config.baseUrl);
  const { models, status, reload } = useModelList(apiKey, baseUrl);

  // 检索关键词（受控，关闭下拉时清空，重新打开可定位回当前选中项）
  const [keyword, setKeyword] = useState('');

  // 当前选中项始终保留在选项中，保证选中模型与描述、最大上下文一一对应
  const options = useMemo(
    () => ensureModelPresent(models, value, AVAILABLE_MODELS),
    [models, value]
  );
  const filteredModels = useMemo(() => filterModels(options, keyword), [options, keyword]);
  const selectedModel = options.find((m) => m.id === value);

  const handleChange = (modelId: string) => {
    setKeyword('');
    onChange(modelId);
  };

  // 下拉开关时清空检索词：再次打开展示完整列表并滚动定位到当前选中项
  const handleDropdownVisibleChange = () => {
    setKeyword('');
  };

  // 列表为空时的明确提示，而不是空白一片
  const notFoundContent =
    status === 'loading' ? (
      <div className="model-list-empty">
        <Spin size="small" />
        <span>正在获取模型列表…</span>
      </div>
    ) : (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          keyword.trim()
            ? `未找到与“${keyword.trim()}”匹配的模型`
            : '暂无可用模型'
        }
      />
    );

  return (
    <div className="model-selector">
      <label className="input-label">模型</label>
      <Select
        showSearch
        value={value}
        onChange={handleChange}
        searchValue={keyword}
        onSearch={setKeyword}
        onDropdownVisibleChange={handleDropdownVisibleChange}
        filterOption={false}
        size="large"
        style={{ width: '100%' }}
        optionLabelProp="label"
        placeholder="输入名称检索模型"
        notFoundContent={notFoundContent}
        popupClassName="model-selector-dropdown"
        options={filteredModels.map((model) => ({
          value: model.id,
          label: model.name,
          desc: model.description,
        }))}
        optionRender={(option) => (
          <div className="model-option">
            <span className="model-name">
              {highlightText(String(option.data.label ?? ''), keyword).map((segment, index) =>
                segment.matched ? (
                  <mark key={index} className="model-highlight">
                    {segment.text}
                  </mark>
                ) : (
                  <span key={index}>{segment.text}</span>
                )
              )}
            </span>
            {option.data.desc && (
              <span className="model-desc">{option.data.desc}</span>
            )}
          </div>
        )}
      />
      {status === 'loading' && (
        <Text type="secondary" className="model-list-status">
          <Spin size="small" /> 正在获取模型列表…
        </Text>
      )}
      {(status === 'timeout' || status === 'error') && (
        <Text type="warning" className="model-list-status">
          <WarningOutlined />
          {status === 'timeout' ? '获取模型列表超时' : '模型列表加载失败'}
          ，当前显示内置模型
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={reload}
            className="model-list-retry"
          >
            重试
          </Button>
        </Text>
      )}
      {selectedModel?.description && (
        <Text type="secondary" className="model-description">
          {selectedModel.description}
          {selectedModel.maxContext && ` · 最大上下文: ${selectedModel.maxContext.toLocaleString()} tokens`}
        </Text>
      )}
    </div>
  );
}
