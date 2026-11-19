/**
 * OpenAI 兼容接口的环境变量解析。
 * 只在服务端读取密钥，调用方拿到的公开状态里不含 key。
 */

/** docs.x.ai 当前面向对话的通用模型（Models 页：Chat → Grok 4.7）。 */
export const DEFAULT_XAI_MODEL = 'grok-4.7';
export const DEFAULT_XAI_BASE_URL = 'https://api.x.ai/v1';

export const AI_NOT_CONFIGURED_MESSAGE =
  'AI 接口还没有配置。排盘和命盘可以继续看。要生成解读，请在服务器环境变量里设置 XAI_API_KEY（或别名 AI_API_KEY）。默认会请求 https://api.x.ai/v1 的 grok-4.7，模型可用 XAI_MODEL 或 AI_MODEL 更换。密钥不要写进仓库。';

export interface AiConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type AiConfigResult =
  | ({ ok: true } & AiConfig)
  | { ok: false; message: string };

interface Preset {
  baseUrl: string;
  model: string;
  keyNames: string[];
  baseEnv: string;
  modelEnv: string;
}

const PRESETS: Record<string, Preset> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyNames: ['OPENAI_API_KEY', 'AI_API_KEY'],
    baseEnv: 'OPENAI_BASE_URL',
    modelEnv: 'OPENAI_MODEL',
  },
  xai: {
    baseUrl: DEFAULT_XAI_BASE_URL,
    model: DEFAULT_XAI_MODEL,
    keyNames: ['XAI_API_KEY', 'AI_API_KEY'],
    baseEnv: 'XAI_BASE_URL',
    modelEnv: 'XAI_MODEL',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyNames: ['DEEPSEEK_API_KEY', 'AI_API_KEY'],
    baseEnv: 'DEEPSEEK_BASE_URL',
    modelEnv: 'DEEPSEEK_MODEL',
  },
  mimo: {
    baseUrl: '',
    model: '',
    keyNames: ['MIMO_API_KEY', 'AI_API_KEY'],
    baseEnv: 'MIMO_BASE_URL',
    modelEnv: 'MIMO_MODEL',
  },
  compatible: {
    baseUrl: '',
    model: '',
    keyNames: ['AI_API_KEY'],
    baseEnv: 'AI_BASE_URL',
    modelEnv: 'AI_MODEL',
  },
};

function read(env: Record<string, string | undefined>, name: string): string {
  return (env[name] ?? '').trim();
}

function firstKey(env: Record<string, string | undefined>, names: string[]): string {
  for (const name of names) {
    const value = read(env, name);
    if (value) return value;
  }
  return '';
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveAiConfig(env: Record<string, string | undefined> = process.env): AiConfigResult {
  // 这个应用默认走 xAI。显式写出 AI_PROVIDER 时才换别的 OpenAI 兼容服务。
  const requested = read(env, 'AI_PROVIDER').toLowerCase() || 'xai';
  const provider = PRESETS[requested] ? requested : 'compatible';
  const preset = PRESETS[provider];

  const apiKey = firstKey(env, preset.keyNames);
  const baseUrl = (read(env, 'AI_BASE_URL') || read(env, preset.baseEnv) || preset.baseUrl).replace(/\/+$/, '');
  const model = read(env, 'AI_MODEL') || read(env, preset.modelEnv) || preset.model;

  if (!apiKey || !baseUrl || !model) {
    return { ok: false, message: AI_NOT_CONFIGURED_MESSAGE };
  }
  if (!isHttpUrl(baseUrl)) {
    return {
      ok: false,
      message: 'AI_BASE_URL 需要是 http 或 https 地址，例如 https://api.x.ai/v1。不要把 /chat/completions 写进 Base URL。',
    };
  }
  return { ok: true, provider, apiKey, baseUrl, model };
}

/** 给浏览器看的状态。故意不包含密钥和完整路径。 */
export function publicAiStatus(result: AiConfigResult): {
  configured: boolean;
  message?: string;
  provider?: string;
  model?: string;
  host?: string;
} {
  if (!result.ok) return { configured: false, message: result.message };
  let host = '';
  try {
    host = new URL(result.baseUrl).host;
  } catch {
    host = '';
  }
  return { configured: true, provider: result.provider, model: result.model, host };
}
