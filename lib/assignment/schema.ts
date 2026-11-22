import { z } from "zod";

export const fieldSourceSchema = z.enum([
  "extracted",
  "student_edited",
  "student_entered",
  "missing",
]);

export type FieldSource = z.infer<typeof fieldSourceSchema>;

export const provenanceSchema = z.object({
  fileId: z.string().optional(),
  page: z.number().int().positive().optional(),
  method: z
    .enum([
      "pdf_text",
      "docx",
      "txt",
      "ocr_mistral",
      "ocr_grok_vision",
      "paste",
      "fetch",
      "manual",
    ])
    .optional(),
  excerpt: z.string().max(500).optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

export const fieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    source: fieldSourceSchema,
    confirmed: z.boolean(),
    rawEvidence: z.string().optional(),
    provenance: provenanceSchema.optional(),
  });

export type Field<T> = {
  value: T | null;
  confidence: number;
  source: FieldSource;
  confirmed: boolean;
  rawEvidence?: string;
  provenance?: Provenance;
};

export const lengthValueSchema = z.object({
  pagesMin: z.number().optional(),
  pagesMax: z.number().optional(),
  wordsMin: z.number().optional(),
  wordsMax: z.number().optional(),
  wordsEstimateMin: z.number().optional(),
  wordsEstimateMax: z.number().optional(),
  raw: z.string().optional(),
});

export type LengthValue = z.infer<typeof lengthValueSchema>;

export const requiredSourcesValueSchema = z.object({
  countMin: z.number().optional(),
  countMax: z.number().optional(),
  types: z.string().optional(),
  scholarlyRequired: z.boolean().optional(),
  notes: z.string().optional(),
});

export type RequiredSourcesValue = z.infer<typeof requiredSourcesValueSchema>;

export const rubricCriterionSchema = z.object({
  name: z.string(),
  weight: z.number().optional(),
  notes: z.string().optional(),
});

export const providedSourceOriginSchema = z.enum([
  "manual",
  "document_text",
  "pdf_annotation",
  "extracted_title",
]);

export type ProvidedSourceOrigin = z.infer<typeof providedSourceOriginSchema>;

export const providedReadingSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  notes: z.string().optional(),
  origin: providedSourceOriginSchema.optional(),
  provenance: provenanceSchema.optional(),
});

export type ProvidedReading = z.infer<typeof providedReadingSchema>;

export const citationStyleSchema = z.enum([
  "APA 7",
  "MLA 9",
  "Chicago 17 Notes",
  "Chicago 17 Author-Date",
  "Harvard",
  "IEEE",
  "AMA",
  "other",
]);

export type CitationStyle = z.infer<typeof citationStyleSchema>;

export const aiPolicySchema = z.enum([
  "unspecified",
  "allowed",
  "restricted",
  "forbidden",
]);

export const assignmentRequirementsSchema = z.object({
  schemaVersion: z.literal("1.0"),
  course: fieldSchema(z.string()),
  /** Teacher or professor as written. Optional: older saved cards do not have it. */
  instructor: fieldSchema(z.string()).optional(),
  paperType: fieldSchema(z.string()),
  topic: fieldSchema(z.string()),
  promptQuestion: fieldSchema(z.string()),
  length: fieldSchema(lengthValueSchema),
  citationStyle: fieldSchema(citationStyleSchema),
  citationStyleOther: z.string().optional(),
  formattingRules: fieldSchema(z.array(z.string())),
  requiredSources: fieldSchema(requiredSourcesValueSchema),
  providedReadings: fieldSchema(z.array(providedReadingSchema)),
  /** Alias for providedReadings — same list, card label "Provided readings and links". */
  providedSources: fieldSchema(z.array(providedReadingSchema)).optional(),
  structuralRequirements: fieldSchema(z.array(z.string())),
  dueDate: fieldSchema(z.string()),
  rubricCriteria: fieldSchema(z.array(rubricCriterionSchema)),
  otherInstructions: fieldSchema(z.string()),
  aiPolicy: fieldSchema(aiPolicySchema),
  language: fieldSchema(z.string()),
});

export type AssignmentRequirements = z.infer<typeof assignmentRequirementsSchema>;

export function emptyField<T>(value: T | null = null): Field<T> {
  return {
    value,
    confidence: 0,
    source: "missing",
    confirmed: false,
  };
}

export function extractedField<T>(
  value: T,
  confidence: number,
  rawEvidence?: string,
  provenance?: Provenance,
): Field<T> {
  return {
    value,
    confidence,
    source: "extracted",
    confirmed: false,
    ...(rawEvidence ? { rawEvidence } : {}),
    ...(provenance ? { provenance } : {}),
  };
}

export function emptyRequirements(): AssignmentRequirements {
  return {
    schemaVersion: "1.0",
    course: emptyField<string>(),
    paperType: emptyField<string>(),
    topic: emptyField<string>(),
    promptQuestion: emptyField<string>(),
    length: emptyField(),
    citationStyle: emptyField(),
    formattingRules: emptyField<string[]>([]),
    requiredSources: emptyField(),
    providedReadings: emptyField([]),
    providedSources: emptyField([]),
    structuralRequirements: emptyField<string[]>([]),
    dueDate: emptyField<string>(),
    rubricCriteria: emptyField([]),
    otherInstructions: emptyField<string>(),
    aiPolicy: extractedField("unspecified", 0.5),
    language: extractedField("English", 0.5),
  };
}
