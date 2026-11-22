/**
 * The citation comfort question names the actual style. An "other" style the
 * student named (ASA) is said by name, never "other citations" (QA 2:08 #6).
 */
export function citationStyleName(req: { citationStyle: { value: string | null }; citationStyleOther?: string | null }): string | null {
  const v = req.citationStyle.value?.trim() || null;
  if (!v) return null;
  if (v.toLowerCase() === "other") return req.citationStyleOther?.trim() || null;
  return v;
}

export function citationComfortQuestion(req: Parameters<typeof citationStyleName>[0]): string {
  return `How comfortable are you with ${citationStyleName(req) ?? "the required"} citations so far?`;
}
