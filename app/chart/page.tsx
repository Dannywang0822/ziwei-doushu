'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import ChartFacts from '@/components/studio/ChartFacts';
import StudioFrame from '@/components/studio/StudioFrame';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 排盘页。命盘由本仓库的 generateChart() 在浏览器里算出。
 * 右侧阅读调用本机的 /api/interpret；没配密钥时接口会说明，不会假装已经解读。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{
    starName: string;
    siHua: string;
    view: 'mingpan' | 'daxian' | 'liunian';
  } | null>(null);

  if (!chart) {
    return (
      <StudioFrame>
        <main className="xy-narrow">
          <p className="xy-kicker">排盘</p>
          <h1 className="xy-title">先把盘立起来</h1>
          <p className="xy-lead">
            出生时间在浏览器里换算成真太阳时和时辰，再交给开源引擎起盘。
            解读是下一步，单独向你配置的模型请求。
          </p>
          <div className="xy-card">
            <BirthForm onSubmit={(info: BirthInfo) => {
              setSelectedPalace(null);
              setSelectedSiHua(null);
              setChart(generateChart(info));
            }} />
          </div>
        </main>
      </StudioFrame>
    );
  }

  return (
    <StudioFrame>
      <main className="xy-wide">
        <button
          type="button"
          onClick={() => { setChart(null); setSelectedPalace(null); setSelectedSiHua(null); }}
          className="xy-textbtn"
        >
          ← 重新起盘
        </button>
        <ChartFacts chart={chart} />
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
          style={{ gap: 20, marginTop: 16, alignItems: 'start' }}
        >
          <ChartBoard
            chart={chart}
            onPalaceSelect={setSelectedPalace}
            onSiHuaClick={(starName, siHua, view) => setSelectedSiHua({ starName, siHua, view })}
          />
          <InsightPanel chart={chart} selectedPalace={selectedPalace} selectedSiHua={selectedSiHua} />
        </div>
      </main>
    </StudioFrame>
  );
}
