import corpus from "../data/legal/consumer-rights.ru.json" with { type: "json" };
import type { CaseAnalysis, LegalChunk, LegalRecommendation, OfficialActionPlan, SellerResponseAnalysis } from "../types/qaitar.ts";
import { OfficialActionPlanSchema } from "./ai/schemas.ts";
import type { Locale } from "./i18n/index.ts";
import { hasSellerResponseDeadlineElapsed } from "./seller-response-input.ts";

type Input = {
  caseData: CaseAnalysis;
  responseAnalysis: SellerResponseAnalysis;
  recommendation: LegalRecommendation;
  chunks: LegalChunk[];
  locale: Locale;
  today: Date;
  claimSentAt?: string | null;
  verifiedClaimReceivedAt?: string | null;
};

const lawUrl = "https://adilet.zan.kz/rus/docs/Z100000274_";
const guideUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
const curatedLaw = corpus.find((entry) => entry.sourceUrl === lawUrl && entry.article === "42-4")!;
const curatedGuide = corpus.find((entry) => entry.sourceUrl === guideUrl && entry.article === "Порядок обращения")!;

const copy = {
  ru: {
    title: "Подготовьте официальное обращение",
    manualTitle: "Проверьте порядок официального обращения",
    authority: "Департамент торговли и защиты прав потребителей соответствующего региона",
    authorityReason: "Официальное разъяснение указывает региональный департамент после отказа продавца или отсутствия ответа.",
    manualAuthorityReason: "Компетентный орган не подтверждён найденными официальными источниками.",
    channel: "Подать обращение через eOtinish",
    deadline: "Не позднее двух месяцев с обращения к продавцу",
    deadlineExplanation: "Статья 42-5 отсчитывает срок от обращения с претензией к продавцу; дата претензии в материалах не указана, поэтому календарная дата не рассчитана. Проверьте, не установлен ли иной срок законом.",
    deadlineExplanationWithDate: (date: string) => `Статья 42-5 отсчитывает двухмесячный срок от обращения с претензией к продавцу (${date}). Точная календарная дата не рассчитана; проверьте, не установлен ли иной срок законом.`,
    unknownDeadline: "Уточните срок подачи",
    unknownDeadlineExplanation: "Срок не подтверждён найденными официальными источниками.",
    missingSources: "Подтвердите статьи 42-4 и 42-5 и канал подачи по официальным источникам.",
    missingClaimDate: "Дата направления претензии продавцу для проверки срока подачи",
    missingReceiptDate: "Подтвердите дату получения претензии продавцом для проверки десятидневного срока ответа.",
    waitForResponse: "Отсчитайте десять календарных дней со следующего дня после получения претензии продавцом; продавец может ответить до конца десятого дня. Либо подтвердите письменный отказ.",
    legalReview: "Проверьте правовое основание для официального обращения.",
    missingFacts: "Уточните продавца, товар, дату покупки и проблему для текста обращения.",
    attachments: ["Копия претензии продавцу", "Ответ продавца или подтверждение отсутствия ответа", "Документы, подтверждающие покупку", "Материалы, подтверждающие проблему"],
    steps: ["Проверьте дату направления претензии и двухмесячный срок обращения; при отсутствии ответа проверьте дату получения претензии продавцом.", "Подготовьте копию претензии, ответ продавца и документы по покупке.", "Укажите в обращении свои данные, сведения о продавце, обстоятельства и требование.", "Выберите Департамент торговли и защиты прав потребителей своего региона в eOtinish и подайте обращение с приложениями.", "Сохраните подтверждение подачи и следите за ответом ведомства."],
    refused: "Продавец отказал в удовлетворении письменной претензии",
    silent: "Продавец не ответил на письменную претензию в установленный срок",
    basis42_4: "После отказа продавца или отсутствия ответа по истечении десяти календарных дней, отсчитываемых со следующего дня после получения претензии продавцом, допускается обращение в уполномоченный орган.",
    basis42_5: "Обращение в государственный орган подаётся не позднее двух месяцев с претензии; к нему прилагают ответ продавца или копию претензии и подтверждающие документы.",
    basisGuide: "Разъяснение указывает региональный департамент и eOtinish как канал подачи.",
  },
  kk: {
    title: "Ресми өтініш дайындаңыз", manualTitle: "Ресми өтініш тәртібін тексеріңіз",
    authority: "Тиісті өңірдің сауда және тұтынушылардың құқықтарын қорғау департаменті",
    authorityReason: "Ресми түсіндірме сатушы бас тартқаннан немесе жауап бермегеннен кейін өңірлік департаментті көрсетеді.",
    manualAuthorityReason: "Құзыретті орган табылған ресми дереккөздермен расталмады.", channel: "eOtinish арқылы өтініш беру",
    deadline: "Сатушыға жүгінгеннен кейін екі айдан кешіктірмей",
    deadlineExplanation: "42-5-бап мерзімді сатушыға талап жолдаған күннен есептейді; талап күні белгісіз, сондықтан нақты күн есептелмеді. Заңда өзге мерзім бар-жоғын тексеріңіз.",
    deadlineExplanationWithDate: (date: string) => `42-5-бап екі айлық мерзімді сатушыға талап жолдаған күннен (${date}) есептейді. Нақты күн есептелмеді; заңда өзге мерзім бар-жоғын тексеріңіз.`,
    unknownDeadline: "Өтініш мерзімін нақтылаңыз", unknownDeadlineExplanation: "Мерзім табылған ресми дереккөздермен расталмады.",
    missingSources: "42-4 және 42-5-баптарды және ресми дереккөздерден өтініш арнасын растаңыз.",
    missingClaimDate: "Өтініш мерзімін тексеру үшін сатушыға талап жіберілген күн",
    missingReceiptDate: "Он күндік жауап мерзімін тексеру үшін сатушының талапты алған күнін растаңыз.",
    waitForResponse: "Сатушы талапты алған күннен кейінгі келесі күннен бастап он күнтізбелік күнді есептеңіз; сатушы оныншы күннің соңына дейін жауап бере алады. Немесе жазбаша бас тартуды растаңыз.",
    legalReview: "Ресми өтініштің құқықтық негізін тексеріңіз.",
    missingFacts: "Өтініш мәтіні үшін сатушыны, тауарды, сатып алу күнін және мәселені нақтылаңыз.",
    attachments: ["Сатушыға жолданған талаптың көшірмесі", "Сатушының жауабы немесе жауап болмағанын растайтын құжат", "Сатып алуды растайтын құжаттар", "Мәселені растайтын материалдар"],
    steps: ["Талап жіберілген күнді және екі айлық мерзімді тексеріңіз; жауап болмаса, сатушының талапты алған күнін де тексеріңіз.", "Талап көшірмесін, сатушы жауабын және сатып алу құжаттарын дайындаңыз.", "Өтініште өз деректеріңізді, сатушыны, мән-жайды және талабыңызды көрсетіңіз.", "eOtinish жүйесінде өз өңіріңіздің департаментін таңдап, өтініш пен қосымшаларды жіберіңіз.", "Жіберілгенін растайтын құжатты сақтап, жауапты қадағалаңыз."],
    refused: "Сатушы жазбаша талапты қанағаттандырудан бас тартты", silent: "Сатушы жазбаша талапқа белгіленген мерзімде жауап бермеді",
    basis42_4: "Сатушы бас тартса немесе талапты алғаннан кейінгі келесі күннен есептелетін он күнтізбелік күн аяқталғанша жауап бермесе, уәкілетті органға жүгінуге болады.",
    basis42_5: "Мемлекеттік органға өтініш талаптан кейін екі айдан кешіктірмей беріледі; жауап немесе талап көшірмесі мен растайтын құжаттар қоса беріледі.",
    basisGuide: "Ресми түсіндірме өңірлік департаментті және eOtinish арнасын көрсетеді.",
  },
  en: {
    title: "Prepare an official appeal", manualTitle: "Verify the official appeal procedure",
    authority: "Department of Trade and Consumer Rights Protection for your region",
    authorityReason: "Official guidance names the regional department after a seller refusal or missing response.",
    manualAuthorityReason: "The competent authority is not confirmed by retrieved official sources.", channel: "Submit through eOtinish",
    deadline: "Within two months of contacting the seller",
    deadlineExplanation: "Article 42-5 measures the period from the written claim to the seller. That date is unavailable, so no calendar deadline is calculated. Check whether another law sets a different period.",
    deadlineExplanationWithDate: (date: string) => `Article 42-5 measures the two month period from the written claim to the seller (${date}). No calendar deadline is calculated; check whether another law sets a different period.`,
    unknownDeadline: "Verify the filing period", unknownDeadlineExplanation: "The period is not confirmed by retrieved official sources.",
    missingSources: "Confirm Articles 42-4 and 42-5 and a submission channel from official sources.",
    missingClaimDate: "Date the written claim was sent to the seller to check the filing period",
    missingReceiptDate: "Confirm the date the seller received the claim to check the ten-day response period.",
    waitForResponse: "Count ten calendar days starting the day after the seller received the claim; the seller may reply through the end of day ten. Alternatively, confirm a written refusal.",
    legalReview: "Verify the legal basis for an official appeal.",
    missingFacts: "Confirm the seller, product, purchase date, and problem for the appeal text.",
    attachments: ["Copy of the written claim to the seller", "Seller response or evidence of no response", "Purchase documents", "Evidence of the problem"],
    steps: ["Check the claim-sent date and the two month filing period; if there was no reply, also check the seller's receipt date.", "Prepare the claim, seller response, and purchase documents.", "Include your details, seller details, circumstances, and request.", "Select your regional Department of Trade and Consumer Rights Protection in eOtinish and submit the appeal with attachments.", "Keep the submission confirmation and monitor the agency response."],
    refused: "The seller refused the written claim", silent: "The seller did not respond to the written claim within the allowed period",
    basis42_4: "A seller refusal or no answer by the end of ten calendar days counted from the day after seller receipt permits an appeal to the competent authority.",
    basis42_5: "The appeal to a state body is due within two months of the seller claim, with the response or claim copy and supporting documents.",
    basisGuide: "Official guidance identifies the regional department and eOtinish channel.",
  },
} as const;

