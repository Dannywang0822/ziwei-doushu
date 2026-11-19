'use client';
import { useState, useCallback, useRef } from 'react';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import StudioFrame from '@/components/studio/StudioFrame';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { generateChart as buildChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { BRANCHES } from '@/lib/ziwei/constants';

function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : '14px', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ac)', letterSpacing: '0.04em' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: '13px', lineHeight: 1.75, color: 'var(--tx-2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span style={{
          display: 'inline-block', width: '7px', height: '13px',
          background: 'var(--ac)', opacity: 0.5, borderRadius: '2px',
          animation: 'pulse 1s ease-in-out infinite',
          verticalAlign: 'middle', marginLeft: '2px',
        }} />
      )}
    </div>
  );
}

function PersonStrip({ title, chart }: { title: string; chart: ZiweiChart }) {
  const ming = chart.palaces.find(p => p.isMingGong);
  const majors = ming?.stars.filter(s => s.type === 'major').map(s => s.name).join('、') || '空宫';
  return (
    <div className="xy-person">
      <span className="xy-kicker">{title}</span>
      <strong>{chart.birthInfo.name?.trim() || '未署名'}</strong>
      <span>{chart.yinYangGender} · {chart.wuxingJuName}</span>
      <span>命宫 {BRANCHES[chart.mingGongBranch]} · {majors}</span>
    </div>
  );
}

