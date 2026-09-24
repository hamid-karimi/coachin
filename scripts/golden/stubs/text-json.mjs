// Stand-in for legacy/lib/ai/text-json.ts: records each generation request
// (prompt + schema) and answers with a canned reply, so the golden vectors
// capture the exact prompts without calling any AI provider.
export const calls = [];
let reply = null;

export function setReply(value) {
  reply = value;
}

export async function generateJsonText(req) {
  calls.push(req);
  return reply;
}
