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
function isFormatTopic(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  if (/^\(?\d{3,5}\s*words?\)?/i.test(text)) return true;
  const hits = text.match(/\b(words?|pages?|double|spaced|mla|apa|chicago|format|spacing|font|margin)\b/gi) ?? [];
  return hits.length >= 2 && !/\b(how|why|should|affect|social|health|argue|explain|discuss)\b/i.test(text);
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

function numberWord(value: string): number | undefined {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return NUMBER_WORDS[value.toLowerCase()];
}

/** "this question", "the prompt": a pointer back to the prompt, not a topic. */
export function isPlaceholderTopic(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.,;:!?]+$/, "");
  return /^(?:this|that|the|your|my|a|an)\s+(?:question|topic|prompt|issue|assignment|essay|paper|subject|position)$/.test(text) || /^(?:it|this|that)$/.test(text);
}

/** Split "A (25 pts), B (30 pts)" or "A; B; C" into trimmed items. */
function splitInlineList(value: string): string[] {
  const sep = value.includes(";") ? /;/ : /,(?![^()]*\))/;
  return value
    .split(sep)
    .map((part) => part.trim().replace(/\.$/, "").trim())
    .filter((part) => part.length > 1)
    .slice(0, 20);
}

export function parseAssignmentFallback(
  rawText: string,
  options?: { allowTopicAndDueDateGuess?: boolean },
): AssignmentRequirements {
  const text = rawText.trim();
  const req = emptyRequirements();
  if (!text) return req;

  const lower = text.toLowerCase();

  // Length: pages or words
  const pageRange = text.match(
    /(\d+)\s*[–-]\s*(\d+)\s*[- ]?\s*(?:pages?|pp\.?)\b/i,
  );
  // "3 pages", "3-page", "3 page"
  const pageSingle = text.match(/\b(\d+)\s*[- ]?\s*(?:pages?|pp\.?)\b/i);
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
    req.length = extractedField(length, 0.85, length.raw, {
      method: "paste",
      excerpt: length.raw?.slice(0, 200),
    });
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
      req.citationStyle = extractedField(row.style, 0.85, m[0], {
        method: "paste",
        excerpt: m[0],
      });
      break;
    }
  }

  const allowGuesses = options?.allowTopicAndDueDateGuess !== false;

  // An explicit due line is extracted. A missing date is never invented.
  // The date must be written in the text (with or without a year).
  const due = text.match(
    /\b(?:due(?:\s+date)?|deadline)\s*(?::|on|by)?\s+((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|\d{4}-\d{2}-\d{2})/i,
  );
  if (due) {
    req.dueDate = extractedField(due[1], 0.7, due[0]);
  }

  // Course-ish line
  const course =
    text.match(/^\s*(?:course|class)\s*:\s*(.{2,80}?)\s*$/im) ??
    text.match(
      /\b((?:ENGL|ENG|HIST|BIO|CHEM|PSY|SOC|MATH|CS|ECON)\s*\d{2,4}[A-Z]?)\b/i,
    ) ??
    // A subject name plus a course number, e.g. "English 101 - Argument Essay".
    text.match(/\b((?:[A-Z][a-z]+\s){1,3}\d{2,4}[A-Z]?)\b/);
  if (course) {
    const name = course[1].trim();
    req.course = extractedField(name, 0.8, name);
  }

  // Paper type
  if (/\bresearch paper\b/i.test(text)) {
    req.paperType = extractedField("research paper", 0.8, "research paper");
  } else if (/\bargumentative essay\b/i.test(text)) {
    req.paperType = extractedField("argumentative essay", 0.85, "argumentative essay");
  } else if (/\bliterature review\b/i.test(text)) {
    req.paperType = extractedField("literature review", 0.8, "literature review");
  } else if (/\b(essay|analysis|reflection)\b/i.test(text)) {
    const kind = text.match(/\b(essay|analysis|reflection)\b/i)?.[1] ?? "essay";
    req.paperType = extractedField(kind.toLowerCase(), 0.7, kind);
  }

  const asked = text.match(
    /\b(?:write(?:\s+a(?:n)?)?(?:\s+\d+[–-]?\d*\s*page)?\s+(?:paper|essay|analysis)?\s*)?(?:about|on|analyz(?:e|ing)|discuss|argue(?:\s+that)?)\s+(.{12,160}?)(?:[.!?\n]|$)/i,
  );
  if (asked?.[1] && !isFormatTopic(asked[1]) && !isPlaceholderTopic(asked[1])) {
    req.topic = extractedField(asked[1].trim().slice(0, 180), 0.7, asked[0].slice(0, 120));
  }
  // A question sentence, even when the line keeps going ("Prompt: Should …? Write …").
  const question = text
    .split(/\n/)
    .map((line) => line.trim().replace(/^(?:question|prompt|essay prompt|assignment)\s*:\s*/i, ""))
    .flatMap((line) => line.match(/[^.!?]*\?/g) ?? [])
    .map((sentence) => sentence.trim())
    .find((sentence) => sentence.split(/\s+/).length >= 6 && !isFormatTopic(sentence));
  if (question) {
    req.promptQuestion = extractedField(question.slice(0, 400), 0.7, question.slice(0, 120));
  }

  // First-line topic guesses and due dates are not used in production.
  if (allowGuesses && !req.topic.value) {
    const writeAbout = text.match(
      /\b(?:write(?:\s+a(?:n)?)?\s+(?:paper|essay)?\s+)?(?:about|on|analyz(?:e|ing)|discuss|argue)\s+(.{20,140}?)(?:[.!?\n]|$)/i,
    );
    if (writeAbout && !isPlaceholderTopic(writeAbout[1])) {
      req.topic = extractedField(writeAbout[1].trim(), 0.65, writeAbout[0].slice(0, 80));
    } else {
      const firstLine = text
        .split(/\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 20);
      if (firstLine) {
        req.topic = extractedField(firstLine.slice(0, 160), 0.4, firstLine.slice(0, 80));
      }
    }
  }

  // Required sources
  const sources = text.match(
    /\b(?:at least\s+|a minimum of\s+|minimum of\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:(?:credible|scholarly|academic|peer[- ]reviewed|reliable|outside|primary|secondary)\s+)*(?:sources|references|citations|leaders)\b[^.\n]*/i,
  );
  if (sources) {
    const types = sources[0].trim();
    req.requiredSources = extractedField(
      {
        countMin: numberWord(sources[1]),
        scholarlyRequired: /scholarly|peer[- ]reviewed|academic/i.test(types),
        types,
      },
      0.75,
      types,
    );
  } else if (/scholarly/i.test(lower)) {
    req.requiredSources = extractedField(
      { scholarlyRequired: true, notes: "Scholarly sources mentioned" },
      0.5,
      "scholarly",
    );
  }

  // Rubric line: "Rubric: Thesis (25 pts), Evidence (30 pts)".
  const rubricLine = text.match(/^\s*(?:rubric|grading(?: criteria)?|criteria)\s*:\s*(.+)$/im);
  if (rubricLine) {
    const criteria = splitInlineList(rubricLine[1])
      .map((item) => {
        const weight = item.match(/\(?\s*(\d{1,3})\s*(?:pts?|points?|%)\s*\)?/i);
        const name = item.replace(/\(?\s*\d{1,3}\s*(?:pts?|points?|%)\s*\)?/i, "").replace(/[-–:]\s*$/, "").trim();
        return name ? { name, ...(weight ? { weight: Number(weight[1]) } : {}) } : null;
      })
      .filter((c): c is { name: string; weight?: number } => Boolean(c));
    if (criteria.length) {
      req.rubricCriteria = extractedField(criteria, 0.75, rubricLine[0].trim().slice(0, 200));
    }
  }

  // Sections / structure line: "Sections: Introduction; Body; Conclusion".
  const sectionsLine = text.match(/^\s*(?:sections?|structure|organization|outline)\s*:\s*(.+)$/im);
  if (sectionsLine) {
    const parts = splitInlineList(sectionsLine[1]);
    if (parts.length) {
      req.structuralRequirements = extractedField(parts, 0.75, sectionsLine[0].trim().slice(0, 200));
    }
  }

  // Formatting rules written in the text.
  const formatting = [
    text.match(/\b\d{1,2}\s*-?\s*(?:pt|point)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}/)?.[0],
    text.match(/\b(?:double|single|1\.5)[- ]spaced\b/i)?.[0],
    text.match(/\b1[- ]inch margins?\b/i)?.[0],
  ].filter((rule): rule is string => Boolean(rule));
  if (formatting.length) {
    req.formattingRules = extractedField(formatting, 0.7, formatting[0]);
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
