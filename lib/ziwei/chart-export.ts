/**
 * 把 generateChart() 的结果收成一份 Markdown。
 * 可读部分按盘面写全；文末 JSON 保留引擎对象，并附上页面会计算的四化、流年、自化、十二神和格局。
 * 不读取环境变量，不引用解读提示词，不调用模型。
 */

import { BRANCHES, PALACE_NAMES_ORDER, STEMS } from '@/lib/ziwei/constants';
import { jsonSafe } from '@/lib/ziwei/export-json';
import { detectDingZa, getCurrentDingZa } from '@/lib/ziwei/patterns-dingza';
import { detectPatterns, getMingGongSummary } from '@/lib/ziwei/patterns';
import {
  boshiShenName,
  jiangQianShenName,
  suiQianShenName,
} from '@/lib/ziwei/shier-shen';
import {
  detectSelfSihua,
  getDaXianSiHua,
  getLiuNianSiHua,
  getSiHuaByStem,
  getYearBranchIndex,
} from '@/lib/ziwei/sihua';
import type { Palace, SiHua, Star, ZiweiChart } from '@/lib/ziwei/types';
import { getChildhoodYears, getDaXianIndexForYear, getDaXianYears } from '@/lib/ziwei/yunxian-context';

const SIHUA_KEYS: SiHua[] = ['禄', '权', '科', '忌'];
const STAR_TYPES = ['major', 'minor', 'lucky', 'sha'] as const;
const TYPE_LABEL: Record<string, string> = {
  major: '主星',
  minor: '辅星',
  lucky: '吉星',
  sha: '煞星',
};
const LEVEL_LABEL = {
  excellent: '上格',
  good: '中格',
  neutral: '平格',
  caution: '留意',
} as const;
const HEMING_AUX = ['红鸾', '天喜', '天姚', '咸池', '孤辰', '寡宿'];

export interface ExportOptions {
  /** 流年展开用的公历年。缺省为导出当时的公历年，与命盘页「流年」默认年份一致。 */
  nowYear?: number;
}

export interface ChartExportFile {
  filename: string;
  markdown: string;
}

interface StarFact {
  name: string;
  type: Star['type'];
  brightness: Star['brightness'] | null;
  brightnessRaw: Star['brightnessRaw'] | null;
  siHua: Star['siHua'] | null;
}

interface PalaceShen {
  branch: number;
  name: string;
  boshi: string;
  jiangQian: string;
  suiQian: string;
}

interface YearRecord {
  year: number;
  age: number;
  stemIndex: number;
  stemName: string;
  branchIndex: number;
  branchName: string;
  transforms: Record<SiHua, string>;
  daXianIndex: number;
  shierShen: PalaceShen[];
}

interface NatalRecord {
  chart: ZiweiChart;
  computed: ReturnType<typeof buildComputed>;
}

function resolveYear(year: number | undefined): number {
  if (typeof year === 'number' && Number.isInteger(year)) return year;
  return new Date().getFullYear();
}

function assertChart(chart: ZiweiChart, label: string): void {
  if (!chart?.birthInfo || !chart.lunarInfo || !Array.isArray(chart.palaces) || !Array.isArray(chart.daXians)) {
    throw new Error(`${label}命盘数据不完整，无法导出`);
  }
}

