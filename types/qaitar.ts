export const CASE_STATES = [
  "NEW_CASE",
  "FILES_UPLOADED",
  "DOCUMENTS_ANALYZED",
  "CASE_CONFIRMED",
  "LEGAL_SEARCH_COMPLETED",
  "LEGAL_BASIS_FOUND",
  "CLAIM_READY",
  "CLAIM_GENERATED",
  "WAITING_FOR_RESPONSE",
  "SELLER_RESPONSE_UPLOADED",
  "SELLER_ACCEPTED",
  "SELLER_REJECTED",
  "ESCALATION_READY",
  "RESOLVED",
] as const;

export type CaseState = (typeof CASE_STATES)[number];
export type FactSource = "document" | "user" | "inference";

export type CaseFact = {
  key: "seller" | "product" | "amount" | "purchaseDate" | "issue" | "sellerResponse";
  label: string;
  value: string;
  source: FactSource;
  confidence: "high" | "medium" | "low";
};

export type CaseAnalysis = {
  caseType:
    | "defective_product"
    | "return_product"
    | "refund_delayed"
    | "not_as_described"
    | "other";
  summary: string;
  seller: { name: string | null };
  product: { name: string | null; price: number | null; currency: string };
  purchaseDate: string | null;
  issue: string | null;
  sellerResponse: string | null;
  facts: CaseFact[];
  missingInformation: string[];
  confidence: "high" | "medium" | "low";
};

export type LegalBasis = {
  lawName: string;
  article: string;
  explanation: string;
  sourceUrl: string;
};

export type LegalRecommendation = {
  status:
    | "legal_basis_found"
    | "additional_information_required"
    | "ambiguous"
    | "no_reliable_basis_found";
  caseType: CaseAnalysis["caseType"];
  title: string;
  summary: string;
  reasoning: string;
  recommendedAction:
    | "send_written_claim"
    | "provide_document"
    | "send_repeat_claim"
    | "prepare_official_appeal"
    | "manual_verification";
  legalBasis: LegalBasis[];
  missingInformation: string[];
  confidence: "high" | "medium" | "low";
};

export type SellerResponseAnalysis = {
  responseType: "accepted" | "rejected" | "additional_information_requested" | "unclear" | "no_response";
  sellerReason: string | null;
  summary: string;
  newFacts: CaseFact[];
  requiresLegalReview: boolean;
};

export type SellerResponseInput =
  | { mode: "file"; fileName: string; mimeType: string; size: number; submittedAt: string }
  | { mode: "text"; text: string; submittedAt: string }
  | { mode: "no_response"; claimSentAt?: string; claimReceivedAt?: string; submittedAt: string };

export type OfficialActionPlanStatus = "ready" | "manual_verification_required";
export type OfficialSubmissionChannel = {
  type: "eotinish" | "etutynushy" | "written";
  label: string;
  url: string | null;
  sourceUrl: string;
};

export type OfficialActionPlan = {
  status: OfficialActionPlanStatus;
  title: string;
  authority: { name: string | null; reason: string; sourceUrl: string | null };
  channels: OfficialSubmissionChannel[];
  deadline: { label: string; date: string | null; explanation: string; sourceUrl: string | null };
  steps: string[];
  requiredAttachments: string[];
  legalBasis: LegalBasis[];
  appealText: string | null;
  missingInformation: string[];
  confidence: "high" | "medium" | "low";
};

export type EvidenceItem = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  detectedType: string;
  status: "ready" | "processing" | "processed" | "error";
  previewUrl?: string;
};

export type QaitarCase = {
  id: string;
  state: CaseState;
  problemType: CaseAnalysis["caseType"] | null;
  problemDescription: string;
  demo: boolean;
  evidence: EvidenceItem[];
  analysis: CaseAnalysis | null;
  recommendation: LegalRecommendation | null;
  claim: string | null;
  claimSentAt: string | null;
  sellerResponseInput: SellerResponseInput | null;
  sellerResponse: SellerResponseAnalysis | null;
  officialActionPlan: OfficialActionPlan | null;
  updatedAt: string;
};

export type LegalChunk = {
  id: string;
  lawName: string;
  article: string;
  section: string | null;
  text: string;
  language: string;
  sourceUrl: string;
  similarity?: number;
};
