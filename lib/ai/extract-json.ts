/**
 * Pull a JSON object/array out of a model's text response. Claude usually
 * returns bare JSON when asked, but can wrap it in ```json fences or add a
 * sentence around it — this tolerates both. Returns null when no JSON is found.
 * Pure + unit-tested.
 */
export function extractJson(text: string | null | undefined): string | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Fenced block: ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const body = fenced ? fenced[1].trim() : trimmed;

  // Fast path: already a clean JSON document.
  if (
    (body.startsWith("{") && body.endsWith("}")) ||
    (body.startsWith("[") && body.endsWith("]"))
  ) {
    return body;
  }

  // Otherwise, slice from the first opening brace/bracket to its matching last.
  const firstObj = body.indexOf("{");
  const firstArr = body.indexOf("[");
  const start =
    firstObj === -1
      ? firstArr
      : firstArr === -1
        ? firstObj
        : Math.min(firstObj, firstArr);
  if (start === -1) return null;

  const open = body[start];
  const close = open === "{" ? "}" : "]";
  const end = body.lastIndexOf(close);
  if (end <= start) return null;

  return body.slice(start, end + 1);
}
