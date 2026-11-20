import {
  applyPageWordEstimates,
} from "@/lib/assignment/pages-to-words";
import {
  extractUrlsFromText,
  mergeProvidedSources,
} from "@/lib/assignment/provided-sources";
import {
  emptyRequirements,
  extractedField,
  type AssignmentRequirements,
  type CitationStyle,
  type LengthValue,
} from "@/lib/assignment/schema";
import { dropInvalidEvidence } from "@/lib/assignment/evidence";

/**
 * Rule-based assignment parse used when Grok is unavailable.
 * // SOP: coaching only, never generate submission text
 */
export function parseAssignmentFallback(rawText: string): AssignmentRequirements {
  const text = rawText.trim();
  const req = emptyRequirements();
  if (!text) return req;

  const lower = text.toLowerCase();

  // Length: pages or words
  const pageRange = text.match(
    /(\d+)\s*[–-]\s*(\d+)\s*pages?\b/i,
  );
  const pageSingle = text.match(/\b(\d+)\s*pages?\b/i);
  const wordRange = text.match(
    /(\d{3,5})\s*[–-]\s*(\d{3,5})\s*words?\b/i,
  );
  const wordSingle = text.match(/\b(\d{3,5})\s*words?\b/i);

  let length: LengthValue = { raw: undefined };
  if (wordRange) {
    length = {
      wordsMin: Number(wordRange[1]),
      wordsMax: Number(wordRange[2]),
      raw: wordRange[0],
    };
  } else if (wordSingle) {
    const n = Number(wordSingle[1]);
    length = { wordsMin: n, wordsMax: n, raw: wordSingle[0] };
  } else if (pageRange) {
    length = {
      pagesMin: Number(pageRange[1]),
      pagesMax: Number(pageRange[2]),
      raw: pageRange[0],
    };
  } else if (pageSingle) {
    const n = Number(pageSingle[1]);
    length = { pagesMin: n, pagesMax: n, raw: pageSingle[0] };
  }
  length = applyPageWordEstimates(length);
  if (length.raw || length.pagesMin || length.wordsMin) {
    req.length = extractedField(length, 0.85, length.raw);
  }

  // Citation style
  const citationMap: { re: RegExp; style: CitationStyle; evidence: string }[] = [
    { re: /\bAPA\s*7\b/i, style: "APA 7", evidence: "APA 7" },
    { re: /\bAPA\b/i, style: "APA 7", evidence: "APA" },
    { re: /\bMLA\s*9\b/i, style: "MLA 9", evidence: "MLA 9" },
    { re: /\bMLA\b/i, style: "MLA 9", evidence: "MLA" },
    { re: /\bChicago\b/i, style: "Chicago 17 Author-Date", evidence: "Chicago" },
    { re: /\bHarvard\b/i, style: "Harvard", evidence: "Harvard" },
    { re: /\bIEEE\b/i, style: "IEEE", evidence: "IEEE" },
    { re: /\bAMA\b/i, style: "AMA", evidence: "AMA" },
  ];
  for (const row of citationMap) {
    const m = text.match(row.re);
    if (m) {
      req.citationStyle = extractedField(row.style, 0.85, m[0]);
      break;
    }
  }

  // Due date
  const due = text.match(
    /\b(?:due|deadline)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
  );
  if (due) {
    req.dueDate = extractedField(due[1], 0.7, due[0]);
  }

  // Course-ish line
  const course = text.match(
    /\b((?:ENGL|ENG|HIST|BIO|CHEM|PSY|SOC|MATH|CS|ECON)\s*\d{2,4}[A-Z]?)\b/i,
  );
  if (course) {
    req.course = extractedField(course[1], 0.8, course[1]);
  }

  // Paper type
  if (/\bresearch paper\b/i.test(text)) {
    req.paperType = extractedField("research paper", 0.8, "research paper");
  } else if (/\bliterature review\b/i.test(text)) {
    req.paperType = extractedField("literature review", 0.8, "literature review");
  } else if (/\bessay\b/i.test(text)) {
    req.paperType = extractedField("essay", 0.7, "essay");
  }

  // Topic: first substantial sentence or "Write about X"
  const writeAbout = text.match(
    /\b(?:write(?:\s+a(?:n)?)?\s+(?:paper|essay)?\s+)?(?:about|on|analyz(?:e|ing)|discuss|argue)\s+(.{20,140}?)(?:[.!?\n]|$)/i,
  );
  if (writeAbout) {
    req.topic = extractedField(writeAbout[1].trim(), 0.65, writeAbout[0].slice(0, 80));
  } else {
    const firstLine = text.split(/\n/).map((l) => l.trim()).find((l) => l.length > 20);
    if (firstLine) {
      req.topic = extractedField(firstLine.slice(0, 160), 0.4, firstLine.slice(0, 80));
    }
  }

  // Required sources
  const sources = text.match(
    /\b(\d+)\s+(?:scholarly\s+)?(?:sources|references|citations|leaders)\b/i,
  );
  if (sources) {
    req.requiredSources = extractedField(
      {
        countMin: Number(sources[1]),
        scholarlyRequired: /scholarly/i.test(sources[0]),
        types: sources[0],
      },
      0.75,
      sources[0],
    );
  } else if (/scholarly/i.test(lower)) {
    req.requiredSources = extractedField(
      { scholarlyRequired: true, notes: "Scholarly sources mentioned" },
      0.5,
      "scholarly",
    );
  }

  // AI policy
  if (/\b(?:do not|don't|must not|may not)\s+use\s+AI\b/i.test(text) || /\bno AI\b/i.test(text)) {
    req.aiPolicy = extractedField("forbidden", 0.9, "no AI");
  } else if (/\bAI (?:is )?(?:allowed|permitted)\b/i.test(text)) {
    req.aiPolicy = extractedField("allowed", 0.85, "AI allowed");
  }

  // Provided readings / links from corpus URLs
  const urls = extractUrlsFromText(text);
  const linkMarkers = [
    ...text.matchAll(/\[Link provided[^\]]*\]:\s*(\S+)/gi),
  ].map((m) => m[1]);
  const provided = mergeProvidedSources([
    ...urls.map((url) => ({ url, origin: "document_text" as const })),
    ...linkMarkers.map((url) => ({ url, origin: "manual" as const })),
  ]);
  if (provided.length) {
    const field = extractedField(provided, 0.7, provided[0].url);
    req.providedReadings = field;
    req.providedSources = field;
  }

  // Strip invalid evidence
  for (const key of Object.keys(req) as (keyof AssignmentRequirements)[]) {
    const field = req[key];
    if (field && typeof field === "object" && "rawEvidence" in field) {
      // @ts-expect-error indexed assign
      req[key] = dropInvalidEvidence(field, text);
    }
  }

  return req;
}
