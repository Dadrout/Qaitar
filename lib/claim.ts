import type { Locale } from "./i18n/index.ts";

type ClaimInput = {
  consumer: { name: string; address: string; phone: string; email: string };
  seller: string;
  product: string;
  amount: number;
  currency: string;
  purchaseDate: string;
  issue: string;
  remedy: string;
  legalBasis: Array<{ lawName: string; article: string; sourceUrl: string }>;
};

const currencySymbols: Record<string, string> = { KZT: "₸", USD: "$", EUR: "€" };

function formatAmount(amount: number, currency: string, locale: Locale) {
  const formatted = new Intl.NumberFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale]).format(amount).replaceAll("\u00a0", " ");
  return `${formatted} ${currencySymbols[currency] ?? currency}`;
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale], { day: "numeric", month: "long", year: "numeric" })
    .format(new Date(`${value}T00:00:00Z`));
}

function lawNameInGenitive(lawName: string) {
  return lawName
    .replace(/^Закон Республики/, "Закона Республики")
    .replace(/^Кодекс Республики/, "Кодекса Республики")
    .replace(/^Гражданский кодекс/, "Гражданского кодекса");
}

export function composeClaim(input: ClaimInput, locale: Locale = "ru") {
  const basis = input.legalBasis
    .filter((item) => /^\d+(?:-\d+)?(?:\s*,\s*\d+(?:-\d+)?)*$/.test(item.article))
    .map((item) => locale === "kk" ? `${item.lawName} ${item.article}-бабына` : locale === "en" ? `Article ${item.article} of ${item.lawName}` : `${item.article.includes(",") ? "статей" : "статьи"} ${item.article} ${lawNameInGenitive(item.lawName)}`)
    .join(locale === "ru" ? ", а также " : "; ");

  if (!basis) {
    throw new Error("Для претензии не найдено проверенное положение закона");
  }

  if (locale === "kk") return `Кімге: ${input.seller}
Кімнен: ${input.consumer.name}
Мекенжайы: ${input.consumer.address}
Телефон: ${input.consumer.phone}
E-mail: ${input.consumer.email}

ШАҒЫМ
сапасыз тауар үшін төленген ақшаны қайтару туралы

${formatDate(input.purchaseDate, locale)} күні мен ${input.product} тауарын ${formatAmount(input.amount, input.currency, locale)} бағасына сатып алдым. Пайдалану кезінде мынадай кемшілік анықталды: ${input.issue}.

${basis} сәйкес тауар үшін төленген соманы толық қайтаруды сұраймын. Заңда белгіленген мерзімде жазбаша жауап беруіңізді сұраймын.

Қосымшалар:
1. Төлемді растайтын құжаттың көшірмесі.
2. Кемшілікті және сатушыға жүгінуді растайтын материалдар.

Күні: ____________        Қолы: ____________`;

  if (locale === "en") return `To: ${input.seller}
From: ${input.consumer.name}
Address: ${input.consumer.address}
Phone: ${input.consumer.phone}
E-mail: ${input.consumer.email}

FORMAL CLAIM
for a refund for defective goods

On ${formatDate(input.purchaseDate, locale)}, I purchased ${input.product} for ${formatAmount(input.amount, input.currency, locale)}. I found the following defect during use: ${input.issue}.

Based on ${basis}, I request a full refund of the amount paid for the product. Please provide a written response within the period prescribed by law.

Attachments:
1. A copy of the payment document.
2. Materials supporting the defect and my contact with the seller.

Date: ____________        Signature: ____________`;

  return `Кому: ${input.seller}
От: ${input.consumer.name}
Адрес: ${input.consumer.address}
Телефон: ${input.consumer.phone}
E-mail: ${input.consumer.email}

ПРЕТЕНЗИЯ
о возврате денежных средств за товар ненадлежащего качества

${formatDate(input.purchaseDate, locale)} мной был приобретён товар — ${input.product} стоимостью ${formatAmount(input.amount, input.currency, locale)}. В процессе использования выявлен недостаток: ${input.issue}.

На основании ${basis} прошу ${input.remedy}. Прошу предоставить письменный ответ в установленный законом срок.

Приложения:
1. Копия документа, подтверждающего оплату.
2. Материалы, подтверждающие недостаток и обращение к продавцу.

Дата: ____________        Подпись: ____________`;
}
