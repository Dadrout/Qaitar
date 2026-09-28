import type { CaseAnalysis, LegalRecommendation } from "../../types/qaitar.ts";
import { composeClaim } from "../claim.ts";
import type { Locale } from "../i18n/index.ts";

type ConsumerDetails = { name: string; address: string; phone: string; email: string };

export function generateClaim(
  caseData: CaseAnalysis,
  recommendation: LegalRecommendation,
  consumer: ConsumerDetails,
  locale: Locale = "ru",
) {
  if (recommendation.status !== "legal_basis_found" || recommendation.legalBasis.length === 0) {
    throw new Error("Для претензии не найдено проверенное правовое основание");
  }
  if (!caseData.seller.name || !caseData.product.name || caseData.product.price === null || !caseData.purchaseDate || !caseData.issue) {
    throw new Error("Для претензии не хватает подтверждённых данных");
  }
  return composeClaim({
    consumer,
    seller: caseData.seller.name,
    product: caseData.product.name,
    amount: caseData.product.price,
    currency: caseData.product.currency,
    purchaseDate: caseData.purchaseDate,
    issue: caseData.issue,
    remedy: "вернуть уплаченную за товар сумму в полном объёме",
    legalBasis: recommendation.legalBasis,
  }, locale);
}
