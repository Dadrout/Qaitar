export type CaseCategory =
  | "warranty_refusal"
  | "delivery_delay"
  | "defective_goods";

export type CaseAnalysis = {
  category: CaseCategory;
  title: string;
  summary: string;
  confidence: number;
  nextAction: {
    id: "send_claim";
    title: string;
    detail: string;
    deadline: string;
  };
  facts: Array<{ label: string; value: string; verified: boolean }>;
  sources: Array<{
    law: string;
    article: string;
    title: string;
    relevance: string;
  }>;
};

type AnalyzeInput = {
  description?: string;
  fileNames?: string[];
};

type ClaimFacts = {
  consumerName: string;
  seller: string;
  product: string;
  purchaseDate: string;
  amount: string;
  issue: string;
};

const sharedSources = [
  {
    law: "Закон РК «О защите прав потребителей»",
    article: "Статья 15",
    title: "Права потребителя при продаже товара ненадлежащего качества",
    relevance: "Позволяет требовать возврат денег, замену или устранение недостатков.",
  },
  {
    law: "Закон РК «О защите прав потребителей»",
    article: "Статья 42-4",
    title: "Досудебный порядок урегулирования спора",
    relevance: "Закрепляет порядок направления письменной претензии продавцу.",
  },
] satisfies CaseAnalysis["sources"];

export function analyzeConsumerCase(input: AnalyzeInput): CaseAnalysis {
  const evidence = `${input.description ?? ""} ${(input.fileNames ?? []).join(" ")}`.toLowerCase();
  const isWarranty = /гарант|warranty|ремонт/.test(evidence);
  const isDelivery = /достав|курьер|delivery|не привез/.test(evidence);

  if (isWarranty) {
    return {
      category: "warranty_refusal",
      title: "Отказ в гарантийном обслуживании",
      summary:
        "По документам продавец отказался принять товар на гарантийное обслуживание без подтверждённого основания. Сначала зафиксируйте требование письменно.",
      confidence: 0.94,
      nextAction: {
        id: "send_claim",
        title: "Направьте продавцу письменную претензию",
        detail: "Потребуйте принять товар на проверку качества и вернуть деньги либо устранить недостаток.",
        deadline: "Ответ — в течение 10 календарных дней",
      },
      facts: demoFacts(),
      sources: [
        sharedSources[0],
        {
          law: "Закон РК «О защите прав потребителей»",
          article: "Статья 30",
          title: "Сроки устранения недостатков товара",
          relevance: "Определяет обязанности продавца в течение гарантийного срока.",
        },
        sharedSources[1],
      ],
    };
  }

  if (isDelivery) {
    return {
      category: "delivery_delay",
      title: "Нарушение срока передачи товара",
      summary:
        "Продавец не передал оплаченный товар в согласованный срок. Вы можете потребовать новую дату исполнения либо возврат уплаченной суммы.",
      confidence: 0.9,
      nextAction: {
        id: "send_claim",
        title: "Зафиксируйте требование о возврате",
        detail: "Укажите дату заказа, обещанный срок доставки и реквизиты оплаты.",
        deadline: "Отправьте претензию сегодня",
      },
      facts: demoFacts(),
      sources: sharedSources,
    };
  }

  return {
    category: "defective_goods",
    title: "Товар ненадлежащего качества",
    summary:
      "Из материалов следует, что товар имеет недостаток, возникший вскоре после покупки. Вы вправе выбрать возврат денег, замену или ремонт.",
    confidence: 0.92,
    nextAction: {
      id: "send_claim",
      title: "Требуйте возврат полной стоимости",
      detail: "Приложите чек и фото недостатка. Передавайте товар только по акту приёма.",
      deadline: "Ответ — в течение 10 календарных дней",
    },
    facts: demoFacts(),
    sources: sharedSources,
  };
}

function demoFacts() {
  return [
    { label: "Продавец", value: "ТОО «TechnoDom»", verified: true },
    { label: "Товар", value: "Samsung Galaxy S24, 256 GB", verified: true },
    { label: "Дата покупки", value: "12 сентября 2026", verified: true },
    { label: "Стоимость", value: "429 990 ₸", verified: true },
    { label: "Гарантия", value: "12 месяцев", verified: true },
    { label: "Проблема", value: "Самопроизвольно выключается", verified: false },
  ];
}

export function buildClaimText(facts: ClaimFacts) {
  return `Кому: ${facts.seller}\nОт: ${facts.consumerName}\n\nПРЕТЕНЗИЯ\nо возврате денежных средств за товар ненадлежащего качества\n\n${facts.purchaseDate} мной был приобретён товар — ${facts.product} стоимостью ${facts.amount}. В процессе использования выявлен недостаток: ${facts.issue}.\n\nНа основании статьи 15 Закона Республики Казахстан «О защите прав потребителей» требую вернуть уплаченную за товар сумму в полном объёме. Прошу предоставить письменный ответ и удовлетворить требование в течение 10 календарных дней с момента получения настоящей претензии.\n\nПриложения:\n1. Копия чека об оплате.\n2. Фото и иные материалы, подтверждающие недостаток.\n3. Копия гарантийного документа.\n\nДата: ____________    Подпись: ____________`;
}
