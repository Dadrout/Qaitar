import type { CaseAnalysis, LegalChunk, LegalRecommendation } from "../../types/qaitar.ts";
import {
  LegalRecommendationSchema,
  LegalSearchRequestSchema,
  legalRecommendationJsonSchema,
  legalSearchJsonSchema,
} from "./schemas.ts";
import { generateStructured } from "./gemini.ts";
import { getMessages, responseLanguage, type Locale } from "../i18n/index.ts";

export function noReliableLegalBasis(caseType: string, locale: Locale = "ru"): LegalRecommendation {
  const copy = getMessages(locale).legal;
  return {
    status: "no_reliable_basis_found",
    caseType: ["defective_product", "return_product", "refund_delayed", "not_as_described"].includes(caseType)
      ? caseType as LegalRecommendation["caseType"]
      : "other",
    title: copy.notFound,
    summary: copy.needMore,
    reasoning: copy.noSource,
    recommendedAction: "manual_verification",
    legalBasis: [],
    missingInformation: [],
    confidence: "low",
  };
}

export async function createLegalSearchRequest(caseData: CaseAnalysis) {
  return generateStructured({
    prompt: `Преобразуй подтверждённое дело в короткий запрос для поиска по официальному законодательству Казахстана.
Добавь релевантные юридические понятия на русском и казахском, но не называй статьи и сроки.
Дело: ${JSON.stringify(caseData)}`,
    schema: LegalSearchRequestSchema,
    jsonSchema: legalSearchJsonSchema,
    thinkingBudget: 0,
  });
}

export async function reasonFromLegalChunks(
  caseData: CaseAnalysis,
  chunks: LegalChunk[],
  locale: Locale = "ru",
): Promise<LegalRecommendation> {
  if (chunks.length === 0) return noReliableLegalBasis(caseData.caseType, locale);

  const allowedSources = chunks.map((chunk) => chunk.sourceUrl);
  const result = await generateStructured({
    prompt: `Дай краткую рекомендацию по подтверждённому делу, используя ТОЛЬКО приведённые официальные фрагменты.
Не используй память модели для законов, номеров статей, сроков или процедур.
Каждый legalBasis.sourceUrl должен в точности совпадать с URL одного из фрагментов.
Если фрагментов недостаточно, верни status=no_reliable_basis_found и пустой legalBasis.
Пиши на ${responseLanguage(locale)} языке простыми словами. Имена законов и URL сохрани точно как в официальных фрагментах.

Дело: ${JSON.stringify(caseData)}
Официальные фрагменты: ${JSON.stringify(chunks)}`,
    schema: LegalRecommendationSchema,
    jsonSchema: legalRecommendationJsonSchema,
    thinkingBudget: 0,
  });

  if (result.legalBasis.some((basis) => !allowedSources.includes(basis.sourceUrl))) {
    return noReliableLegalBasis(caseData.caseType, locale);
  }
  return result;
}
