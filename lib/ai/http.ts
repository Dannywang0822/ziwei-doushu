import { resolveAiConfig } from './config';
import { streamChat, type ChatMessage } from './client';
import { AiRequestError, AiUpstreamError } from './errors';

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
};

export function jsonError(status: number, code: string, message: string): Response {
  return Response.json({ error: code, message }, { status });
}

export async function respondWithChat(messages: ChatMessage[]): Promise<Response> {
  const config = resolveAiConfig();
  if (!config.ok) return jsonError(503, 'not_configured', config.message);
  try {
    const stream = await streamChat(messages, config);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    if (error instanceof AiUpstreamError) return jsonError(502, 'upstream', error.message);
    throw error;
  }
}

export function respondWithError(error: unknown): Response {
  if (error instanceof AiRequestError) return jsonError(error.status, error.code, error.message);
  if (error instanceof AiUpstreamError) return jsonError(502, 'upstream', error.message);
  console.error('AI route failed');
  return jsonError(500, 'internal', '解读服务暂时不可用。排盘本身没有受影响。');
}
