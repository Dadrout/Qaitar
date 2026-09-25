import type { CaseAnalysis, SellerResponseAnalysis } from "../types/qaitar.ts";
import type { DocumentAnalysis } from "../lib/ai/schemas.ts";

export const documentAnalysisFixture: DocumentAnalysis = {
  documentType: "receipt", merchant: "Example Electronics", purchaseDate: "2026-09-12",
  productName: "Беспроводные наушники", price: 39_990, currency: "KZT",
  orderNumber: "A-42", extractedText: "Кассовый чек A-42", confidence: 0.96,
  unreadableReason: null,
};

export const caseAnalysisFixture: CaseAnalysis = {
  caseType: "defective_product", summary: "Спор по беспроводным наушникам.",
  seller: { name: "Example Electronics" },
  product: { name: "Беспроводные наушники", price: 39_990, currency: "KZT" },
  purchaseDate: "2026-09-12", issue: "Левый наушник не работает", sellerResponse: null,
  facts: [], missingInformation: [], confidence: "high",
};

export const rejectedResponseFixture: SellerResponseAnalysis = {
  responseType: "rejected", sellerReason: "Возврат не предусмотрен",
  summary: "Продавец отказал в возврате денег.", newFacts: [], requiresLegalReview: true,
};
