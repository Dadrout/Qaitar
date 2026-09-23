import type { SellerResponseAnalysis } from "../types/qaitar.ts";

export function getSellerResponsePresentation(type: SellerResponseAnalysis["responseType"]) {
  switch (type) {
    case "accepted":
      return { label: "Требование принято", tone: "success", nextTitle: "Продавец согласился с требованием. Проверьте исполнение.", meaningFallback: "Продавец согласился с требованием. Сохраните ответ и проверьте, что договорённость выполнена." } as const;
    case "rejected":
      return { label: "Продавец отказал", tone: "danger", nextTitle: "Qaitar проверил отказ и нашёл следующий официальный шаг.", meaningFallback: "Ответ сохранён. Qaitar пока не нашёл надёжного правового основания для следующего шага — проверьте ситуацию вручную." } as const;
    case "additional_information_requested":
      return { label: "Запрошены документы", tone: "notice", nextTitle: "Проверьте, какие сведения нужны продавцу.", meaningFallback: "Проверьте запрос продавца и подготовьте только относящиеся к делу документы." } as const;
    case "unclear":
      return { label: "Ответ неоднозначен", tone: "notice", nextTitle: "Уточните позицию продавца перед следующим шагом.", meaningFallback: "Из ответа пока нельзя понять решение продавца. Попросите письменное уточнение." } as const;
  }
}