function safeToken(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function clockLabel(hour: number): string {
  return `${BRANCHES[hour] ?? hour}时`;
}

function dateStamp(chart: ZiweiChart): string {
  const birth = chart.birthInfo;
  const month = String(birth.month).padStart(2, '0');
  const day = String(birth.day).padStart(2, '0');
  return `${birth.year}${month}${day}`;
}

function fileStamp(chart: ZiweiChart): string {
  const birth = chart.birthInfo;
  const date = dateStamp(chart);
  const time = clockLabel(birth.hour);
  const name = birth.name?.trim() ? safeToken(birth.name.trim()) : '';
  return name ? `${name}-${date}-${time}` : `${date}-${time}`;
}

export function natalFilename(chart: ZiweiChart): string {
  return `星垣-命盘-${fileStamp(chart)}.md`;
}

export function hemingFilename(chartA: ZiweiChart, chartB: ZiweiChart): string {
  return `星垣-合盘-${fileStamp(chartA)}-${fileStamp(chartB)}.md`;
}

function starFact(star: Star): StarFact {
  return {
    name: star.name,
    type: star.type,
    brightness: star.brightness ?? null,
    brightnessRaw: star.brightnessRaw ?? null,
    siHua: star.siHua ?? null,
  };
}

function formatStar(star: {
  name: string;
  type: string;
  brightness?: Star['brightness'] | null;
  brightnessRaw?: Star['brightnessRaw'] | null;
  siHua?: Star['siHua'] | null;
}): string {
  const brightness = star.brightnessRaw
    ? `${star.brightnessRaw}${star.brightness ? ` / ${star.brightness}` : ''}`
    : (star.brightness ?? '未标');
  const hua = star.siHua ? `，化${star.siHua}` : '';
  return `${star.name}〔${TYPE_LABEL[star.type] ?? star.type}，亮度 ${brightness}${hua}〕`;
}

function shenRow(chart: ZiweiChart, anchorBranch: number): PalaceShen[] {
  return [...chart.palaces]
    .sort((a, b) => a.branch - b.branch)
    .map(palace => ({
      branch: palace.branch,
      name: palace.name,
      boshi: boshiShenName(chart.lunarInfo.yearStem, chart.birthInfo.gender, palace.branch),
      jiangQian: jiangQianShenName(anchorBranch, palace.branch),
      suiQian: suiQianShenName(anchorBranch, palace.branch),
    }));
}

function yearRecord(chart: ZiweiChart, year: number): YearRecord {
  const sihua = getLiuNianSiHua(year);
  const branchIndex = getYearBranchIndex(year);
  return {
    year,
    age: year - chart.lunarInfo.lunarYear + 1,
    stemIndex: sihua.stemIndex,
    stemName: sihua.stemName,
    branchIndex,
    branchName: BRANCHES[branchIndex] ?? String(branchIndex),
    transforms: sihua.transforms,
    daXianIndex: getDaXianIndexForYear(chart, year),
    shierShen: shenRow(chart, branchIndex),
  };
}

function locate(chart: ZiweiChart, starName: string) {
  if (!starName) return null;
  for (const palace of chart.palaces) {
    const star = palace.stars.find(item => item.name === starName);
    if (!star) continue;
    return {
      palaceName: palace.name,
      branch: palace.branch,
      ...starFact(star),
    };
  }
  return null;
}

function buildComputed(chart: ZiweiChart, nowYear: number) {
  const stemIndex = chart.lunarInfo.yearStem;
  const transforms = getSiHuaByStem(stemIndex);
  const onChart = chart.palaces.flatMap(palace => palace.stars
    .filter(star => star.siHua)
    .map(star => ({
      palaceName: palace.name,
      branch: palace.branch,
      ...starFact(star),
      siHua: star.siHua as SiHua,
    })))
    .sort((a, b) => SIHUA_KEYS.indexOf(a.siHua) - SIHUA_KEYS.indexOf(b.siHua));

  const selfSihua = [...chart.palaces]
    .sort((a, b) => a.branch - b.branch)
    .map(palace => ({
      branch: palace.branch,
      name: palace.name,
      stemIndex: palace.stem,
      stemName: STEMS[palace.stem] ?? '',
      marks: detectSelfSihua(palace),
    }));

  const daXian = chart.daXians.map((limit, index) => {
    const sihua = getDaXianSiHua(chart, index);
    return {
      index,
      startAge: limit.startAge,
      endAge: limit.endAge,
      palaceBranch: limit.palaceBranch,
      palaceName: limit.palaceName,
      isCurrent: index === chart.currentDaXianIndex,
      stemIndex: sihua?.stemIndex ?? null,
      stemName: sihua?.stemName ?? null,
      transforms: sihua?.transforms ?? null,
      shierShen: shenRow(chart, limit.palaceBranch),
    };
  });

  const childhoodYears = getChildhoodYears(chart);
  return {
    sources: {
      chart: 'generateChart',
      patterns: 'detectPatterns',
      dingZa: 'detectDingZa',
      selfSihua: 'detectSelfSihua',
      daXianSihua: 'getDaXianSiHua',
      liuNianSihua: 'getLiuNianSiHua',
      shierShen: 'boshiShenName/jiangQianShenName/suiQianShenName',
    },
    natalSihua: {
      yearStemIndex: stemIndex,
      yearStemName: STEMS[stemIndex] ?? '',
      fromYearStem: transforms,
      fromYearStemLandings: SIHUA_KEYS.map(siHua => ({
        siHua,
        star: transforms[siHua],
        location: locate(chart, transforms[siHua]),
      })),
      onChart,
    },
    selfSihua,
    daXian,
    childhood: {
      years: childhoodYears,
      liuNian: childhoodYears.map(year => yearRecord(chart, year)),
    },
    liuNian: {
      calendarYear: nowYear,
      current: yearRecord(chart, nowYear),
      byDaXian: chart.daXians.map((limit, index) => ({
        index,
        startAge: limit.startAge,
        endAge: limit.endAge,
        palaceName: limit.palaceName,
        palaceBranch: limit.palaceBranch,
        years: getDaXianYears(chart, index).map(year => yearRecord(chart, year)),
      })),
    },
    shierShen: {
      note: '博士十二神按生年干与性别，不跟随大限或流年。将前、岁前在本命按农历年支，大限按该限宫支，流年按该年地支。',
      natalAnchorBranch: chart.lunarInfo.yearBranch,
      natal: shenRow(chart, chart.lunarInfo.yearBranch),
    },
    patterns: detectPatterns(chart),
    dingZa: {
      currentAge: chart.currentAge,
      current: getCurrentDingZa(chart),
      all: detectDingZa(chart),
    },
    mingGongSummary: getMingGongSummary(chart),
  };
}

function genderText(chart: ZiweiChart): string {
  return chart.birthInfo.gender === 'male' ? '男' : '女';
}

function renderBirth(chart: ZiweiChart, summary = getMingGongSummary(chart)): string {
  const birth = chart.birthInfo;
  const lunar = chart.lunarInfo;
  const place = [birth.province, birth.city].filter(Boolean).join('');
  const current = chart.daXians[chart.currentDaXianIndex];
  const policy = (birth as { leapMonthPolicy?: string }).leapMonthPolicy;
  const lines = [
    '## 出生信息',
    '',
    `- 姓名：${birth.name?.trim() || '未署名'}`,
    `- 性别：${genderText(chart)}`,
    `- 阴阳：${chart.yinYangGender ?? '未标'}`,
    `- 排盘公历：${birth.year}年${birth.month}月${birth.day}日`,
    `- 时辰：${clockLabel(birth.hour)}（序号 ${birth.hour}，0=子 … 11=亥）`,
  ];
  if (birth.origInput) {
    const input = birth.origInput;
    const hour = String(input.clockHour).padStart(2, '0');
    const minute = String(input.clockMinute).padStart(2, '0');
    lines.push(`- 表单原始时间：${input.year}年${input.month}月${input.day}日 ${hour}:${minute}（排盘日已按子时规则归到上面的公历）`);
  }
  if (place) lines.push(`- 出生地：${place}`);
  if (typeof birth.longitude === 'number') lines.push(`- 经度：${birth.longitude}（参与真太阳时；未填出生地时引擎不使用）`);
  lines.push(
    `- 农历：${lunar.lunarYear}年${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)}月${lunar.lunarDay}日`,
    `- 年柱：${STEMS[lunar.yearStem] ?? ''}${BRANCHES[lunar.yearBranch] ?? ''}`,
    `- 节气四柱：${lunar.fourPillars?.join(' ') || '未计算'}`,
    `- 农历四柱：${lunar.fourPillarsLunar?.join(' ') || '未计算'}`,
    `- 五行局：${chart.wuxingJuName}（局数 ${chart.wuxingJu}）`,
    `- 命宫：${BRANCHES[chart.mingGongBranch] ?? chart.mingGongBranch}`,
    `- 身宫：${BRANCHES[chart.shenGongBranch] ?? chart.shenGongBranch}`,
    `- 命主：${chart.mingZhu ?? '未标'}`,
    `- 身主：${chart.shenZhu ?? '未标'}`,
    `- 紫微落宫地支：${BRANCHES[chart.ziweiPos] ?? chart.ziweiPos}`,
    `- 虚岁：${chart.currentAge}`,
    current
      ? `- 当前大限：${current.startAge}–${current.endAge}岁 · ${current.palaceName}`
      : `- 当前大限：尚未进入已排大限（序号 ${chart.currentDaXianIndex}）`,
  );
  if (policy) lines.push(`- 闰月口径：${policy}`);
  lines.push(`- 命宫主星：${summary.stars.join('、') || '空宫'}`);
  if (summary.nature) lines.push(`- 星性提示：${summary.nature}`);
  if (summary.keywords.length) lines.push(`- 关键词：${summary.keywords.join('、')}`);
  return lines.join('\n');
}

function renderSihua(computed: ReturnType<typeof buildComputed>): string {
  const natal = computed.natalSihua;
  const fromStem = SIHUA_KEYS.map(key => {
    const landing = natal.fromYearStemLandings.find(item => item.siHua === key);
    const where = landing?.location
      ? `${landing.location.palaceName}（${BRANCHES[landing.location.branch] ?? ''}）`
      : '盘上未找到这颗星';
    return `- ${key}${natal.fromYearStem[key]} → ${where}`;
  });
  const onChart = natal.onChart.length
    ? natal.onChart.map(item => `- ${item.name}化${item.siHua} · ${item.palaceName}（${BRANCHES[item.branch] ?? ''}）${item.brightnessRaw ? ` · 亮度 ${item.brightnessRaw}` : ''}`)
    : ['- 盘上星曜没有生年四化标记'];
  return [
    '## 本命四化',
    '',
    `年干：${natal.yearStemName}`,
    '',
    '年干四化表：',
    ...fromStem,
    '',
    '盘上星曜四化（引擎写在 star.siHua 上的标记）：',
    ...onChart,
  ].join('\n');
}

function palaceOrder(chart: ZiweiChart): Palace[] {
  const rank = new Map(PALACE_NAMES_ORDER.map((name, index) => [name, index]));
  return [...chart.palaces].sort((a, b) => {
    const ar = rank.get(a.name) ?? 99;
    const br = rank.get(b.name) ?? 99;
    return ar - br || a.branch - b.branch;
  });
}

function renderPalace(chart: ZiweiChart, palace: Palace, computed: ReturnType<typeof buildComputed>): string {
  const self = computed.selfSihua.find(item => item.branch === palace.branch);
  const shen = computed.shierShen.natal.find(item => item.branch === palace.branch);
  const lines = [
    `### ${palace.name} · ${STEMS[palace.stem] ?? ''}${BRANCHES[palace.branch] ?? ''}`,
    '',
    `- 地支序号：${palace.branch}`,
    `- 天干序号：${palace.stem}`,
    `- 命宫：${palace.isMingGong ? '是' : '否'}`,
    `- 身宫：${palace.isShenGong ? '是' : '否'}`,
    `- 当前大限所在：${palace.isCurrentDaXian ? '是' : '否'}`,
    `- 大限年龄：${palace.daXianAge ? `${palace.daXianAge[0]}–${palace.daXianAge[1]}岁` : '未排'}`,
    `- 对宫地支：${palace.oppositeBranch ?? '未标'}（${palace.oppositeBranch == null ? '' : BRANCHES[palace.oppositeBranch] ?? ''}）`,
    `- 空宫：${palace.isEmpty ? '是' : '否'}`,
  ];
  if (palace.isEmpty) {
    lines.push(`- 借宫：${palace.borrowedFromName ?? '未标'}（地支 ${palace.borrowedFromBranch ?? '未标'}）`);
    lines.push(`- 借来的主星：${palace.borrowedStars?.length ? palace.borrowedStars.join('、') : '无'}`);
  }
  for (const type of STAR_TYPES) {
    const list = palace.stars.filter(star => star.type === type);
    lines.push(`- ${TYPE_LABEL[type]}：${list.length ? list.map(formatStar).join('、') : '无'}`);
  }
  const known = new Set<string>(STAR_TYPES);
  const other = palace.stars.filter(star => !known.has(star.type));
  if (other.length) lines.push(`- 其他星曜：${other.map(formatStar).join('、')}`);
  const marks = self?.marks ?? [];
  lines.push(`- 自化：${marks.length ? marks.map(mark => `${mark.starName}自化${mark.siHua}`).join('、') : '无'}`);
  lines.push(shen
    ? `- 本命十二神：博士 ${shen.boshi}，将前 ${shen.jiangQian}，岁前 ${shen.suiQian}`
    : '- 本命十二神：未计算');
  return lines.join('\n');
}

function renderPalaces(chart: ZiweiChart, computed: ReturnType<typeof buildComputed>): string {
  return [
    '## 十二宫',
    '',
    '顺序从命宫起。每颗星都列出类别和亮度；没有亮度的写「未标」。',
    '',
    palaceOrder(chart).map(palace => renderPalace(chart, palace, computed)).join('\n\n'),
  ].join('\n');
}

function renderTransforms(transforms: Record<SiHua, string> | null): string {
  if (!transforms) return '未计算';
  return SIHUA_KEYS.map(key => `${key}${transforms[key]}`).join('、');
}

function renderDaXian(computed: ReturnType<typeof buildComputed>): string {
  const blocks = computed.daXian.map(limit => {
    const shen = limit.shierShen.map(item => `${item.name}：博士 ${item.boshi}，将前 ${item.jiangQian}，岁前 ${item.suiQian}`).join('；');
    return [
      `### ${limit.isCurrent ? '当前大限' : '大限'} ${limit.startAge}–${limit.endAge}岁 · ${limit.palaceName}`,
      '',
      `- 序号：${limit.index}`,
      `- 宫位地支：${BRANCHES[limit.palaceBranch] ?? limit.palaceBranch}`,
      `- 宫干：${limit.stemName ?? '未计算'}`,
      `- 大限四化：${renderTransforms(limit.transforms)}`,
      `- 此限十二神：${shen}`,
    ].join('\n');
  });
  const childhood = computed.childhood.years.length
    ? `童限年份（第一大限之前）：${computed.childhood.years.join('、')}。各年四化在文末 JSON 的 childhood.liuNian。`
    : '童限：第一大限自 1 岁起，没有单独的童限年份。';
  return ['## 大限', '', childhood, '', blocks.join('\n\n')].join('\n');
}

function yearLine(record: YearRecord): string {
  return `- ${record.year} ${record.stemName}${record.branchName}（虚岁 ${record.age}，所属大限序号 ${record.daXianIndex}）：${renderTransforms(record.transforms)}`;
}

function renderLiuNian(computed: ReturnType<typeof buildComputed>): string {
  const current = computed.liuNian.current;
  const currentShen = current.shierShen
    .map(item => `${item.name}：博士 ${item.boshi}，将前 ${item.jiangQian}，岁前 ${item.suiQian}`)
    .join('；');
  const byLimit = computed.liuNian.byDaXian.map(limit => [
    `### ${limit.startAge}–${limit.endAge}岁 · ${limit.palaceName}`,
    '',
    ...limit.years.map(yearLine),
  ].join('\n'));
  return [
    '## 流年',
    '',
    `下面按公历 ${computed.liuNian.calendarYear} 年列出当前流年，并逐限列出该限内每一年的四化。各年的将前、岁前十二神在文末 JSON 的 liuNian，不在这里缩写成一行。`,
    '',
    `### 公历 ${current.year} 年`,
    '',
    yearLine(current),
    `- 流年十二神：${currentShen}`,
    '',
    ...byLimit,
  ].join('\n');
}

function renderPatterns(computed: ReturnType<typeof buildComputed>): string {
  const patterns = computed.patterns;
  const body = patterns.length
    ? patterns.map(pattern => {
      const lines = [
        `### ${pattern.name}`,
        '',
        `- 层次：${LEVEL_LABEL[pattern.level]}`,
        `- 宫位：${pattern.palaces.join('、') || '未标'}`,
        `- 说明：${pattern.description}`,
      ];
      if (pattern.conditions?.required?.length) lines.push(`- 必须：${pattern.conditions.required.join('；')}`);
      if (pattern.conditions?.bonus?.length) lines.push(`- 加分：${pattern.conditions.bonus.join('；')}`);
      if (pattern.conditions?.breaking?.length) lines.push(`- 破格：${pattern.conditions.breaking.join('；')}`);
      if (pattern.source) lines.push(`- 出处：${pattern.source}`);
      return lines.join('\n');
    }).join('\n\n')
    : '这张盘没有命中引擎里的格局规则。';
  const ding = computed.dingZa.all.length
    ? computed.dingZa.all.map(hit => `- 第${hit.no}条 ${hit.name}（${hit.unit}${hit.startAge ?? '?'}–${hit.endAge ?? '?'}岁${hit.palaceName ? ` · ${hit.palaceName}` : ''}）：${hit.note}${hit.detail ? ` ${hit.detail}` : ''}`)
    : ['- 未命中定杂局。'];
  return [
    '## 格局',
    '',
    '以下是 detectPatterns 的全部命中，不截断、不改写。',
    '',
    body,
    '',
    '## 定杂局',
    '',
    `detectDingZa 的全部命中。当前虚岁 ${computed.dingZa.currentAge} 的命中另存于 JSON 的 dingZa.current。定杂局按运限成立，不并进上面的命盘格局。`,
    '',
    ...ding,
  ].join('\n');
}

function renderNatalBody(chart: ZiweiChart, computed: ReturnType<typeof buildComputed>): string {
  return [
    renderBirth(chart, computed.mingGongSummary),
    '',
    renderSihua(computed),
    '',
    renderPalaces(chart, computed),
    '',
    renderDaXian(computed),
    '',
    renderLiuNian(computed),
    '',
    renderPatterns(computed),
  ].join('\n');
}

function fencedJson(value: unknown): string {
  const body = JSON.stringify(value, null, 2) ?? 'null';
  let fence = '```';
  while (body.includes(fence)) fence += '`';
  return `${fence}json\n${body}\n${fence}`;
}

function intro(nowYear: number, kind: '命盘' | '合盘'): string {
  return [
    `# 星垣 · ${kind}`,
    '',
    '本文件由星垣在本地用开源排盘引擎导出。没有调用模型，文件里没有 API 密钥、环境变量或提示词。',
    '',
    '前面是可读的完整盘面。文末 JSON 是同一份结果的结构化全文：引擎返回的命盘（十二宫、星曜、四化，以及其他已经算出的字段）都在；页面会跟着算的大限四化、流年、自化、十二神和格局也在。可选字段没有算出时写成 null。交给分析时请发送整个文件，不要只复制界面上的文字。',
    '',
    `流年按公历 ${nowYear} 年展开，与命盘页「流年」打开时的默认年份同一口径。`,
  ].join('\n');
}

function natalRecord(chart: ZiweiChart, nowYear: number): NatalRecord {
  const source = jsonSafe(chart);
  return {
    chart: source,
    computed: jsonSafe(buildComputed(source, nowYear)),
  };
}

export function buildNatalExport(chart: ZiweiChart, options: ExportOptions = {}): ChartExportFile {
  assertChart(chart, '');
  const nowYear = resolveYear(options.nowYear);
  const record = {
    kind: 'natal' as const,
    app: '星垣',
    source: 'local-engine',
    modelCalled: false,
    liuNianYear: nowYear,
    ...natalRecord(chart, nowYear),
  };
  const markdown = [
    intro(nowYear, '命盘'),
    '',
    renderNatalBody(record.chart, record.computed),
    '',
    '## 结构化记录',
    '',
    '下面的 JSON 是这份命盘的无损记录。',
    '',
    fencedJson(record),
    '',
  ].join('\n');
  return { filename: natalFilename(chart), markdown };
}

function rolePalace(chart: ZiweiChart, label: string): Palace | undefined {
  const key = label.replace(/宫$/, '');
  return chart.palaces.find(palace => palace.name.replace(/宫$/, '') === key);
}

function majorNames(palace: Palace | undefined): string[] {
  if (!palace) return [];
  const majors = palace.stars.filter(star => star.type === 'major').map(star => star.name);
  if (majors.length) return majors;
  return palace.borrowedStars ?? [];
}

function palaceBundle(chart: ZiweiChart, label: string) {
  const palace = rolePalace(chart, label);
  if (!palace) return null;
  return {
    name: palace.name,
    branch: palace.branch,
    isEmpty: palace.isEmpty ?? false,
    borrowedFromName: palace.borrowedFromName ?? null,
    borrowedStars: palace.borrowedStars ?? null,
    majors: majorNames(palace),
    stars: palace.stars.map(starFact),
  };
}

function sihuaOnto(from: ZiweiChart, to: ZiweiChart) {
  const transforms = getSiHuaByStem(from.lunarInfo.yearStem);
  return SIHUA_KEYS.map(siHua => ({
    siHua,
    star: transforms[siHua],
    location: locate(to, transforms[siHua]),
  }));
}

function buildCombination(chartA: ZiweiChart, chartB: ZiweiChart) {
  const aMing = majorNames(rolePalace(chartA, '命宫'));
  const bMing = majorNames(rolePalace(chartB, '命宫'));
  const aFuqi = majorNames(rolePalace(chartA, '夫妻'));
  const bFuqi = majorNames(rolePalace(chartB, '夫妻'));
  const aHits = aFuqi.some(star => bMing.includes(star));
  const bHits = bFuqi.some(star => aMing.includes(star));
  const auxStars = ([['甲', chartA], ['乙', chartB]] as const).flatMap(([side, chart]) => (
    chart.palaces.flatMap(palace => palace.stars
      .filter(star => HEMING_AUX.includes(star.name))
      .map(star => ({
        side,
        palaceName: palace.name,
        branch: palace.branch,
        ...starFact(star),
      })))
  ));
  return {
    note: '空宫对照使用借来的主星。这是结构观察，不是评分。',
    personA: {
      ming: palaceBundle(chartA, '命宫'),
      fuqi: palaceBundle(chartA, '夫妻'),
      fude: palaceBundle(chartA, '福德'),
    },
    personB: {
      ming: palaceBundle(chartB, '命宫'),
      fuqi: palaceBundle(chartB, '夫妻'),
      fude: palaceBundle(chartB, '福德'),
    },
    aFuqiHitsBMing: aHits,
    bFuqiHitsAMing: bHits,
    mirror: aHits && bHits ? '双向互映' : aHits || bHits ? '单向对应' : '未见互映',
    aNatalSihuaOnB: sihuaOnto(chartA, chartB),
    bNatalSihuaOnA: sihuaOnto(chartB, chartA),
    auxStars,
  };
}

function renderLanding(title: string, rows: ReturnType<typeof sihuaOnto>): string {
  const lines = rows.map(row => {
    const where = row.location ? `${row.location.palaceName}（${BRANCHES[row.location.branch] ?? ''}）` : '对方盘未找到这颗星';
    return `- ${row.siHua}${row.star} → ${where}`;
  });
  return [`### ${title}`, '', ...lines].join('\n');
}

function renderCombination(chartA: ZiweiChart, chartB: ZiweiChart, combination: ReturnType<typeof buildCombination>): string {
  const aux = combination.auxStars.length
    ? combination.auxStars.map(star => `- ${star.side}方${star.palaceName}：${formatStar(star)}`)
    : ['- 两张盘的十二宫里没有红鸾、天喜、天姚、咸池、孤辰、寡宿。'];
  return [
    '## 两盘对照',
    '',
    `- 甲方：${chartA.birthInfo.name?.trim() || '未署名'} · ${genderText(chartA)} · ${chartA.yinYangGender ?? ''} · ${chartA.wuxingJuName}`,
    `- 乙方：${chartB.birthInfo.name?.trim() || '未署名'} · ${genderText(chartB)} · ${chartB.yinYangGender ?? ''} · ${chartB.wuxingJuName}`,
    `- 甲方命宫主星：${combination.personA.ming?.majors.join('、') || '空宫'}`,
    `- 乙方命宫主星：${combination.personB.ming?.majors.join('、') || '空宫'}`,
    `- 甲方夫妻宫主星：${combination.personA.fuqi?.majors.join('、') || '空宫'}`,
    `- 乙方夫妻宫主星：${combination.personB.fuqi?.majors.join('、') || '空宫'}`,
    `- 甲方福德宫主星：${combination.personA.fude?.majors.join('、') || '空宫'}`,
    `- 乙方福德宫主星：${combination.personB.fude?.majors.join('、') || '空宫'}`,
    `- 夫妻宫与对方命宫：${combination.mirror}`,
    '',
    renderLanding('甲方生年四化落在乙方', combination.aNatalSihuaOnB),
    '',
    renderLanding('乙方生年四化落在甲方', combination.bNatalSihuaOnA),
    '',
    '### 婚恋相关杂耀',
    '',
    '只记录星落在哪一宫。不附讲课原话。',
    '',
    ...aux,
  ].join('\n');
}

export function buildHemingExport(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  options: ExportOptions = {},
): ChartExportFile {
  assertChart(chartA, '甲方');
  assertChart(chartB, '乙方');
  const nowYear = resolveYear(options.nowYear);
  const personA = natalRecord(chartA, nowYear);
  const personB = natalRecord(chartB, nowYear);
  const combination = jsonSafe(buildCombination(personA.chart, personB.chart));
  const record = {
    kind: 'heming' as const,
    app: '星垣',
    source: 'local-engine',
    modelCalled: false,
    liuNianYear: nowYear,
    personA: { role: '甲', ...personA },
    personB: { role: '乙', ...personB },
    combination,
  };
  const markdown = [
    intro(nowYear, '合盘'),
    '',
    renderCombination(personA.chart, personB.chart, combination),
    '',
    '## 甲方',
    '',
    renderNatalBody(personA.chart, personA.computed),
    '',
    '## 乙方',
    '',
    renderNatalBody(personB.chart, personB.computed),
    '',
    '## 结构化记录',
    '',
    '下面的 JSON 同时包含甲方、乙方的完整命盘，以及上面的对照。',
    '',
    fencedJson(record),
    '',
  ].join('\n');
  return { filename: hemingFilename(chartA, chartB), markdown };
}
