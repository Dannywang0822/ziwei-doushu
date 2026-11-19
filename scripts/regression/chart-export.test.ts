/**
 * 盘面导出必须带上十二宫、星曜和四化，文末 JSON 不得丢掉引擎字段。
 * patterns.ts 带 server-only，测试里先把它解析成空模块。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { generateChart } from '../../lib/ziwei/algorithm';
import { jsonSafe } from '../../lib/ziwei/export-json';
import type { ZiweiChart } from '../../lib/ziwei/types';

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

function parseExportJson(markdown: string): Record<string, unknown> {
  const lines = markdown.split('\n');
  const open = lines.findIndex(line => /^`{3,}json$/.test(line));
  assert.ok(open >= 0, 'markdown should end with a json fence');
  const fence = lines[open].match(/^(`+)json$/)?.[1];
  assert.ok(fence);
  const close = lines.findIndex((line, index) => index > open && line === fence);
  assert.ok(close > open, 'json fence should close');
  return JSON.parse(lines.slice(open + 1, close).join('\n')) as Record<string, unknown>;
}

function branchesOf(palaces: { branch: number }[]): number[] {
  return palaces.map(palace => palace.branch).sort((a, b) => a - b);
}

function assertChartPayload(chart: ZiweiChart, payload: { palaces: { branch: number; name: string; stars: { name: string }[] }[] }) {
  assert.equal(payload.palaces.length, 12);
  assert.deepEqual(branchesOf(payload.palaces), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  for (const palace of chart.palaces) {
    const got = payload.palaces.find(item => item.branch === palace.branch);
    assert.ok(got, `missing palace branch ${palace.branch}`);
    assert.equal(got.name, palace.name);
    assert.equal(got.stars.length, palace.stars.length, `${palace.name} dropped a star`);
    palace.stars.forEach((star, index) => {
      assert.equal(got.stars[index].name, star.name);
    });
  }
}

function assertNoSecrets(markdown: string) {
  assert.equal(markdown.includes('XAI_API_KEY'), false);
  assert.equal(markdown.includes('AI_API_KEY'), false);
  assert.equal(markdown.includes('api.x.ai'), false);
  assert.equal(markdown.includes('你是「星垣」的紫微斗数阅读助手'), false);
  assert.equal(markdown.includes('半路埋尸'), false);
  assert.equal(markdown.includes('草木皆兵'), false);
}

async function main() {
  const { buildHemingExport, buildNatalExport } = await import('../../lib/ziwei/chart-export');
  const { detectPatterns } = await import('../../lib/ziwei/patterns');
  const { detectDingZa } = await import('../../lib/ziwei/patterns-dingza');
  const { getSiHuaByStem } = await import('../../lib/ziwei/sihua');

  const chart = generateChart({
    year: 1990, month: 6, day: 15, hour: 4, gender: 'male', name: '甲/乙',
    province: '北京', city: '北京', longitude: 116.4,
  });
  const plain = generateChart({ year: 1990, month: 6, day: 15, hour: 4, gender: 'male', name: '甲' });
  const unnamed = generateChart({ year: 1990, month: 6, day: 15, hour: 4, gender: 'male' });

  assert.deepEqual(
    jsonSafe(detectPatterns(chart)),
    jsonSafe(detectPatterns(jsonSafe(chart))),
    'normalizing empty fields to null should not change pattern hits',
  );

  const file = buildNatalExport(plain, { nowYear: 2026 });
  const viaClient = buildNatalExport(jsonSafe(plain), { nowYear: 2026 });
  assert.equal(file.filename, '星垣-命盘-甲-19900615-辰时.md');
  assert.equal(buildNatalExport(unnamed, { nowYear: 2026 }).filename, '星垣-命盘-19900615-辰时.md');
  assert.equal(buildNatalExport(chart, { nowYear: 2026 }).filename, '星垣-命盘-甲-乙-19900615-辰时.md');
  assert.equal(file.markdown, viaClient.markdown);

  assert.match(file.markdown, /## 十二宫/);
  assert.match(file.markdown, /## 本命四化/);
  assert.match(file.markdown, /## 大限/);
  assert.match(file.markdown, /## 流年/);
  assert.match(file.markdown, /## 格局/);
  assert.match(file.markdown, /## 定杂局/);
  assert.match(file.markdown, /自化/);
  assert.match(file.markdown, /2026/);
  const located = buildNatalExport(chart, { nowYear: 2026 });
  assert.match(located.markdown, /北京/);
  assert.match(located.markdown, /116\.4/);
  assert.equal(located.markdown.includes('undefined化'), false);
  for (const palace of plain.palaces) {
    assert.ok(file.markdown.includes(`### ${palace.name}`), `prose missing ${palace.name}`);
    for (const star of palace.stars) assert.ok(file.markdown.includes(star.name), `prose missing ${star.name}`);
  }
  const sihua = getSiHuaByStem(plain.lunarInfo.yearStem);
  for (const key of ['禄', '权', '科', '忌'] as const) {
    assert.match(file.markdown, new RegExp(`${key}${sihua[key]}`));
  }
  assertNoSecrets(file.markdown);

  const parsed = parseExportJson(file.markdown);
  assert.equal(parsed.kind, 'natal');
  assert.equal(parsed.modelCalled, false);
  assert.deepEqual(parsed.chart, jsonSafe(plain));
  const payload = parsed.chart as { palaces: { branch: number; name: string; stars: { name: string; siHua?: string | null }[] }[] };
  assertChartPayload(plain, payload);
  const withSihua = payload.palaces.flatMap(palace => palace.stars).filter(star => star.siHua);
  assert.ok(withSihua.length >= 1, 'natal sihua should survive in the JSON');

  const computed = parsed.computed as {
    selfSihua: unknown[];
    daXian: { transforms: Record<string, string> | null }[];
    patterns: unknown[];
    dingZa: { all: unknown[] };
    natalSihua: { onChart: unknown[]; fromYearStem: Record<string, string> };
    liuNian: { calendarYear: number; byDaXian: { years: unknown[] }[] };
  };
  assert.equal(computed.selfSihua.length, 12);
  assert.equal(computed.daXian.length, plain.daXians.length);
  assert.ok(computed.daXian.some(limit => limit.transforms && limit.transforms['禄']));
  assert.equal(computed.natalSihua.fromYearStem['禄'], sihua.禄);
  assert.ok(computed.natalSihua.onChart.length >= 1);
  assert.equal(computed.liuNian.calendarYear, 2026);
  assert.ok(computed.liuNian.byDaXian.some(limit => limit.years.length > 0));
  assert.deepEqual(computed.patterns, jsonSafe(detectPatterns(plain)));
  assert.deepEqual(computed.dingZa.all, jsonSafe(detectDingZa(plain)));
  assert.equal(JSON.stringify(parsed).includes('XAI_API_KEY'), false);

  const other = generateChart({ year: 1992, month: 3, day: 8, hour: 8, gender: 'female', name: '乙' });
  const heming = buildHemingExport(plain, other, { nowYear: 2026 });
  assert.equal(heming.filename, '星垣-合盘-甲-19900615-辰时-乙-19920308-申时.md');
  assert.match(heming.markdown, /## 两盘对照/);
  assert.match(heming.markdown, /## 甲方/);
  assert.match(heming.markdown, /## 乙方/);
  assert.equal((heming.markdown.match(/### 命宫/g) ?? []).length, 2);
  for (const palace of [...plain.palaces, ...other.palaces]) {
    assert.ok(heming.markdown.includes(palace.name));
  }
  assertNoSecrets(heming.markdown);
  const both = parseExportJson(heming.markdown);
  assert.equal(both.kind, 'heming');
  const personA = both.personA as { chart: typeof payload };
  const personB = both.personB as { chart: typeof payload };
  assertChartPayload(plain, personA.chart);
  assertChartPayload(other, personB.chart);
  assert.deepEqual(personA.chart, jsonSafe(plain));
  assert.deepEqual(personB.chart, jsonSafe(other));
  const combination = both.combination as { mirror: string; aNatalSihuaOnB: unknown[]; bNatalSihuaOnA: unknown[] };
  assert.match(combination.mirror, /双向互映|单向对应|未见互映/);
  assert.equal(combination.aNatalSihuaOnB.length, 4);
  assert.equal(combination.bNatalSihuaOnA.length, 4);

  const chartPage = readFileSync(new URL('../../app/chart/page.tsx', import.meta.url), 'utf8');
  const hemingPage = readFileSync(new URL('../../app/heming/page.tsx', import.meta.url), 'utf8');
  assert.match(chartPage, /导出盘面文件/);
  assert.match(chartPage, /buildNatalExport/);
  assert.equal(chartPage.includes('/api/interpret'), false);
  assert.match(hemingPage, /导出盘面文件/);
  const exportStart = hemingPage.indexOf('const exportChartFile');
  const exportFn = hemingPage.slice(exportStart, hemingPage.indexOf('const cardStyle', exportStart));
  assert.match(exportFn, /buildHemingExport/);
  assert.equal(exportFn.includes('/api/heming'), false);
  assert.equal(exportFn.includes('fetch('), false);

  console.log('chart export file checks passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
