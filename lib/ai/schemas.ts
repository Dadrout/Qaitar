import { z } from "zod";

const nullableText = z.string().trim().min(1).nullable();
const sourceUrl = z.string().url().refine(
  (value) => {
    try {
      const parsed = new URL(value);
      const hostname = parsed.hostname;
      return parsed.protocol === "https:" && (hostname === "adilet.zan.kz" || hostname === "law.gov.kz" || hostname === "gov.kz" || hostname.endsWith(".gov.kz"));
    } catch {
      return false;
    }
  },
  "Legal sources must use an official Kazakhstan domain",
);

export const DocumentAnalysisSchema = z.object({
  documentType: z.enum([
    "receipt",
    "seller_conversation",
    "product_photo",
    "warranty",
    "payment_confirmation",
    "marketplace_screenshot",
    "seller_response",
    "other",
  ]),
  merchant: nullableText,
  purchaseDate: z.string().date().nullable(),
  productName: nullableText,
  price: z.number().nonnegative().nullable(),
  currency: z.string().trim().min(3).max(3),
  orderNumber: nullableText,
  extractedText: z.string().max(12_000),
  confidence: z.number().min(0).max(1),
  unreadableReason: nullableText,
});

export const FactSchema = z.object({
  key: z.enum(["seller", "product", "amount", "purchaseDate", "issue", "sellerResponse"]),
  label: z.string().min(1),
  value: z.string().min(1),
  source: z.enum(["document", "user", "inference"]),
  confidence: z.enum(["high", "medium", "low"]),
});

export const CaseAnalysisSchema = z.object({
  caseType: z.enum(["defective_product", "return_product", "refund_delayed", "not_as_described", "other"]),
  summary: z.string().min(1),
  seller: z.object({ name: nullableText }),
  product: z.object({
    name: nullableText,
    price: z.number().nonnegative().nullable(),
    currency: z.string().trim().min(3).max(3),
  }),
  purchaseDate: z.string().date().nullable(),
  issue: nullableText,
  sellerResponse: nullableText,
  facts: z.array(FactSchema),
  missingInformation: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});

export const LegalSearchRequestSchema = z.object({
  query: z.string().min(8).max(500),
  conceptsRu: z.array(z.string().min(2)).max(8),
  conceptsKk: z.array(z.string().min(2)).max(8),
});

export const LegalBasisSchema = z.array(z.object({
  lawName: z.string().min(1),
  article: z.string().min(1),
  explanation: z.string().min(1),
  sourceUrl,
})).max(6);

export const LegalRecommendationSchema = z.object({
  status: z.enum(["legal_basis_found", "additional_information_required", "ambiguous", "no_reliable_basis_found"]),
  caseType: CaseAnalysisSchema.shape.caseType,
  title: z.string().min(1),
  summary: z.string().min(1),
  reasoning: z.string().min(1),
  recommendedAction: z.enum(["send_written_claim", "provide_document", "send_repeat_claim", "prepare_official_appeal", "manual_verification"]),
  legalBasis: LegalBasisSchema,
  missingInformation: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
}).superRefine((value, context) => {
  if (value.status === "legal_basis_found" && value.legalBasis.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["legalBasis"], message: "A legal basis is required" });
  }
});

export const SellerResponseAnalysisSchema = z.object({
  responseType: z.enum(["accepted", "rejected", "additional_information_requested", "unclear", "no_response"]),
  sellerReason: nullableText,
  summary: z.string().min(1),
  newFacts: z.array(FactSchema),
  requiresLegalReview: z.boolean(),
});

export const localeSchema = z.enum(["ru", "kk", "en"]);

export const SellerResponseJsonInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("text"),
    text: z.string().trim().min(3).max(12_000),
    analysis: CaseAnalysisSchema,
    locale: localeSchema,
  }),
  z.object({
    mode: z.literal("no_response"),
    // claimSentAt is accepted for legacy cases but cannot establish seller receipt.
    claimSentAt: z.string().date().optional(),
    claimReceivedAt: z.string().date().optional(),
    analysis: CaseAnalysisSchema,
    locale: localeSchema,
  }),
]).superRefine((input, context) => {
  if (input.mode === "no_response" && input.claimSentAt && input.claimReceivedAt && input.claimReceivedAt < input.claimSentAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["claimReceivedAt"],
      message: "Дата получения претензии не может предшествовать дате направления",
    });
  }
});

