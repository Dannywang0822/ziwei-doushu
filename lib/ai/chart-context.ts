import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import { STAR_IN_FUQI_GU, HEMING_SCORE_CRITERIA, MARRIAGE_STARS_BRIEF } from '@/lib/ziwei/heming-knowledge';
import { detectPatterns, getMingGongSummary } from '@/lib/ziwei/patterns';
import { getSiHuaByStem } from '@/lib/ziwei/sihua';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';

const LEVEL_LABEL = {
  excellent: '上格',
  good: '中格',
  neutral: '平格',
  caution: '留意',
} as const;

function clip(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function role(name: string): string {
  return name.replace(/宫$/, '');
}

function findPalace(chart: ZiweiChart, label: string): Palace | undefined {
  const key = role(label);
  return chart.palaces.find(p => role(p.name) === key);
}

function starLine(star: Star): string {
  const bits = [star.name];
  if (star.brightnessRaw) bits.push(star.brightnessRaw);
  else if (star.brightness === 'bright') bits.push('庙旺');
  else if (star.brightness === 'dim') bits.push('落陷');
  if (star.siHua) bits.push(`化${star.siHua}`);
  return bits.join('');
}

function starsOf(palace: Palace | undefined, type?: Star['type']): string {
  if (!palace) return '盘面未显示';
  const list = palace.stars.filter(s => (type ? s.type === type : true));
  if (type === 'major' && list.length === 0) {
    const borrowed = palace.borrowedStars?.length
      ? palace.borrowedStars.join('、')
      : '无';
    return `空宫，借${palace.borrowedFromName ?? '对宫'}：${borrowed}`;
  }
  if (list.length === 0) return '无';
  return list.map(starLine).join('、');
}

function minorLine(palace: Palace): string {
  const minors = palace.stars.filter(s => s.type !== 'major');
  return minors.length ? minors.map(starLine).join('、') : '无';
}

export function describeChart(chart: ZiweiChart): string {
  const birth = chart.birthInfo;
  const lunar = chart.lunarInfo;
  const gender = birth.gender === 'male' ? '男' : '女';
  const pillars = lunar.fourPillars?.join(' ') || '盘面未显示';
  const lunarText = lunar
    ? `${lunar.lunarYear}年${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)}月${lunar.lunarDay}日`
    : '盘面未显示';
  const summary = getMingGongSummary(chart);
  const patterns = detectPatterns(chart).slice(0, 8);
  const current = chart.daXians[chart.currentDaXianIndex];
  const sihua = getSiHuaByStem(lunar.yearStem);

  const lines = [
    `称呼：${birth.name?.trim() || '未署名'}`,
    `性别：${gender}（${chart.yinYangGender ?? '未标阴阳'}）`,
    `排盘公历：${birth.year}-${birth.month}-${birth.day}，时辰序号 ${birth.hour}（0=子 … 11=亥）`,
    birth.city ? `出生地：${birth.province ?? ''}${birth.city}` : '',
    `农历：${lunarText}`,
    `四柱：${pillars}`,
    `五行局：${chart.wuxingJuName}`,
    `命宫地支：${BRANCHES[chart.mingGongBranch] ?? ''}`,
    `身宫地支：${BRANCHES[chart.shenGongBranch] ?? ''}`,
    `命主：${chart.mingZhu ?? '未标'}；身主：${chart.shenZhu ?? '未标'}`,
    `虚岁：${chart.currentAge}`,
    `生年四化：禄${sihua.禄}、权${sihua.权}、科${sihua.科}、忌${sihua.忌}`,
    `命宫主星：${summary.stars.join('、') || '空宫'}`,
    summary.nature ? `星性提示：${summary.nature}` : '',
    summary.keywords.length ? `关键词：${summary.keywords.join('、')}` : '',
    current
      ? `当前大限：${current.startAge}–${current.endAge}岁，宫位${current.palaceName}`
      : '当前大限：盘面未显示',
    patterns.length
      ? `格局（引擎命中，最多 8 条）：\n${patterns.map(p => `- ${p.name}（${LEVEL_LABEL[p.level]}）${clip(p.description)}`).join('\n')}`
      : '格局：这张盘没有命中引擎里的格局规则。',
    '十二宫：',
    ...chart.palaces
      .slice()
      .sort((a, b) => a.branch - b.branch)
      .map(p => `${p.name}（${STEMS[p.stem] ?? ''}${BRANCHES[p.branch] ?? ''}）主星 ${starsOf(p, 'major')}；其余 ${minorLine(p)}`),
  ];
  return lines.filter(Boolean).join('\n');
}

function majorNames(palace: Palace | undefined): string[] {
  if (!palace) return [];
  const majors = palace.stars.filter(s => s.type === 'major').map(s => s.name);
  if (majors.length) return majors;
  return palace.borrowedStars ?? [];
}

function landings(from: ZiweiChart, to: ZiweiChart): string {
  const sihua = getSiHuaByStem(from.lunarInfo.yearStem);
  const entries = (['禄', '权', '科', '忌'] as const).map(key => {
    const star = sihua[key];
    const palace = to.palaces.find(p => p.stars.some(s => s.name === star));
    return `${key}${star} → ${palace ? palace.name : '对方盘未找到这颗星'}`;
  });
  return entries.join('；');
}

function marriageNote(star: string): string | null {
  const row = STAR_IN_FUQI_GU[star];
  if (!row) return null;
  return `${star}：${row.summary} 配偶侧写：${row.spouse_traits} 传统时机说法：${row.timing} 顺遂时：${clip(row.good, 80)}`;
}

export function describeHeming(chartA: ZiweiChart, chartB: ZiweiChart): string {
  const aMing = majorNames(findPalace(chartA, '命宫'));
  const bMing = majorNames(findPalace(chartB, '命宫'));
  const aFu = majorNames(findPalace(chartA, '夫妻'));
  const bFu = majorNames(findPalace(chartB, '夫妻'));
  const aToB = aFu.some(star => bMing.includes(star));
  const bToA = bFu.some(star => aMing.includes(star));
  const mirror = aToB && bToA ? '双向互映' : aToB || bToA ? '单向对应' : '材料未显示互映';

  const interest = new Set([...aFu, ...bFu, ...aMing, ...bMing]);
  const notes = [...interest].map(marriageNote).filter((x): x is string => Boolean(x));

  const auxStars = ['红鸾', '天喜', '天姚', '咸池', '孤辰', '寡宿'];
  const aux: string[] = [];
  for (const [label, chart] of [['甲方', chartA], ['乙方', chartB]] as const) {
    for (const palaceName of ['命宫', '夫妻']) {
      const palace = findPalace(chart, palaceName);
      if (!palace) continue;
      for (const star of palace.stars) {
        if (auxStars.includes(star.name) && MARRIAGE_STARS_BRIEF[star.name]) {
          aux.push(`${label}${palace.name}有${star.name}：${MARRIAGE_STARS_BRIEF[star.name]}`);
        }
      }
    }
  }

  const score = Object.entries(HEMING_SCORE_CRITERIA)
    .map(([name, text]) => `${name}：${text}`)
    .join('\n');

  return [
    '下面是引擎算出的对照，不是评分结论。',
    '',
    '【甲方】',
    describeChart(chartA),
    '',
    '【乙方】',
    describeChart(chartB),
    '',
    '【结构对照】',
    `甲方命宫主星：${aMing.join('、') || '空宫'}`,
    `乙方命宫主星：${bMing.join('、') || '空宫'}`,
    `甲方夫妻宫主星：${aFu.join('、') || '空宫'}`,
    `乙方夫妻宫主星：${bFu.join('、') || '空宫'}`,
    `甲方福德宫：${starsOf(findPalace(chartA, '福德'), 'major')}`,
    `乙方福德宫：${starsOf(findPalace(chartB, '福德'), 'major')}`,
    `夫妻宫与对方命宫：${mirror}`,
    `甲方生年四化落在乙方：${landings(chartA, chartB)}`,
    `乙方生年四化落在甲方：${landings(chartB, chartA)}`,
    notes.length ? `夫妻宫星情摘记（只取公开知识里的概要，不含讲课原话）：\n${notes.map(n => `- ${n}`).join('\n')}` : '',
    aux.length ? `婚恋相关杂耀：\n${aux.map(n => `- ${n}`).join('\n')}` : '婚恋杂耀：命宫与夫妻宫未见到红鸾、天喜、天姚、咸池、孤辰、寡宿。',
    `参考尺度（只供措辞，不要打分打星）：\n${score}`,
  ].filter(Boolean).join('\n');
}
