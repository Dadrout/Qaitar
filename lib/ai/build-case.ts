import {
  CaseAnalysisSchema,
  type CaseAnalysisOutput,
  type DocumentAnalysis,
} from "./schemas.ts";
import type { Locale } from "../i18n/index.ts";

type CaseType = CaseAnalysisOutput["caseType"];
type Fact = CaseAnalysisOutput["facts"][number];

const caseTypes = new Set<CaseType>(["defective_product", "return_product", "refund_delayed", "not_as_described", "other"]);

type BuildCaseOptions = {
  problemType?: CaseAnalysisOutput["caseType"] | null;
  problemDescription?: string;
  locale?: Locale;
};

const copy = {
  ru: {
    issues: { defective_product: "Товар с недостатком", return_product: "Возврат товара", refund_delayed: "Возврат денег задерживается", not_as_described: "Товар не соответствует описанию", other: "Другая проблема с покупкой" },
    labels: { seller: "Продавец", product: "Товар", amount: "Сумма", purchaseDate: "Дата покупки", issue: "Проблема", sellerResponse: "Ответ продавца" },
    missing: { seller: "Название продавца", product: "Название товара", amount: "Сумма покупки", purchaseDate: "Дата покупки", issue: "Описание проблемы" },
    summary: (product: string | null, seller: string | null) => product && seller ? `Спор по товару «${product}» с продавцом ${seller}.` : product ? `Спор по товару «${product}».` : seller ? `Потребительский спор с продавцом ${seller}.` : "Потребительский спор по загруженным документам.",
  },
  kk: {
    issues: { defective_product: "Тауардың ақауы бар", return_product: "Тауарды қайтару", refund_delayed: "Ақшаны қайтару кешіктірілуде", not_as_described: "Тауар сипаттамаға сәйкес емес", other: "Сатып алуға қатысты басқа мәселе" },
    labels: { seller: "Сатушы", product: "Тауар", amount: "Сома", purchaseDate: "Сатып алу күні", issue: "Мәселе", sellerResponse: "Сатушының жауабы" },
    missing: { seller: "Сатушының атауы", product: "Тауардың атауы", amount: "Сатып алу сомасы", purchaseDate: "Сатып алу күні", issue: "Мәселенің сипаттамасы" },
    summary: (product: string | null, seller: string | null) => product && seller ? `«${product}» тауары бойынша ${seller} сатушысымен дау.` : product ? `«${product}» тауары бойынша дау.` : seller ? `${seller} сатушысымен тұтынушылық дау.` : "Жүктелген құжаттар бойынша тұтынушылық дау.",
  },
  en: {
    issues: { defective_product: "Defective product", return_product: "Product return", refund_delayed: "Refund is delayed", not_as_described: "Product is not as described", other: "Another purchase problem" },
    labels: { seller: "Seller", product: "Product", amount: "Amount", purchaseDate: "Purchase date", issue: "Issue", sellerResponse: "Seller response" },
    missing: { seller: "Seller name", product: "Product name", amount: "Purchase amount", purchaseDate: "Purchase date", issue: "Issue description" },
    summary: (product: string | null, seller: string | null) => product && seller ? `Consumer dispute about “${product}” with ${seller}.` : product ? `Consumer dispute about “${product}”.` : seller ? `Consumer dispute with ${seller}.` : "Consumer dispute based on the uploaded documents.",
  },
} as const;

function bestDocument<T>(documents: DocumentAnalysis[], read: (document: DocumentAnalysis) => T | null) {
  return documents
    .map((document) => ({ document, value: read(document) }))
    .filter((entry): entry is { document: DocumentAnalysis; value: T } => entry.value !== null)
    .sort((left, right) => right.document.confidence - left.document.confidence)[0] ?? null;
}

function factConfidence(score: number): Fact["confidence"] {
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

function compactText(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 500 ? `${normalized.slice(0, 497)}…` : normalized;
}

export async function buildCase(
  documents: DocumentAnalysis[],
  { problemType, problemDescription = "", locale = "ru" }: BuildCaseOptions = {},
): Promise<CaseAnalysisOutput> {
  const text = copy[locale];
  const caseType: CaseType = caseTypes.has(problemType as CaseType) ? problemType as CaseType : "other";
  const seller = bestDocument(documents, (document) => document.merchant);
  const product = bestDocument(documents, (document) => document.productName);
  const amount = bestDocument(documents, (document) => document.price);
  const purchaseDate = bestDocument(documents, (document) => document.purchaseDate);
  const response = bestDocument(
    documents.filter((document) => document.documentType === "seller_response" || document.documentType === "seller_conversation"),
    (document) => compactText(document.extractedText) || null,
  );
  const issue = problemDescription.trim() || (problemType ? text.issues[caseType] : null);
  const facts: Fact[] = [];

  if (seller) facts.push({ key: "seller", label: text.labels.seller, value: seller.value, source: "document", confidence: factConfidence(seller.document.confidence) });
  if (product) facts.push({ key: "product", label: text.labels.product, value: product.value, source: "document", confidence: factConfidence(product.document.confidence) });
  if (amount) {
    const currency = amount.document.currency || "KZT";
    const value = new Intl.NumberFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale], { maximumFractionDigits: 2 }).format(amount.value);
    facts.push({ key: "amount", label: text.labels.amount, value: `${value} ${currency}`, source: "document", confidence: factConfidence(amount.document.confidence) });
  }
  if (purchaseDate) facts.push({ key: "purchaseDate", label: text.labels.purchaseDate, value: purchaseDate.value, source: "document", confidence: factConfidence(purchaseDate.document.confidence) });
  if (issue) facts.push({ key: "issue", label: text.labels.issue, value: issue, source: "user", confidence: "high" });
  if (response) facts.push({ key: "sellerResponse", label: text.labels.sellerResponse, value: response.value, source: "document", confidence: factConfidence(response.document.confidence) });

  const missingInformation = [
    !seller && text.missing.seller,
    !product && text.missing.product,
    !amount && text.missing.amount,
    !purchaseDate && text.missing.purchaseDate,
    !issue && text.missing.issue,
  ].filter(Boolean) as string[];
  const averageConfidence = documents.length ? documents.reduce((total, document) => total + document.confidence, 0) / documents.length : 0;

  return CaseAnalysisSchema.parse({
    caseType,
    summary: text.summary(product?.value ?? null, seller?.value ?? null),
    seller: { name: seller?.value ?? null },
    product: { name: product?.value ?? null, price: amount?.value ?? null, currency: amount?.document.currency || "KZT" },
    purchaseDate: purchaseDate?.value ?? null,
    issue,
    sellerResponse: response?.value ?? null,
    facts,
    missingInformation,
    confidence: averageConfidence >= 0.85 && missingInformation.length <= 1 ? "high" : facts.length >= 2 ? "medium" : "low",
  });
}
