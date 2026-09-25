import { CASE_STATES, type CaseAnalysis, type EvidenceItem, type QaitarCase } from "../types/qaitar.ts";

export type CaseCollection = {
  version: 2;
  activeCaseId: string | null;
  cases: QaitarCase[];
};

export const CASE_COLLECTION_KEY = "qaitar.cases.v2";
export const LEGACY_CASE_KEY = "qaitar.current-case.v1";

const emptyCollection = (): CaseCollection => ({ version: 2, activeCaseId: null, cases: [] });
const problemTypes = new Set<CaseAnalysis["caseType"]>([
  "defective_product", "return_product", "refund_delayed", "not_as_described", "other",
]);

export function createEmptyCase(id = "draft"): QaitarCase {
  return {
    id,
    state: "NEW_CASE",
    problemType: null,
    problemDescription: "",
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
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) return null;
  if (!CASE_STATES.some((state) => state === value.state)) return null;
  if (typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))) return null;

  const defaults = createEmptyCase(value.id);
  return {
    ...defaults,
    id: value.id,
    state: value.state as QaitarCase["state"],
    problemType: problemTypes.has(value.problemType as CaseAnalysis["caseType"])
      ? value.problemType as CaseAnalysis["caseType"] : null,
    problemDescription: typeof value.problemDescription === "string" ? value.problemDescription : "",
    evidence: Array.isArray(value.evidence) ? value.evidence.filter(isRecord).map(normalizeEvidence) : [],
    analysis: isRecord(value.analysis) ? value.analysis as QaitarCase["analysis"] : null,
    recommendation: isRecord(value.recommendation) ? value.recommendation as QaitarCase["recommendation"] : null,
    claim: typeof value.claim === "string" ? value.claim : null,
    claimSentAt: typeof value.claimSentAt === "string" ? value.claimSentAt : null,
    sellerResponseInput: isRecord(value.sellerResponseInput) ? value.sellerResponseInput as QaitarCase["sellerResponseInput"] : null,
    sellerResponse: isRecord(value.sellerResponse) ? value.sellerResponse as QaitarCase["sellerResponse"] : null,
    officialActionPlan: isRecord(value.officialActionPlan) ? value.officialActionPlan as QaitarCase["officialActionPlan"] : null,
    updatedAt: value.updatedAt,
  };
}

function normalizeEvidence(value: Record<string, unknown>): EvidenceItem {
  const { previewUrl: _previewUrl, ...stored } = value;
  return stored as EvidenceItem;
}

function sortCases(cases: QaitarCase[]): QaitarCase[] {
  return cases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