export default function HemingPage() {
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);

  const [analysis, setAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState('');
  const [analysisError, setAnalysisError] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const generateChart = useCallback(async (info: BirthInfo): Promise<ZiweiChart | null> => {
    try {
      return buildChart(info);
    } catch {
      return null;
    }
  }, []);

  // 表单是否填齐
  const isFormReady = (f: BirthFormState | null): boolean =>
    !!(f && f.year && f.month && f.day && f.gender && (f.unknownTime || (f.clockHour !== '' && f.clockMinute !== '')));

  // ─── 统一入口：起盘 + 合盘分析 ─────────────────────────────
  const runAnalysis = useCallback(async (q?: string) => {
    setFormError(null);
    if (!isFormReady(formA) || !isFormReady(formB)) {
      setFormError('请先填写双方完整出生信息');
      return;
    }
    setAnalyzing(true);
    setAnalysis('');
    setAnalysisError(false);
    setApiMissing(false);

    try {
      // 每次按当前表单起盘，避免编辑出生信息后复用旧盘。
      const [cA, cB] = await Promise.all([
        generateChart(formToBirthInfo(formA!)),
        generateChart(formToBirthInfo(formB!)),
      ]);
      if (!cA || !cB) {
        setAnalysisError(true);
        setAnalyzing(false);
        return;
      }
      setChartA(cA);
      setChartB(cB);

      const res = await fetch('/api/heming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartA: cA, chartB: cB, question: q ?? undefined }),
      });
      if (res.status === 404) { setApiMissing(true); throw new Error('api-missing'); }
      if (!res.ok || !res.body) {
        let detail = '';
        try {
          const payload = await res.json();
          detail = typeof payload?.message === 'string' ? payload.message : '';
        } catch { /* 非 JSON 错误体 */ }
        if (detail) setAnalysis(detail);
        throw new Error(detail || 'request-failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let pendingLine = '';

      const takeLine = (rawLine: string) => {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        if (!line.startsWith('data: ')) return;
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const delta = JSON.parse(data).delta?.text ?? '';
          text += delta;
          setAnalysis(text);
        } catch { /* skip */ }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pendingLine += decoder.decode(value, { stream: true });
        const lines = pendingLine.split('\n');
        pendingLine = lines.pop() ?? '';
        for (const rawLine of lines) takeLine(rawLine);
      }
      if (pendingLine) takeLine(pendingLine);
      if (!text.trim()) {
        setAnalysis('模型没有返回文字。请检查模型配置后再试。');
        setAnalysisError(true);
      }
      // scroll to analysis
      setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalyzing(false);
    }
  }, [formA, formB, generateChart]);

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--bdr)',
    borderRadius: '16px',
    padding: '24px',
  };

  const labelStyle = {
    fontSize: '10px', letterSpacing: '0.28em', color: 'var(--ac)',
    marginBottom: '16px', display: 'block',
  };

  return (
    <StudioFrame>
      <div className="xy-wide" style={{ paddingBottom: 48 }}>
        <div style={{ marginBottom: 28 }}>
          <p className="xy-kicker">合盘</p>
          <h1 className="xy-title">两张盘放在一起看</h1>
          <p className="xy-lead">
            先在浏览器里分别起盘，再把结构对照交给你配置的模型。
            感情、合伙、亲子和朋友都可以追问。没有密钥时，这里会写明接口未配置。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
          className="heming-grid">
          <div style={cardStyle}>
            <span style={labelStyle}>甲方</span>
            <BirthForm hideSubmit onSubmit={() => {}} onFormSave={setFormA} />
          </div>
          <div style={cardStyle}>
            <span style={labelStyle}>乙方</span>
            <BirthForm hideSubmit onSubmit={() => {}} onFormSave={setFormB} />
          </div>
        </div>

        {(chartA || chartB) && (
          <div className="xy-pair">
            {chartA && <PersonStrip title="甲方" chart={chartA} />}
            {chartB && <PersonStrip title="乙方" chart={chartB} />}
          </div>
        )}

        <div ref={analysisRef} style={{
          ...cardStyle,
          minHeight: '280px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span className="xy-seal" style={{ width: 28, height: 28, fontSize: 13 }}>合</span>
            <span style={{ fontSize: '12px', letterSpacing: '0.18em', color: 'var(--tx-3)' }}>合盘阅读</span>
          </div>

          {!analysis && !analyzing && (
            <div style={{ textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--tx-3)', marginBottom: '20px', lineHeight: 1.7 }}>
                填好双方出生信息后开始。模型会同时看命宫、夫妻宫和福德宫。
              </div>
              <button type="button" onClick={() => runAnalysis()} className="xy-primary">
                开始合盘
              </button>
              {formError && (
                <div style={{ marginTop: '16px', fontSize: '13px', color: '#9d3b2f' }}>{formError}</div>
              )}
            </div>
          )}

          {analyzing && !analysis && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '36px 0', color: 'var(--tx-3)', fontSize: '13px' }}>
              <div style={{
                width: '14px', height: '14px',
                border: '2px solid var(--bdr-med)', borderTopColor: 'var(--ac)',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              正在对照两张盘…
            </div>
          )}

          {analysis && !analysisError && <AiContent text={analysis} streaming={analyzing} />}

          {analysisError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-1)', fontSize: '13px', color: 'var(--tx-2)', marginTop: '12px', lineHeight: 1.7 }}>
              {analysis
                ? analysis
                : apiMissing
                  ? '没有找到合盘接口 /api/heming。两人的命盘可以分别到排盘页查看。'
                  : '分析暂时不可用，请重试。'}
            </div>
          )}
        </div>

        {analysis && !analysisError && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.16em', color: 'var(--tx-3)' }}>
              换一个问题再看一次
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                '感情相处最需要磨合的地方？',
                '适合一起做事吗？',
                '哪几年两个人的大限差别比较大？',
                '财帛宫是互补还是各忙各的？',
              ].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setQuestion(q); runAnalysis(q); }}
                  disabled={analyzing}
                  className="xy-mini"
                >
                  {q}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !analyzing) runAnalysis(question || undefined); }}
                placeholder="例如：搬家会不会让两个人都轻松一点？"
                disabled={analyzing}
                className="input-base"
                style={{ fontSize: '13px', flex: 1 }}
              />
              <button
                type="button"
                onClick={() => runAnalysis(question || undefined)}
                disabled={analyzing}
                className="xy-secondary"
              >
                {analyzing ? '分析中…' : '继续追问'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .heming-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </StudioFrame>
  );
}
