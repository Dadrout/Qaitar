import { z } from "zod";
import { CASE_STATES, type QaitarCase } from "../types/qaitar.ts";

export type CaseCollection = {
  version: 2;
  activeCaseId: string | null;
  cases: QaitarCase[];
};

export const CASE_COLLECTION_KEY = "qaitar.cases.v2";
export const LEGACY_CASE_KEY = "qaitar.current-case.v1";

const emptyCollection = (): CaseCollection => ({ version: 2, activeCaseId: null, cases: [] });
const problemTypeSchema = z.enum(["defective_product", "return_product", "refund_delayed", "not_as_described", "other"]);
const confidenceSchema = z.enum(["high", "medium", "low"]);
const nullableStringSchema = z.string().nullable();
const factSchema = z.object({
  key: z.enum(["seller", "product", "amount", "purchaseDate", "issue", "sellerResponse"]),
  label: z.string(),
  value: z.string(),
  source: z.enum(["document", "user", "inference"]),
  confidence: confidenceSchema,
});
const legalBasisSchema = z.object({
  lawName: z.string(),
  article: z.string(),
  explanation: z.string(),
  sourceUrl: z.string(),
});
const analysisSchema = z.object({
  caseType: problemTypeSchema,
  summary: z.string(),
  seller: z.object({ name: nullableStringSchema }),
  product: z.object({ name: nullableStringSchema, price: z.number().nullable(), currency: z.string() }),
  purchaseDate: nullableStringSchema,
  issue: nullableStringSchema,
  sellerResponse: nullableStringSchema,
  facts: z.array(factSchema),
  missingInformation: z.array(z.string()),
  confidence: confidenceSchema,
});
const recommendationSchema = z.object({
  status: z.enum(["legal_basis_found", "additional_information_required", "ambiguous", "no_reliable_basis_found"]),
  caseType: problemTypeSchema,
  title: z.string(),
  summary: z.string(),
  reasoning: z.string(),
  recommendedAction: z.enum(["send_written_claim", "provide_document", "send_repeat_claim", "prepare_official_appeal", "manual_verification"]),
  legalBasis: z.array(legalBasisSchema),
  missingInformation: z.array(z.string()),
  confidence: confidenceSchema,
});
const sellerResponseInputSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("file"), fileName: z.string(), mimeType: z.string(), size: z.number(), submittedAt: z.string() }),
  z.object({ mode: z.literal("text"), text: z.string(), submittedAt: z.string() }),
  z.object({ mode: z.literal("no_response"), claimSentAt: z.string().optional(), claimReceivedAt: z.string().optional(), submittedAt: z.string() }),
]);
const sellerResponseSchema = z.object({
  responseType: z.enum(["accepted", "rejected", "additional_information_requested", "unclear", "no_response"]),
  sellerReason: nullableStringSchema,
  summary: z.string(),
  newFacts: z.array(factSchema),
  requiresLegalReview: z.boolean(),
});
const officialActionPlanSchema = z.object({
  status: z.enum(["ready", "manual_verification_required"]),
  title: z.string(),
  authority: z.object({ name: nullableStringSchema, reason: z.string(), sourceUrl: nullableStringSchema }),
  channels: z.array(z.object({
    type: z.enum(["eotinish", "etutynushy", "written"]),
    label: z.string(),
    url: nullableStringSchema,
    sourceUrl: z.string(),
  })),
  deadline: z.object({ label: z.string(), date: nullableStringSchema, explanation: z.string(), sourceUrl: nullableStringSchema }),
  steps: z.array(z.string()),
  requiredAttachments: z.array(z.string()),
  legalBasis: z.array(legalBasisSchema),
  appealText: nullableStringSchema,
  missingInformation: z.array(z.string()),
  confidence: confidenceSchema,
});
const evidenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  mimeType: z.string(),
  detectedType: z.string(),
  status: z.enum(["ready", "processing", "processed", "error"]),
});
const storedCaseSchema = z.object({
  id: z.string().refine((id) => id.trim().length > 0),
  state: z.enum(CASE_STATES),
  problemType: problemTypeSchema.nullable().default(null),
  problemDescription: z.string().default(""),
  demo: z.boolean().default(false),
  evidence: z.array(evidenceSchema).default([]),
  analysis: analysisSchema.nullable().default(null),
  recommendation: recommendationSchema.nullable().default(null),
  claim: nullableStringSchema.default(null),
  claimSentAt: nullableStringSchema.default(null),
  sellerResponseInput: sellerResponseInputSchema.nullable().default(null),
  sellerResponse: sellerResponseSchema.nullable().default(null),
  officialActionPlan: officialActionPlanSchema.nullable().default(null),
  updatedAt: z.string().refine((timestamp) => Number.isFinite(Date.parse(timestamp))),
});

export function createEmptyCase(id = "draft"): QaitarCase {
  return {
    id,
    state: "NEW_CASE",
    problemType: null,
    problemDescription: "",
    demo: false,
    evidence: [],
    analysis: null,
    recommendation: null,
    claim: null,
    claimSentAt: null,
    sellerResponseInput: null,
    sellerResponse: null,
    officialActionPlan: null,
    updatedAt: new Date().toISOString(),
  };
}

export function restoreCaseCollection(v2: string, legacy: string): CaseCollection {
  if (!v2) {
    const restored = parseJson(legacy);
    const migrated = normalizeCase(restored);
    return migrated ? { version: 2, activeCaseId: migrated.id, cases: [migrated] } : emptyCollection();
  }

  const parsed = parseJson(v2);
  if (!isRecord(parsed) || parsed.version !== 2 || !Array.isArray(parsed.cases)) return emptyCollection();

  const byId = new Map<string, QaitarCase>();
  for (const value of parsed.cases) {
    const item = normalizeCase(value);
    if (!item) continue;
    const previous = byId.get(item.id);
    if (!previous || Date.parse(item.updatedAt) > Date.parse(previous.updatedAt)) byId.set(item.id, item);
  }
  const cases = sortCases([...byId.values()]);
  const activeCaseId = typeof parsed.activeCaseId === "string" && byId.has(parsed.activeCaseId)
    ? parsed.activeCaseId
    : cases[0]?.id ?? null;
  return { version: 2, activeCaseId, cases };
}

export function upsertCase(collection: CaseCollection, caseData: QaitarCase): CaseCollection {
  return {
    version: 2,
    activeCaseId: caseData.id,
    cases: sortCases([...collection.cases.filter((item) => item.id !== caseData.id), caseData]),
  };
}

export function removeCase(collection: CaseCollection, caseId: string): CaseCollection {
  const cases = collection.cases.filter((item) => item.id !== caseId);
  if (cases.length === collection.cases.length) return collection;
  return {
    version: 2,
    activeCaseId: collection.activeCaseId === caseId ? cases[0]?.id ?? null : collection.activeCaseId,
    cases,
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCase(value: unknown): QaitarCase | null {
  const parsed = storedCaseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function sortCases(cases: QaitarCase[]): QaitarCase[] {
  return cases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
