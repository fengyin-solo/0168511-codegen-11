
import { Drawer, Button, Divider, message } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import { ParameterSlider } from './ParameterSlider';
import { useConfigStore } from '../../stores/configStore';
import { useUIStore } from '../../stores/uiStore';
import './ConfigPanel.css';

/**
 * 配置面板组件
 */
export function ConfigPanel() {
  const {
    config,
    errors,
    updateConfig,
    resetConfig,
    validateCurrentConfig,
  } = useConfigStore();

  const { configPanelVisible, setConfigPanelVisible, isMobile } = useUIStore();

  const handleClose = () => {
    setConfigPanelVisible(false);
  };

  const handleSave = () => {
    if (validateCurrentConfig()) {
      message.success('配置已保存');
      handleClose();
    } else {
      message.error('请检查配置项');
    }
  };

  const handleReset = () => {
    resetConfig();
    message.info('已恢复默认配置');
  };

  return (
    <Drawer
      title="设置"
      placement="right"
      width={isMobile ? '100%' : 400}
      open={configPanelVisible}
      onClose={handleClose}
      className="config-panel"
      footer={
        <div className="config-panel-footer">
          <Button onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>
            保存
          </Button>
        </div>
      }
    >
      <div className="config-panel-content">
        <section className="config-section">
          <h3 className="section-title">API 配置</h3>
          <APIKeyInput
            value={config.apiKey}
            onChange={(value) => updateConfig({ apiKey: value })}
            error={errors.apiKey}
          />
        </section>

        <Divider />

        <section className="config-section">
          <h3 className="section-title">模型设置</h3>
          <ModelSelector
            value={config.model}
            onChange={(value) => updateConfig({ model: value })}
            apiKey={config.apiKey}
            baseUrl={config.baseUrl}
          />
        </section>

        <Divider />

        <section className="config-section">
          <h3 className="section-title">参数调整</h3>
          <ParameterSlider
            temperature={config.temperature}
            maxTokens={config.maxTokens}
            onTemperatureChange={(value) => updateConfig({ temperature: value })}
            onMaxTokensChange={(value) => updateConfig({ maxTokens: value })}
          />
        </section>
      </div>
    </Drawer>
  );
}
