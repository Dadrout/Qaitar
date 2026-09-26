import { analyzeSellerResponse } from "../../../lib/ai/analyze-seller-response.ts";
import { getSellerResponseUserMessage } from "../../../lib/ai/gemini.ts";
import { embedLegalQuery } from "../../../lib/ai/embeddings.ts";
import { createLegalSearchRequest, noReliableLegalBasis, reasonFromLegalChunks } from "../../../lib/ai/legal-reasoning.ts";
import { CaseAnalysisSchema } from "../../../lib/ai/schemas.ts";
import { getDemoSellerResponse } from "../../../lib/demo/scenario.ts";
import { normalizeLocale } from "../../../lib/i18n/index.ts";
import { retrieveLegalChunks } from "../../../lib/legal/retrieve.ts";
import { buildOfficialActionPlan } from "../../../lib/official-action-plan.ts";
import { buildNoResponseAnalysis, buildUnverifiedNoResponseAnalysis, hasSellerResponseDeadlineElapsed, normalizeSellerResponseFile, parseSellerResponseJson } from "../../../lib/seller-response-input.ts";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let caseData: z.infer<typeof CaseAnalysisSchema> | null;
    let locale: ReturnType<typeof normalizeLocale>;
    let demo = false;
    let responseAnalysis;
    let claimSentAt: string | null = null;
    let verifiedClaimReceivedAt: string | null = null;
    let missingReceiptDate = false;
    const today = new Date();

    if (contentType.includes("application/json")) {
      const input = parseSellerResponseJson(await request.json());
      caseData = input.analysis;
      locale = input.locale;
      if (input.mode === "no_response") {
        claimSentAt = input.claimSentAt ?? null;
        verifiedClaimReceivedAt = input.claimReceivedAt ?? null;
        if (verifiedClaimReceivedAt && !hasSellerResponseDeadlineElapsed(verifiedClaimReceivedAt, today)) {
          return Response.json({ error: "Срок ответа продавца ещё не истёк" }, { status: 400 });
        }
        missingReceiptDate = !verifiedClaimReceivedAt;
        responseAnalysis = missingReceiptDate ? buildUnverifiedNoResponseAnalysis(locale) : buildNoResponseAnalysis(locale);
      } else {
        responseAnalysis = await analyzeSellerResponse({
          mode: "text",
          text: input.text,
          caseSummary: caseData.summary,
          locale,
        });
      }
    } else if (contentType.includes("multipart/form-data")) {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return Response.json({ error: "Некорректные данные ответа продавца" }, { status: 400 });
      }
      const file = formData.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Добавьте ответ продавца" }, { status: 400 });
      const validation = normalizeSellerResponseFile(file);
      if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

      const serializedCase = formData.get("analysis");
      caseData = serializedCase
        ? CaseAnalysisSchema.parse(JSON.parse(String(serializedCase)))
        : null;
      demo = formData.get("demo") === "true";
      locale = normalizeLocale(formData.get("locale"));
      responseAnalysis = demo
        ? getDemoSellerResponse(locale)
        : await analyzeSellerResponse({
            mode: "file",
            mimeType: validation.mimeType,
            base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
            caseSummary: caseData?.summary ?? "Контекст дела недоступен. Анализируй только содержание ответа продавца.",
            locale,
          });
    } else {
      return Response.json({ error: "Неподдерживаемый формат запроса" }, { status: 415 });
    }

    if (!responseAnalysis.requiresLegalReview || !caseData) {
      return Response.json({ responseAnalysis, recommendation: null, officialActionPlan: null, demo });
    }

    if (missingReceiptDate) {
      const recommendation = noReliableLegalBasis(caseData.caseType, locale);
      const officialActionPlan = buildOfficialActionPlan({ caseData, responseAnalysis, recommendation, chunks: [], locale, today, claimSentAt });
      return Response.json({ responseAnalysis, recommendation, officialActionPlan, demo: false });
    }

    if (demo) {
      const recommendation = {
        status: "legal_basis_found" as const,
        caseType: "defective_product" as const,
        title: locale === "kk" ? "Ресми өтініш дайындаңыз" : locale === "en" ? "Prepare an official appeal" : "Подготовьте официальное обращение",
        summary: locale === "kk" ? "Сатушының бас тартуы істі аяқтамайды. Жауапты сақтап, тұтынушылар құқығын қорғау органына өтінішке тіркеңіз." : locale === "en" ? "The seller's refusal does not end the case. Save the response and attach it to an appeal to the consumer protection authority." : "Отказ продавца не завершает дело. Сохраните ответ и приложите его к обращению в орган защиты прав потребителей.",
        reasoning: locale === "kk" ? "Жазбаша шағым жіберілді, сатушы бас тартты. Ресми дереккөздер келесі өтініш кезеңін қарастырады." : locale === "en" ? "The written claim was sent and the seller refused. Official sources describe a further appeal step." : "Письменная претензия уже направлена, и продавец отказал. Официальные источники предусматривают следующий этап обращения.",
        recommendedAction: "prepare_official_appeal" as const,
        legalBasis: [{
          lawName: "Закон Республики Казахстан «О защите прав потребителей»",
          article: "42-4, 42-5",
          explanation: locale === "kk" ? "Жазбаша бас тартудан кейін немесе 10 күнтізбелік күн ішінде жауап болмаса, тұтынушы уәкілетті мемлекеттік органға жүгіне алады." : locale === "en" ? "After a written refusal or no reply within 10 calendar days, the consumer may contact the authorized state body." : "После письменного отказа или отсутствия ответа в течение 10 календарных дней потребитель вправе обратиться в уполномоченный государственный орган.",
          sourceUrl: "https://adilet.zan.kz/rus/docs/Z100000274_",
        }],
        missingInformation: [],
        confidence: "high" as const,
      };
      return Response.json({
        responseAnalysis,
        recommendation,
        officialActionPlan: buildOfficialActionPlan({ caseData, responseAnalysis, recommendation, chunks: [], locale, today, claimSentAt, verifiedClaimReceivedAt }),
        demo: true,
      });
    }

    const enrichedCase = { ...caseData, sellerResponse: responseAnalysis.summary };
    const search = await createLegalSearchRequest(enrichedCase);
    const embedding = await embedLegalQuery(search.query);
    const chunks = await retrieveLegalChunks(search.query, embedding);
    const recommendation = chunks.length
      ? await reasonFromLegalChunks(enrichedCase, chunks, locale)
      : noReliableLegalBasis(enrichedCase.caseType, locale);
    const officialActionPlan = responseAnalysis.responseType === "rejected" || responseAnalysis.responseType === "no_response"
      ? buildOfficialActionPlan({ caseData, responseAnalysis, recommendation, chunks, locale, today, claimSentAt, verifiedClaimReceivedAt })
      : null;
    return Response.json({ responseAnalysis, recommendation, officialActionPlan, demo: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      if (error.issues.some((issue) => issue.path[0] === "claimReceivedAt" && issue.code === "custom")) {
        return Response.json({ error: "Дата получения претензии не может предшествовать дате направления. Проверьте обе даты." }, { status: 400 });
      }
      return Response.json({ error: "Некорректные данные ответа продавца" }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Некорректные данные ответа продавца" }, { status: 400 });
    }
    console.error("Seller response analysis failed", error);
    return Response.json({ error: getSellerResponseUserMessage(error) }, { status: 502 });
  }
}
