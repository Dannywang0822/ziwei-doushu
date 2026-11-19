'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import type { TimeView } from './TimeNav';
import { readDeltaStream, readErrorMessage } from '@/lib/ai/browser-stream';
import { STATIC_DEMO, STATIC_DEMO_NOTE } from '@/lib/site';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
}

const TOPICS: { key: TopicKey; label: string }[] = [
  { key: 'overview', label: '总览' },
  { key: 'personality', label: '性格' },
  { key: 'love', label: '感情' },
  { key: 'career', label: '事业' },
  { key: 'wealth', label: '财运' },
  { key: 'health', label: '健康' },
  { key: 'family', label: '兄弟' },
  { key: 'children', label: '子女' },
  { key: 'move', label: '迁移' },
  { key: 'friends', label: '人际' },
  { key: 'home', label: '田宅' },
  { key: 'spirit', label: '福德' },
  { key: 'parents', label: '父母' },
];

/** Render AI markdown: **【Title】** → section header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--ac)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--ac)', opacity: 0.7 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({ chart, selectedPalace, selectedSiHua }: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('overview');
  const [aiHint, setAiHint] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (STATIC_DEMO) {
      setAiHint(STATIC_DEMO_NOTE);
      return;
    }
    let cancelled = false;
    fetch('/api/ai-status')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data?.configured) {
          const host = data.host ? ` · ${data.host}` : '';
          setAiHint(`模型已配置：${data.model ?? '未命名'}${host}`);
        } else {
          setAiHint(typeof data?.message === 'string' ? data.message : 'AI 接口还没有配置。');
        }
      })
      .catch(() => {
        if (!cancelled) setAiHint('读不到 AI 配置状态。排盘仍然可用。');
      });
    return () => { cancelled = true; };
  }, []);

  const streamResponse = async (
    apiMessages: { role: 'user' | 'assistant'; content: string }[],
    extra?: { topic?: string; focus?: Record<string, string> },
  ) => {
    if (STATIC_DEMO) {
      setMessages(prev => [...prev, { role: 'assistant', content: STATIC_DEMO_NOTE }]);
      setLoading(false);
      loadingRef.current = false;
      return;
    }
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, messages: apiMessages, ...extra }),
      });
      if (res.status === 404) throw new Error('api-missing');
      if (!res.ok) {
        const message = await readErrorMessage(res);
        throw new Error(message || '解读失败，请稍后重试。');
      }
      if (!res.body) throw new Error('模型没有返回内容。');

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const assistantText = await readDeltaStream(res.body, (full) => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: full };
          return updated;
        });
      });
      if (!assistantText.trim()) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '模型没有返回文字。请检查模型名是否支持对话，或稍后再试。',
          };
          return updated;
        });
      }
    } catch (e) {
      const missing = e instanceof Error && e.message === 'api-missing';
      const content = missing
        ? '没有找到解读接口 /api/interpret。请确认本机服务已经启动。排盘本身不需要密钥。'
        : (e instanceof Error && e.message ? e.message : '解读失败，请稍后重试。');
      setMessages(prev => [...prev, { role: 'assistant', content }]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const sendMessage = (
    text: string,
    hidden = false,
    extra?: { topic?: string; focus?: Record<string, string> },
  ) => {
    if (!text.trim() || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text, hidden };
    const apiMessages = [...messagesRef.current, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    streamResponse(apiMessages, extra);
  };

  const handleTopicClick = (topicKey: TopicKey) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    const label = TOPICS.find(t => t.key === topicKey)?.label ?? '总览';
    sendMessage(`解读${label}`, true, { topic: topicKey });
  };

  const readPalace = () => {
    if (!selectedPalace || loadingRef.current) return;
    sendMessage(`解读${selectedPalace.name}`, true, {
      focus: { kind: 'palace', name: selectedPalace.name },
    });
  };

  const readSihua = () => {
    if (!selectedSiHua || loadingRef.current) return;
    const view = selectedSiHua.view === 'daxian' ? '大限' : selectedSiHua.view === 'liunian' ? '流年' : '本命';
    sendMessage(`解读${view}${selectedSiHua.starName}化${selectedSiHua.siHua}`, true, {
      focus: {
        kind: 'sihua',
        starName: selectedSiHua.starName,
        siHua: selectedSiHua.siHua,
        view: selectedSiHua.view,
      },
    });
  };

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[min(44rem,80dvh)] min-h-0 min-w-0 rounded-xl overflow-hidden card-glass">

      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="flex flex-wrap gap-1">
          {TOPICS.map(t => {
            const isActive = activeTopic === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTopicClick(t.key)}
                disabled={loading}
                className="px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{
                  background: isActive ? 'var(--ac-bg)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--ac-bdr)' : 'var(--t-border)'}`,
                  color: isActive ? 'var(--ac)' : 'var(--t-faint)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {(selectedPalace || selectedSiHua) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {selectedPalace && (
              <button type="button" onClick={readPalace} disabled={loading} className="xy-mini">
                解读{selectedPalace.name}
              </button>
            )}
            {selectedSiHua && (
              <button type="button" onClick={readSihua} disabled={loading} className="xy-mini">
                解读{selectedSiHua.starName}化{selectedSiHua.siHua}
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0">
        {aiHint && messages.length === 0 && (
          <p className="text-[10px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>{aiHint}</p>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="xy-seal" aria-hidden>垣</div>
            <p className="text-[12px] mt-3" style={{ color: 'var(--t-text)' }}>命盘已经在左边。</p>
            <p className="text-[10px] mt-1 leading-relaxed" style={{ color: 'var(--t-faint)' }}>
              选一个题目，或直接追问。没有密钥时这里会说明接口未配置，盘仍然在。
            </p>
            <button
              type="button"
              onClick={() => handleTopicClick('overview')}
              disabled={loading}
              className="xy-mini mt-3"
            >
              生成总览
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            if (msg.role === 'user' && msg.hidden) return null;

            if (msg.role === 'user') {
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                    style={{
                      background: 'var(--ac-bg)',
                      border: '1px solid var(--ac-bdr)',
                      color: 'var(--ac)',
                    }}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              );
            }

            const isLastMsg = i === messages.length - 1;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--ac)', opacity: 0.7 }}>垣</span>
                  阅读
                </div>
                <AiContent text={msg.content} streaming={loading && isLastMsg} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="继续追问，例如：这段大限适合换城市吗？"
            disabled={loading}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'var(--ac-bg)',
              border: '1px solid var(--ac-bdr)',
              color: 'var(--ac)',
            }}
          >
            {loading ? '…' : '追问'}
          </button>
        </div>
      </div>

    </div>
  );
}
