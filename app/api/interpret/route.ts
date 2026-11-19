import { jsonError, respondWithChat, respondWithError } from '@/lib/ai/http';
import { buildInterpretMessages } from '@/lib/ai/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    return await respondWithChat(buildInterpretMessages(body));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError(400, 'invalid_json', '请求体不是合法的 JSON。');
    }
    return respondWithError(error);
  }
}
