'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import ChartFacts from '@/components/studio/ChartFacts';
import StudioFrame from '@/components/studio/StudioFrame';
import { downloadTextFile } from '@/lib/ziwei/export-client';
import { buildNatalExport } from '@/lib/ziwei/chart-export';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 排盘页。命盘由本仓库的 generateChart() 在浏览器里算出。
 * 导出盘面文件不需要密钥。右侧阅读是可选的；没配密钥时接口会说明，不会假装已经解读。
 */
export default function ChartPage() {
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{
    starName: string;
    siHua: string;
    view: 'mingpan' | 'daxian' | 'liunian';
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function exportChartFile() {
    if (!chart || exporting) return;
    setExportError(null);
    setExporting(true);
    try {
      const file = buildNatalExport(chart);
      downloadTextFile(file.filename, file.markdown);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }

  if (!chart) {
    return (
      <StudioFrame>
        <main className="xy-narrow">
          <p className="xy-kicker">排盘</p>
          <h1 className="xy-title">先把盘立起来</h1>
          <p className="xy-lead">
            出生时间在浏览器里换算成真太阳时和时辰，再交给开源引擎起盘。
            起盘之后可以导出完整文件，不需要 API 密钥。模型解读是可选的。
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => { setChart(null); setSelectedPalace(null); setSelectedSiHua(null); setExportError(null); }}
            className="xy-textbtn"
            style={{ paddingBottom: 0 }}
          >
            ← 重新起盘
          </button>
          <button
            type="button"
            className="xy-secondary"
            onClick={exportChartFile}
            disabled={exporting}
          >
            {exporting ? '正在导出…' : '导出盘面文件'}
          </button>
        </div>
        {exportError && (
          <p style={{ margin: '0 0 8px', color: '#9d3b2f', fontSize: 13 }}>{exportError}</p>
        )}
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
