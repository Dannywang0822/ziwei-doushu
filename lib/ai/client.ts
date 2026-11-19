import { resolveAiConfig, type AiConfig } from './config';
import { AiUpstreamError } from './errors';
import { singleShotSse, transformOpenAiSse } from './sse';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function upstreamMessage(status: number): string {
  if (status === 401 || status === 403) {
    return `模型接口拒绝了密钥（HTTP ${status}）。请检查 API Key 是否有效，以及这个模型是否对你的账号开放。`;
  }
  if (status === 404) {
    return '模型接口地址不存在（HTTP 404）。Base URL 应停在 /v1，例如 https://api.x.ai/v1，不要自己拼上 /chat/completions。';
  }
  if (status === 429) {
    return '模型接口限流了（HTTP 429）。请稍后再试，或换一个配额更宽的模型。';
  }
  return `模型接口暂时不可用（HTTP ${status}）。排盘本身没有受影响。`;
}

export async function streamChat(messages: ChatMessage[], config?: AiConfig): Promise<ReadableStream<Uint8Array>> {
  const resolved = config ?? (() => {
    const result = resolveAiConfig();
    if (!result.ok) throw new Error(result.message);
    return result;
  })();

  let response: Response;
  try {
    response = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: resolved.model,
        messages,
        stream: true,
        temperature: 0.7,
        // grok-4.7 会先输出推理 token。留出余量，避免正文被截断。
        max_tokens: 4096,
      }),
    });
  } catch {
    throw new AiUpstreamError('连不上模型接口。请确认 Base URL 从运行 Next.js 的这台机器可以访问。');
  }

  if (!response.ok) {
    await response.text().catch(() => '');
    throw new AiUpstreamError(upstreamMessage(response.status));
  }
  if (!response.body) {
    throw new AiUpstreamError('模型接口没有返回内容。');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    let text = '';
    try {
      const json = await response.json() as { choices?: { message?: { content?: string } }[] };
      text = json.choices?.[0]?.message?.content ?? '';
    } catch {
      text = '';
    }
    if (!text.trim()) throw new AiUpstreamError('模型没有返回文字。可以换一个支持流式输出的模型再试。');
    return singleShotSse(text);
  }

  return transformOpenAiSse(response.body);
}
