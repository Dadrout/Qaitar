import type { CaseAnalysis, LegalRecommendation, SellerResponseAnalysis } from "../../types/qaitar.ts";
import type { Locale } from "../i18n/index.ts";

const requiredDemoFiles = new Set(["receipt.jpg", "seller-chat.png"]);

export function isSeededDemo(input: { demo?: boolean; fileNames: string[] }) {
  if (input.demo !== true) return false;
  const names = new Set(input.fileNames.map((name) => name.toLowerCase()));
  return [...requiredDemoFiles].every((name) => names.has(name));
}

export const demoCaseAnalysis: CaseAnalysis = {
  caseType: "defective_product",
  summary: "Вы купили беспроводные наушники за 39 990 ₸. Левый наушник перестал работать, а продавец отказал в возврате денег.",
  seller: { name: "ТОО «Example Electronics»" },
  product: { name: "Беспроводные наушники", price: 39_990, currency: "KZT" },
  purchaseDate: "2026-09-12",
  issue: "Не работает левый наушник",
  sellerResponse: "Продавец отказал в возврате денег",
  missingInformation: [],
  confidence: "high",
  facts: [
    { key: "seller", label: "Продавец", value: "ТОО «Example Electronics»", source: "document", confidence: "high" },
    { key: "product", label: "Товар", value: "Беспроводные наушники", source: "document", confidence: "high" },
    { key: "amount", label: "Цена", value: "39 990 ₸", source: "document", confidence: "high" },
    { key: "purchaseDate", label: "Дата покупки", value: "12 сентября 2026", source: "document", confidence: "high" },
    { key: "issue", label: "Проблема", value: "Не работает левый наушник", source: "user", confidence: "high" },
    { key: "sellerResponse", label: "Ответ продавца", value: "Отказ в возврате денег", source: "document", confidence: "high" },
  ],
};

export const demoLegalRecommendation: LegalRecommendation = {
  status: "legal_basis_found",
  caseType: "defective_product",
  title: "Есть основания требовать возврат денег",
  summary: "Для товара с недостатком закон позволяет выбрать возврат уплаченной суммы, если недостаток не был заранее оговорён продавцом.",
  reasoning: "Чек подтверждает покупку, а переписка — обращение к продавцу и отказ. Следующий фиксируемый шаг — письменная претензия с выбранным требованием.",
  recommendedAction: "send_written_claim",
  legalBasis: [
    {
      lawName: "Закон Республики Казахстан «О защите прав потребителей»",
      article: "15",
      explanation: "Определяет права покупателя, которому продан товар ненадлежащего качества, включая требование о возврате уплаченной суммы.",
      sourceUrl: "https://adilet.zan.kz/rus/docs/Z100000274_",
    },
    {
      lawName: "Официальное разъяснение о возврате товара",
      article: "Порядок подачи претензии",
      explanation: "Претензию можно вручить продавцу лично, почтой или по указанному им электронному адресу; срок ответа — 10 календарных дней.",
      sourceUrl: "https://www.gov.kz/situations/464/intro?lang=ru",
    },
  ],
  missingInformation: [],
  confidence: "high",
};

export const demoSellerResponse: SellerResponseAnalysis = {
  responseType: "rejected",
  sellerReason: "Продавец считает, что вскрытые наушники возврату не подлежат.",
  summary: "Продавец отказал в возврате, сославшись на вскрытую упаковку.",
  newFacts: [
    { key: "sellerResponse", label: "Причина отказа", value: "Товар был вскрыт", source: "document", confidence: "high" },
  ],
  requiresLegalReview: true,
};

export function getDemoCaseAnalysis(locale: Locale): CaseAnalysis {
  if (locale === "ru") return demoCaseAnalysis;
  const text = locale === "kk" ? {
    summary: "Сіз 39 990 ₸-ге сымсыз құлаққап сатып алдыңыз. Сол жақ құлаққап жұмыс істемей қалды, ал сатушы ақшаны қайтарудан бас тартты.",
    product: "Сымсыз құлаққап", issue: "Сол жақ құлаққап жұмыс істемейді", response: "Сатушы ақшаны қайтарудан бас тартты", shortResponse: "Ақшаны қайтарудан бас тарту", date: "2026 жылғы 12 қыркүйек",
  } : {
    summary: "You bought wireless headphones for ₸39,990. The left earbud stopped working, and the seller refused a refund.",
    product: "Wireless headphones", issue: "The left earbud does not work", response: "The seller refused a refund", shortResponse: "Refund refused", date: "September 12, 2026",
  };
  return {
    ...demoCaseAnalysis,
    summary: text.summary,
    product: { ...demoCaseAnalysis.product, name: text.product },
    issue: text.issue,
    sellerResponse: text.response,
    facts: demoCaseAnalysis.facts.map((fact) => ({
      ...fact,
      value: ({ product: text.product, purchaseDate: text.date, issue: text.issue, sellerResponse: text.shortResponse } as Record<string, string>)[fact.key] ?? fact.value,
    })),
  };
}

export function getDemoLegalRecommendation(locale: Locale): LegalRecommendation {
  if (locale === "ru") return demoLegalRecommendation;
  const text = locale === "kk" ? {
    title: "Ақшаны қайтаруды талап етуге негіз бар",
    summary: "Егер кемшілік алдын ала ескертілмесе, ақаулы тауар үшін төленген ақшаны қайтаруды таңдауға болады.",
    reasoning: "Түбіртек сатып алуды, ал хат алмасу сатушыға жүгіну мен бас тартуды растайды. Келесі қадам — жазбаша шағым.",
    explanations: ["Сапасыз тауар сатылған жағдайда тұтынушының құқықтарын, соның ішінде ақшаны қайтару талабын белгілейді.", "Шағымды сатушыға жеке, пошта арқылы немесе көрсетілген электрондық мекенжайға беруге болады; жауап беру мерзімі — 10 күнтізбелік күн."],
  } : {
    title: "You have grounds to request a refund",
    summary: "For a defective product, the law allows you to choose a refund if the defect was not disclosed before purchase.",
    reasoning: "The receipt supports the purchase, while the seller chat shows your request and their refusal. The next documented step is a written claim.",
    explanations: ["Sets out consumer rights for defective goods, including a request for repayment.", "You can deliver a claim in person, by post, or to the seller's stated email address; the response period is 10 calendar days."],
  };
  return {
    ...demoLegalRecommendation,
    title: text.title,
    summary: text.summary,
    reasoning: text.reasoning,
    legalBasis: demoLegalRecommendation.legalBasis.map((basis, index) => ({ ...basis, explanation: text.explanations[index] })),
  };
}

export function getDemoSellerResponse(locale: Locale): SellerResponseAnalysis {
  if (locale === "ru") return demoSellerResponse;
  const text = locale === "kk" ? {
    reason: "Сатушы қаптамасы ашылған құлаққапты қайтаруға болмайды деп есептейді.",
    summary: "Сатушы ашылған қаптамаға сілтеп, ақшаны қайтарудан бас тартты.",
    fact: "Тауардың қаптамасы ашылған",
  } : {
    reason: "The seller says opened headphones cannot be returned.",
    summary: "The seller refused a refund because the packaging had been opened.",
    fact: "The packaging was opened",
  };
  return {
    ...demoSellerResponse,
    sellerReason: text.reason,
    summary: text.summary,
    newFacts: demoSellerResponse.newFacts.map((fact) => ({ ...fact, value: text.fact })),
  };
}
