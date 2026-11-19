import assert from 'node:assert/strict';
import { DEFAULT_XAI_BASE_URL, DEFAULT_XAI_MODEL, publicAiStatus, resolveAiConfig } from '../../lib/ai/config';

const secret = 'xai-test-key-should-not-leak';

const missing = resolveAiConfig({});
assert.equal(missing.ok, false);
if (!missing.ok) assert.match(missing.message, /XAI_API_KEY/);

const fromXai = resolveAiConfig({ XAI_API_KEY: secret });
assert.equal(fromXai.ok, true);
if (fromXai.ok) {
  assert.equal(fromXai.provider, 'xai');
  assert.equal(fromXai.baseUrl, DEFAULT_XAI_BASE_URL);
  assert.equal(fromXai.model, DEFAULT_XAI_MODEL);
  assert.equal(fromXai.apiKey, secret);
  const pub = publicAiStatus(fromXai);
  assert.equal(pub.configured, true);
  assert.equal(pub.host, 'api.x.ai');
  assert.equal(pub.model, 'grok-4.7');
  assert.equal(JSON.stringify(pub).includes(secret), false);
}

const alias = resolveAiConfig({ AI_API_KEY: secret, XAI_MODEL: 'grok-4.5' });
assert.equal(alias.ok, true);
if (alias.ok) {
  assert.equal(alias.provider, 'xai');
  assert.equal(alias.model, 'grok-4.5');
}

const override = resolveAiConfig({
  XAI_API_KEY: secret,
  XAI_MODEL: 'grok-4.5',
  AI_MODEL: 'grok-4.7',
});
assert.equal(override.ok, true);
if (override.ok) assert.equal(override.model, 'grok-4.7');

const prefersNamedKey = resolveAiConfig({
  XAI_API_KEY: 'named',
  AI_API_KEY: 'alias',
});
assert.equal(prefersNamedKey.ok, true);
if (prefersNamedKey.ok) assert.equal(prefersNamedKey.apiKey, 'named');

const badUrl = resolveAiConfig({
  AI_PROVIDER: 'compatible',
  AI_API_KEY: secret,
  AI_BASE_URL: 'file:///tmp/nope',
  AI_MODEL: 'x',
});
assert.equal(badUrl.ok, false);

const deepseek = resolveAiConfig({
  AI_PROVIDER: 'deepseek',
  DEEPSEEK_API_KEY: secret,
});
assert.equal(deepseek.ok, true);
if (deepseek.ok) {
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com/v1');
  assert.equal(deepseek.model, 'deepseek-chat');
}

console.log('AI config resolution checks passed');
