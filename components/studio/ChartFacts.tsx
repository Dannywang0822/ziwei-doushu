'use client';

import { BRANCHES } from '@/lib/ziwei/constants';
import type { ZiweiChart } from '@/lib/ziwei/types';

function majors(chart: ZiweiChart, palaceName: string): string {
  const key = palaceName.replace(/宫$/, '');
  const palace = chart.palaces.find(p => p.name.replace(/宫$/, '') === key);
  if (!palace) return '未见';
  const names = palace.stars.filter(s => s.type === 'major').map(s => s.name);
  if (names.length) return names.join('、');
  if (palace.borrowedStars?.length) return `空宫，借${palace.borrowedStars.join('、')}`;
  return '空宫';
}

export default function ChartFacts({ chart }: { chart: ZiweiChart }) {
  const birth = chart.birthInfo;
  const lunar = chart.lunarInfo;
  const current = chart.daXians[chart.currentDaXianIndex];
  const gender = birth.gender === 'male' ? '男' : '女';
  const lunarText = `${lunar.lunarYear}年${lunar.isLeapMonth ? '闰' : ''}${Math.abs(lunar.lunarMonth)}月${lunar.lunarDay}日`;

  const items = [
    ['命主', birth.name?.trim() || '未署名'],
    ['阴阳', chart.yinYangGender || gender],
    ['五行局', chart.wuxingJuName],
    ['农历', lunarText],
    ['四柱', lunar.fourPillars?.join(' ') || '未显示'],
    ['命宫', `${BRANCHES[chart.mingGongBranch] ?? ''} · ${majors(chart, '命宫')}`],
    ['身宫', BRANCHES[chart.shenGongBranch] ?? ''],
    ['身主', chart.shenZhu || '未标'],
    ['当前大限', current ? `${current.startAge}–${current.endAge}岁 · ${current.palaceName}` : '未入大限'],
  ];

  return (
    <section className="xy-facts" aria-label="命盘事实">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}
