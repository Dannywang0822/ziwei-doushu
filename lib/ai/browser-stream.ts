/** 浏览器里读取本仓库 API 的 SSE。不要在这里放密钥或服务端模块。 */

export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json() as { message?: unknown };
    if (typeof body?.message === 'string' && body.message.trim()) return body.message.trim();
  } catch {
    /* 错误体不是 JSON */
  }
  return '';
}

export async function readDeltaStream(
  body: ReadableStream<Uint8Array>,
  onText: (full: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let text = '';

  const take = (raw: string) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line.startsWith('data: ')) return;
    const data = line.slice(6);
    if (data === '[DONE]') return;
    try {
      const delta = JSON.parse(data).delta?.text ?? '';
      if (!delta) return;
      text += delta;
      onText(text);
    } catch {
      /* 跳过半行 */
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) take(line);
  }
  if (pending) take(pending);
  return text;
}
