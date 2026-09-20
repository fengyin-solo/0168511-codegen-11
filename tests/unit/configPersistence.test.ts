import { describe, it, expect, beforeEach } from 'vitest';
import { useConfigStore } from '../../src/stores/configStore';
import { useChatStore } from '../../src/stores/chatStore';
import { saveConfig, loadConfig } from '../../src/services/storage';
import { DEFAULT_CONFIG } from '../../src/types';

function resetStores() {
  useConfigStore.setState({
    config: DEFAULT_CONFIG,
    isValid: false,
    errors: {},
    initialized: false,
  });
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    initialized: false,
  });
}

describe('模型选择的持久化', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStores();
  });

  it('默认模型保持不变', () => {
    expect(DEFAULT_CONFIG.model).toBe('deepseek-ai/DeepSeek-V3');
    expect(loadConfig().model).toBe('deepseek-ai/DeepSeek-V3');
  });

  it('saveConfig / loadConfig 往返后模型选择不变', () => {
    saveConfig({ ...DEFAULT_CONFIG, model: 'Qwen/Qwen2.5-72B-Instruct' });
    expect(loadConfig().model).toBe('Qwen/Qwen2.5-72B-Instruct');
  });

  it('setModel 后立即写入 localStorage', () => {
    useConfigStore.getState().initConfig();
    useConfigStore.getState().setModel('Qwen/Qwen2.5-32B-Instruct');
    expect(loadConfig().model).toBe('Qwen/Qwen2.5-32B-Instruct');
  });

  it('退出再进入（重新 initConfig）后记住上一次的选择', () => {
    useConfigStore.getState().initConfig();
    useConfigStore.getState().setModel('Qwen/Qwen2.5-72B-Instruct');

    // 模拟退出后重新打开：内存状态回到默认，再从 localStorage 初始化
    useConfigStore.setState({ config: DEFAULT_CONFIG, initialized: false });
    useConfigStore.getState().initConfig();

    expect(useConfigStore.getState().config.model).toBe('Qwen/Qwen2.5-72B-Instruct');
  });

  it('切换到另一条对话再回来，选中的模型不丢失', () => {
    useConfigStore.getState().initConfig();
    useConfigStore.getState().setModel('Qwen/Qwen2.5-72B-Instruct');

    const chat = useChatStore.getState();
    const first = chat.createConversation('对话一');
    const second = chat.createConversation('对话二');

    useChatStore.getState().setActiveConversation(first);
    useChatStore.getState().setActiveConversation(second);
    useChatStore.getState().setActiveConversation(first);

    expect(useConfigStore.getState().config.model).toBe('Qwen/Qwen2.5-72B-Instruct');
    expect(useChatStore.getState().activeConversationId).toBe(first);
  });

  it('resetConfig 恢复默认模型', () => {
    useConfigStore.getState().initConfig();
    useConfigStore.getState().setModel('Qwen/Qwen2.5-72B-Instruct');
    useConfigStore.getState().resetConfig();
    expect(useConfigStore.getState().config.model).toBe('deepseek-ai/DeepSeek-V3');
  });
});
