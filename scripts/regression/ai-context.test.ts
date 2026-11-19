/**
 * 解读上下文只用排盘结果和仓库里已有的公开知识，不夹带讲课原话里的恐吓句。
 * patterns.ts 带 server-only，测试里先把它解析成空模块。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { generateChart } from '../../lib/ziwei/algorithm';

type HookResult = { url?: string; format?: string; source?: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => HookResult): HookResult;
    load(url: string, context: unknown, next: (u: string, c: unknown) => HookResult): HookResult;
  }): void;
};
const SERVER_ONLY_STUB = 'data:text/javascript,';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: SERVER_ONLY_STUB, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === SERVER_ONLY_STUB) return { format: 'commonjs', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});

async function main() {
  const prompts = readFileSync(new URL('../../lib/ai/prompts.ts', import.meta.url), 'utf8');
  assert.equal(prompts.includes('ouranic'), false);
  assert.match(prompts, /星垣/);
  assert.match(prompts, /【缘分概览】/);

  const { describeChart, describeHeming } = await import('../../lib/ai/chart-context');
  const { buildInterpretMessages, buildHemingMessages } = await import('../../lib/ai/messages');
  const a = generateChart({ year: 1990, month: 6, day: 15, hour: 4, gender: 'male', name: '甲' });
  const b = generateChart({ year: 1992, month: 3, day: 8, hour: 8, gender: 'female', name: '乙' });
  const natal = describeChart(a);
  assert.match(natal, /命宫/);
  assert.match(natal, new RegExp(a.wuxingJuName));
  assert.equal(natal.includes('埋尸'), false);

  const both = describeHeming(a, b);
  assert.match(both, /甲方/);
  assert.match(both, /乙方/);
  assert.equal(both.includes('埋尸'), false);
  assert.equal(both.includes('草木皆兵'), false);

  const messages = buildInterpretMessages({ chart: a, topic: 'overview', messages: [] });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /命宫/);
  assert.equal(messages.some(m => m.role === 'user'), true);

  const heming = buildHemingMessages({ chartA: a, chartB: b, question: '适合一起做事吗？' });
  assert.match(heming[1].content, /适合一起做事吗/);

  let threw = false;
  try {
    buildInterpretMessages({ chart: { birthInfo: { year: 1990, month: 2, day: 31, hour: 0, gender: 'male' } } });
  } catch (error) {
    threw = true;
    assert.match((error as Error).message, /日期/);
  }
  assert.equal(threw, true);
  console.log('AI chart context checks passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
