/**
 * 把 OpenAI 兼容的 chat.completion chunk 转成前端已经在用的事件：
 *   data: {"delta":{"text":"..."}}
 *   data: [DONE]
 */

const encoder = new TextEncoder();

export function encodeDelta(text: string): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ delta: { text } })}\n\n`);
}

export function encodeDone(): Uint8Array {
  return encoder.encode('data: [DONE]\n\n');
}

export function singleShotSse(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (text) controller.enqueue(encodeDelta(text));
      controller.enqueue(encodeDone());
      controller.close();
    },
  });
}

function deltaText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return '';
  const delta = (choices[0] as { delta?: unknown; message?: unknown }).delta;
  const message = (choices[0] as { message?: unknown }).message;
  const bag = (delta && typeof delta === 'object' ? delta : message) as { content?: unknown; text?: unknown } | undefined;
  if (!bag) return '';
  if (typeof bag.content === 'string') return bag.content;
  if (typeof bag.text === 'string') return bag.text;
  return '';
}

export function transformOpenAiSse(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let pending = '';

  const consumeLine = (raw: string, controller: ReadableStreamDefaultController<Uint8Array>): 'done' | 'continue' => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line.startsWith('data:')) return 'continue';
    const data = line.slice(5).trim();
    if (!data) return 'continue';
    if (data === '[DONE]') return 'done';
    try {
      const text = deltaText(JSON.parse(data));
      if (text) controller.enqueue(encodeDelta(text));
    } catch {
      /* 半行或供应商心跳，跳过 */
    }
    return 'continue';
  };

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop() ?? '';
          for (const line of lines) {
            if (consumeLine(line, controller) === 'done') {
              controller.enqueue(encodeDone());
              controller.close();
              return;
            }
          }
        }
        pending += decoder.decode();
        if (pending && consumeLine(pending, controller) !== 'done') {
          /* 最后一行已按增量发出 */
        }
        controller.enqueue(encodeDone());
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
