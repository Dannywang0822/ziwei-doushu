import { generateChart } from '@/lib/ziwei/algorithm';
import type { TopicKey } from '@/lib/ziwei/db-analysis';
import { TOPIC_LABEL } from '@/lib/ziwei/db-analysis';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { describeChart, describeHeming } from './chart-context';
import type { ChatMessage } from './client';
import { AiRequestError } from './errors';
import { HEMING_SYSTEM, NATAL_SYSTEM, palaceTask, sihuaTask, topicTask } from './prompts';

const TOPIC_KEYS = new Set<string>(Object.keys(TOPIC_LABEL));

interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

export function chartFromPayload(payload: unknown): ZiweiChart {
  if (!isRecord(payload) || !isRecord(payload.birthInfo)) {
    throw new AiRequestError(400, 'missing_chart', '请求里没有命盘。请先排盘，再让模型阅读。');
  }
  const birth = payload.birthInfo;
  const year = Number(birth.year);
  const month = Number(birth.month);
  const day = Number(birth.day);
  const hour = Number(birth.hour);
  const gender = birth.gender === 'male' || birth.gender === 'female' ? birth.gender : null;
  if (!gender) {
    throw new AiRequestError(400, 'bad_birth', '性别无法识别，请重新选择男或女。');
  }
  const info: BirthInfo = {
    year,
    month,
    day,
    hour,
    gender,
    name: typeof birth.name === 'string' ? birth.name.slice(0, 40) : undefined,
    province: typeof birth.province === 'string' ? birth.province.slice(0, 20) : undefined,
    city: typeof birth.city === 'string' ? birth.city.slice(0, 20) : undefined,
  };
  try {
    return generateChart(info);
  } catch (error) {
    const raw = error instanceof Error ? error.message : '';
    if (raw.includes('hour')) {
      throw new AiRequestError(400, 'bad_birth', '时辰序号需要在 0 到 11 之间。请回到表单重新选择时间。');
    }
    if (raw.includes('gender')) {
      throw new AiRequestError(400, 'bad_birth', '性别需要是男或女。');
    }
    if (raw.includes('solar date')) {
      throw new AiRequestError(400, 'bad_birth', '这个公历日期不存在，请检查年、月、日。');
    }
    throw new AiRequestError(400, 'bad_birth', '这份出生信息排不出盘，请检查年月日和时辰。');
  }
}

function sanitizeMessages(input: unknown): ClientMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ClientMessage[] = [];
  for (const item of input.slice(-12)) {
    if (!isRecord(item)) continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    if (typeof item.content !== 'string') continue;
    const content = item.content.trim().slice(0, 2000);
    if (!content) continue;
    out.push({ role: item.role, content });
  }
  return out;
}

function viewLabel(view: unknown): string {
  if (view === 'daxian') return '大限';
  if (view === 'liunian') return '流年';
  return '本命';
}

export function buildInterpretMessages(body: unknown): ChatMessage[] {
  if (!isRecord(body)) {
    throw new AiRequestError(400, 'invalid_json', '请求体格式不对。');
  }
  const chart = chartFromPayload(body.chart);
  const topic = typeof body.topic === 'string' && TOPIC_KEYS.has(body.topic)
    ? body.topic as TopicKey
    : undefined;
  const history = sanitizeMessages(body.messages);
  const focus = isRecord(body.focus) ? body.focus : null;

  let task = topicTask(topic) ?? '';
  if (focus?.kind === 'palace' && typeof focus.name === 'string') {
    task = palaceTask(focus.name.slice(0, 12));
  } else if (
    focus?.kind === 'sihua'
    && typeof focus.starName === 'string'
    && typeof focus.siHua === 'string'
  ) {
    task = sihuaTask(focus.starName.slice(0, 8), focus.siHua.slice(0, 2), viewLabel(focus.view));
  }

  const prior = task ? history.slice(0, -1) : history;
  const messages: ChatMessage[] = [
    { role: 'system', content: `${NATAL_SYSTEM}\n\n以下是排盘引擎给出的事实，优先级高于后面的提问：\n${describeChart(chart)}` },
    ...prior,
  ];
  if (task) messages.push({ role: 'user', content: task });
  else if (!prior.some(m => m.role === 'user')) {
    messages.push({ role: 'user', content: topicTask('overview')! });
  }
  return messages;
}

export function buildHemingMessages(body: unknown): ChatMessage[] {
  if (!isRecord(body)) {
    throw new AiRequestError(400, 'invalid_json', '请求体格式不对。');
  }
  const chartA = chartFromPayload(body.chartA);
  const chartB = chartFromPayload(body.chartB);
  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  const ask = question
    ? `请按合盘规则回答这个问题，并仍然使用规定的六个标题：${question}`
    : '请按合盘规则写出完整对照。';
  return [
    { role: 'system', content: `${HEMING_SYSTEM}\n\n${describeHeming(chartA, chartB)}` },
    { role: 'user', content: ask },
  ];
}
