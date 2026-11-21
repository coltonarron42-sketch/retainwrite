// SOP: coaching only, never generate submission text

export type OutlineExportSection = {
  title: string;
  concept: string | null;
  teachAspect: string | null;
  ideaNotes: string[];
  leader: string | null;
  style: string | null;
  excerpts: { quote: string; location: string }[];
  memory: { moment: string; details: string[]; why: string } | null;
  teachCardDefinition?: string;
  highlightMoves?: string[];
  wildcardWhy?: string;
  lessonLink?: string;
  whyFits?: string;
};

export type OutlineExportInput = {
  title: string;
  course: string | null;
  storyAngle: string;
  thesis: string;
  sections: OutlineExportSection[];
};

/** Allow-list renderer. AI teach cards, highlight reels, wildcard whys, and lesson links stay out. */
export function renderOutlineExport(input: OutlineExportInput): string {
  const lines: string[] = [
    input.title,
    input.course ? `Course: ${input.course}` : "Course: Not specified",
    `Story angle: ${input.storyAngle}`,
    `Thesis: ${input.thesis}`,
  ];
  for (const section of input.sections) {
    lines.push(`# ${section.title}`);
    if (section.concept) lines.push(`Concept: ${section.concept}`);
    if (section.teachAspect) lines.push(`Aspect you chose: ${section.teachAspect}`);
    for (const note of section.ideaNotes) lines.push(`Idea: ${note}`);
    if (section.leader) lines.push(`Leader: ${section.leader}`);
    if (section.style) lines.push(`Style: ${section.style}`);
    if (section.memory) {
      lines.push(`Moment: ${section.memory.moment}`);
      for (const detail of section.memory.details) lines.push(`Detail: ${detail}`);
      if (section.memory.why) lines.push(`Why: ${section.memory.why}`);
    }
    for (const excerpt of section.excerpts) {
      lines.push(`Excerpt: ${excerpt.quote} (${excerpt.location})`);
    }
  }
  lines.push("Built from your own notes in RetainWrite. Contains no AI-written paper text.");
  return lines.join("\n");
}