export const OfficialActionPlanSchema = z.object({
  status: z.enum(["ready", "manual_verification_required"]),
  title: z.string().trim().min(1),
  authority: z.object({
    name: nullableText,
    reason: z.string().trim().min(1),
    sourceUrl: sourceUrl.nullable(),
  }),
  channels: z.array(z.object({
    type: z.enum(["eotinish", "etutynushy", "written"]),
    label: z.string().trim().min(1),
    url: z.enum(["https://eotinish.kz", "https://eotinish.gov.kz", "https://e-tutynushy.kz"]).nullable(),
    sourceUrl,
  })),
  deadline: z.object({
    label: z.string().trim().min(1),
    date: z.string().date().nullable(),
    explanation: z.string().trim().min(1),
    sourceUrl: sourceUrl.nullable(),
  }),
  steps: z.array(z.string().trim().min(1)),
  requiredAttachments: z.array(z.string().trim().min(1)),
  legalBasis: LegalBasisSchema,
  appealText: nullableText,
  missingInformation: z.array(z.string().trim().min(1)),
  confidence: z.enum(["high", "medium", "low"]),
}).superRefine((value, context) => {
  if (value.status !== "ready") return;
  if (value.steps.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["steps"], message: "At least one action step is required" });
  }
  if (value.channels.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["channels"], message: "A verified submission channel is required" });
  }
  if (value.appealText === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["appealText"], message: "An appeal draft is required" });
  }
  if (value.authority.sourceUrl === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["authority", "sourceUrl"], message: "An official authority source is required" });
  }
  if (value.deadline.sourceUrl === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["deadline", "sourceUrl"], message: "An official deadline source is required" });
  }
});

export const ClaimDataSchema = z.object({
  recipient: z.string().min(1),
  consumerName: z.string().min(1),
  consumerAddress: z.string().min(1),
  consumerPhone: z.string().min(1),
  consumerEmail: z.string().email(),
  purchaseDate: z.string().date(),
  productName: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  issue: z.string().min(1),
  requestedRemedy: z.string().min(1),
  legalBasis: LegalBasisSchema,
});

export const NextActionSchema = z.object({
  type: z.enum(["provide_document", "send_written_claim", "send_repeat_claim", "prepare_official_appeal", "close_case"]),
  title: z.string().min(1),
  explanation: z.string().min(1),
  checklist: z.array(z.string()).max(8),
});

export const DocumentExplanationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  important: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).max(10),
  checklist: z.array(z.string().min(1)).min(1).max(8),
  canAddToCase: z.boolean(),
});

export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>;
export type CaseAnalysisOutput = z.infer<typeof CaseAnalysisSchema>;
export type LegalRecommendationOutput = z.infer<typeof LegalRecommendationSchema>;
export type SellerResponseAnalysisOutput = z.infer<typeof SellerResponseAnalysisSchema>;
export type OfficialActionPlanOutput = z.infer<typeof OfficialActionPlanSchema>;

const nullableStringJson = { anyOf: [{ type: "string" }, { type: "null" }] };
const confidenceJson = { type: "string", enum: ["high", "medium", "low"] };
const factJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    key: { type: "string", enum: ["seller", "product", "amount", "purchaseDate", "issue", "sellerResponse"] },
    label: { type: "string" },
    value: { type: "string" },
    source: { type: "string", enum: ["document", "user", "inference"] },
    confidence: confidenceJson,
  },
  required: ["key", "label", "value", "source", "confidence"],
};

export const documentAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: "string", enum: ["receipt", "seller_conversation", "product_photo", "warranty", "payment_confirmation", "marketplace_screenshot", "seller_response", "other"] },
    merchant: nullableStringJson,
    purchaseDate: nullableStringJson,
    productName: nullableStringJson,
    price: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] },
    currency: { type: "string" },
    orderNumber: nullableStringJson,
    extractedText: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    unreadableReason: nullableStringJson,
  },
  required: ["documentType", "merchant", "purchaseDate", "productName", "price", "currency", "orderNumber", "extractedText", "confidence", "unreadableReason"],
};

