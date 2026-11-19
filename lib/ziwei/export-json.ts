/**
 * 把排盘结果收成可放进 JSON 的纯数据。
 * 值为 undefined 的字段改成 null，避免 JSON.stringify 把键丢掉。
 * 不读取环境变量，也不改动原对象。
 */

const SECRET_KEY = /^(apiKey|api_key|xai_api_key|ai_api_key|authorization|password|secret|accessToken|refreshToken)$/i;
const SECRET_VALUE = /^(sk-|xai-)[A-Za-z0-9_-]{8,}$/;

export function jsonSafe<T>(value: T): T {
  return normalize(value) as T;
}

function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'function') return null;
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && SECRET_VALUE.test(value)) return null;
    return value;
  }
  if (Array.isArray(value)) return value.map(item => normalize(item));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = normalize((value as Record<string, unknown>)[key]);
  }
  return out;
}
