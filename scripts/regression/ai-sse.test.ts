import assert from 'node:assert/strict';
import { transformOpenAiSse } from '../../lib/ai/sse';

function streamFrom(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  let text = '';
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);
    if (data === '[DONE]') continue;
    text += JSON.parse(data).delta.text as string;
  }
  return text;
}

async function main() {
  const payload =
    'data: {"choices":[{"delta":{"reasoning_content":"先想"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n' +
    'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n' +
    'data: [DONE]\n\n';
  const encoder = new TextEncoder();
  const whole = await readAll(transformOpenAiSse(streamFrom([encoder.encode(payload)])));
  assert.equal(whole, '你好世界');

  const bytes = encoder.encode(payload);
  for (let cut = 1; cut < bytes.length; cut += 7) {
    const text = await readAll(transformOpenAiSse(streamFrom([
      bytes.slice(0, cut),
      bytes.slice(cut),
    ])));
    assert.equal(text, '你好世界', `split at ${cut}`);
  }
  console.log('OpenAI SSE transform checks passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