export const caseAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    caseType: { type: "string", enum: ["defective_product", "return_product", "refund_delayed", "not_as_described", "other"] },
    summary: { type: "string" },
    seller: { type: "object", properties: { name: nullableStringJson }, required: ["name"], additionalProperties: false },
    product: { type: "object", properties: { name: nullableStringJson, price: { anyOf: [{ type: "number", minimum: 0 }, { type: "null" }] }, currency: { type: "string" } }, required: ["name", "price", "currency"], additionalProperties: false },
    purchaseDate: nullableStringJson,
    issue: nullableStringJson,
    sellerResponse: nullableStringJson,
    facts: { type: "array", items: factJsonSchema },
    missingInformation: { type: "array", items: { type: "string" } },
    confidence: confidenceJson,
  },
  required: ["caseType", "summary", "seller", "product", "purchaseDate", "issue", "sellerResponse", "facts", "missingInformation", "confidence"],
};

export const legalSearchJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string" },
    conceptsRu: { type: "array", items: { type: "string" }, maxItems: 8 },
    conceptsKk: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
  required: ["query", "conceptsRu", "conceptsKk"],
};

export const legalRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["legal_basis_found", "additional_information_required", "ambiguous", "no_reliable_basis_found"] },
    caseType: { type: "string", enum: ["defective_product", "return_product", "refund_delayed", "not_as_described", "other"] },
    title: { type: "string" },
    summary: { type: "string" },
    reasoning: { type: "string" },
    recommendedAction: { type: "string", enum: ["send_written_claim", "provide_document", "send_repeat_claim", "prepare_official_appeal", "manual_verification"] },
    legalBasis: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, properties: { lawName: { type: "string" }, article: { type: "string" }, explanation: { type: "string" }, sourceUrl: { type: "string" } }, required: ["lawName", "article", "explanation", "sourceUrl"] } },
    missingInformation: { type: "array", items: { type: "string" } },
    confidence: confidenceJson,
  },
  required: ["status", "caseType", "title", "summary", "reasoning", "recommendedAction", "legalBasis", "missingInformation", "confidence"],
};

export const sellerResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    responseType: { type: "string", enum: ["accepted", "rejected", "additional_information_requested", "unclear", "no_response"] },
    sellerReason: nullableStringJson,
    summary: { type: "string" },
    newFacts: { type: "array", items: factJsonSchema },
    requiresLegalReview: { type: "boolean" },
  },
  required: ["responseType", "sellerReason", "summary", "newFacts", "requiresLegalReview"],
};

const officialSourceUrlJson = {
  type: "string",
  pattern: "^https://(?:adilet\\.zan\\.kz|law\\.gov\\.kz|(?:[a-zA-Z0-9-]+\\.)*gov\\.kz)(?::[0-9]{1,5})?(?:[/?#]|$)",
};

export const officialActionPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ready", "manual_verification_required"] },
    title: { type: "string" },
    authority: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: nullableStringJson,
        reason: { type: "string" },
        sourceUrl: { anyOf: [officialSourceUrlJson, { type: "null" }] },
      },
      required: ["name", "reason", "sourceUrl"],
    },
    channels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["eotinish", "etutynushy", "written"] },
          label: { type: "string" },
          url: nullableStringJson,
          sourceUrl: officialSourceUrlJson,
        },
        required: ["type", "label", "url", "sourceUrl"],
      },
    },
    deadline: {
      type: "object",
      additionalProperties: false,
      properties: {
        label: { type: "string" },
        date: nullableStringJson,
        explanation: { type: "string" },
        sourceUrl: { anyOf: [officialSourceUrlJson, { type: "null" }] },
      },
      required: ["label", "date", "explanation", "sourceUrl"],
    },
    steps: { type: "array", items: { type: "string" } },
    requiredAttachments: { type: "array", items: { type: "string" } },
    legalBasis: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          lawName: { type: "string" },
          article: { type: "string" },
          explanation: { type: "string" },
          sourceUrl: officialSourceUrlJson,
        },
        required: ["lawName", "article", "explanation", "sourceUrl"],
      },
    },
    appealText: nullableStringJson,
    missingInformation: { type: "array", items: { type: "string" } },
    confidence: confidenceJson,
  },
  required: ["status", "title", "authority", "channels", "deadline", "steps", "requiredAttachments", "legalBasis", "appealText", "missingInformation", "confidence"],
};

export const documentExplanationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    important: { type: "array", maxItems: 10, items: { type: "object", additionalProperties: false, properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
    checklist: { type: "array", minItems: 1, maxItems: 8, items: { type: "string" } },
    canAddToCase: { type: "boolean" },
  },
  required: ["title", "description", "important", "checklist", "canAddToCase"],
};