function isCuratedChunk(chunk: LegalChunk) {
  return corpus.some((entry) => entry.sourceUrl === chunk.sourceUrl && entry.article === chunk.article && entry.language === chunk.language);
}

function composeAppeal(caseData: CaseAnalysis, responseAnalysis: SellerResponseAnalysis, locale: Locale, attachments: readonly string[]) {
  const seller = caseData.seller.name!;
  const product = caseData.product.name!;
  const date = caseData.purchaseDate!;
  const issue = caseData.issue!;
  const amount = caseData.product.price === null ? "" : `, ${caseData.product.price.toLocaleString(locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-US")} ${caseData.product.currency}`;
  if (locale === "kk") return `Тиісті өңірдің сауда және тұтынушылардың құқықтарын қорғау департаментіне\n\n${date} күні ${seller} сатушысынан ${product} сатып алдым${amount}. Мәселе: ${issue}. Сатушыға жазбаша талап жолдадым. ${responseAnalysis.responseType === "rejected" ? copy.kk.refused : copy.kk.silent}.\n\nҚұқықтарымның бұзылуын қарауды, сатушының әрекеттеріне құқықтық баға беруді және қарау нәтижесі туралы хабарлауды сұраймын.\n\nҚосымшалар: ${attachments.join("; ")}.`;
  if (locale === "en") return `To the Department of Trade and Consumer Rights Protection for my region\n\nOn ${date}, I purchased ${product} from ${seller}${amount}. The problem is: ${issue}. I sent a written claim to the seller. ${responseAnalysis.responseType === "rejected" ? copy.en.refused : copy.en.silent}.\n\nI request a review of the violation of my consumer rights, an assessment of the seller's actions, and a response on the outcome.\n\nAttachments: ${attachments.join("; ")}.`;
  return `В Департамент торговли и защиты прав потребителей соответствующего региона\n\n${date} я приобрёл(а) у ${seller} товар «${product}»${amount}. Проблема: ${issue}. Я направил(а) продавцу письменную претензию. ${responseAnalysis.responseType === "rejected" ? copy.ru.refused : copy.ru.silent}.\n\nПрошу рассмотреть нарушение моих прав потребителя, дать оценку действиям продавца и сообщить о результатах рассмотрения.\n\nПриложения: ${attachments.join("; ")}.`;
}

function validCalendarDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function buildOfficialActionPlan({ caseData, responseAnalysis, recommendation, chunks, locale, today, claimSentAt = null, verifiedClaimReceivedAt = null }: Input): OfficialActionPlan {
  const t = copy[locale];
  const sentDate = validCalendarDate(claimSentAt);
  const receivedDate = validCalendarDate(verifiedClaimReceivedAt);
  const recommendedUrls = new Set(recommendation.legalBasis.map((basis) => basis.sourceUrl));
  const sourced = chunks.filter((chunk) => recommendedUrls.has(chunk.sourceUrl) && isCuratedChunk(chunk));
  const article42_4 = sourced.find((chunk) => chunk.sourceUrl === lawUrl && chunk.article === "42-4" && /откаж|отказ|не ответ|отсутств.*ответ/i.test(chunk.text));
  const article42_5 = sourced.find((chunk) => chunk.sourceUrl === lawUrl && chunk.article === "42-5" && /двух месяцев/i.test(chunk.text) && /претензи/i.test(chunk.text));
  const guide = sourced.find((chunk) => chunk.sourceUrl === guideUrl && /e.?otinish/i.test(chunk.text) && /Департамент торговли и защиты прав потребителей/i.test(chunk.text));
  const legalBasis: OfficialActionPlan["legalBasis"] = [];
  if (article42_4) legalBasis.push({ lawName: curatedLaw.lawName, article: "42-4", explanation: t.basis42_4, sourceUrl: lawUrl });
  if (article42_5) legalBasis.push({ lawName: curatedLaw.lawName, article: "42-5", explanation: t.basis42_5, sourceUrl: lawUrl });
  if (guide) legalBasis.push({ lawName: curatedGuide.lawName, article: curatedGuide.article, explanation: t.basisGuide, sourceUrl: guideUrl });
  const hasCaseFacts = Boolean(caseData.seller.name && caseData.product.name && caseData.purchaseDate && caseData.issue);
  const validToday = Number.isFinite(today.getTime());
  const sourcesComplete = Boolean(article42_4 && article42_5 && guide);
  const legalReviewReady = recommendation.status === "legal_basis_found" && recommendation.recommendedAction === "prepare_official_appeal";
  const noResponseElapsed = responseAnalysis.responseType !== "no_response" ||
    (receivedDate !== null && hasSellerResponseDeadlineElapsed(receivedDate, today));
  const ready = validToday && hasCaseFacts && responseAnalysis.requiresLegalReview &&
    (responseAnalysis.responseType === "rejected" || responseAnalysis.responseType === "no_response") &&
    legalReviewReady && sourcesComplete && noResponseElapsed;
  const missingInformation = [
    ...(!sourcesComplete ? [t.missingSources] : []),
    ...(!hasCaseFacts ? [t.missingFacts] : []),
    ...(!legalReviewReady ? [t.legalReview] : []),
    ...(!sentDate ? [t.missingClaimDate] : []),
    ...(responseAnalysis.responseType === "no_response" && !receivedDate ? [t.missingReceiptDate] : []),
    ...(responseAnalysis.responseType === "no_response" && receivedDate && !noResponseElapsed ? [t.waitForResponse] : []),
  ];
  const plan: OfficialActionPlan = {
    status: ready ? "ready" : "manual_verification_required",
    title: ready ? t.title : t.manualTitle,
    authority: guide ? { name: t.authority, reason: t.authorityReason, sourceUrl: guideUrl } : { name: null, reason: t.manualAuthorityReason, sourceUrl: null },
    channels: ready ? [{ type: "eotinish", label: t.channel, url: "https://eotinish.kz", sourceUrl: guideUrl }] : [],
    deadline: article42_5 ? { label: t.deadline, date: null, explanation: sentDate ? t.deadlineExplanationWithDate(sentDate) : t.deadlineExplanation, sourceUrl: lawUrl } : { label: t.unknownDeadline, date: null, explanation: t.unknownDeadlineExplanation, sourceUrl: null },
    steps: ready ? [...t.steps] : [],
    requiredAttachments: ready ? [...t.attachments] : [],
    legalBasis,
    appealText: ready ? composeAppeal(caseData, responseAnalysis, locale, t.attachments) : null,
    missingInformation,
    confidence: ready ? recommendation.confidence : "low",
  };
  return OfficialActionPlanSchema.parse(plan);
}
