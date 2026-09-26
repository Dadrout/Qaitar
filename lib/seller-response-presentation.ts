import type { SellerResponseAnalysis } from "../types/qaitar.ts";
import { getMessages, type Locale } from "./i18n/index.ts";

export function getSellerResponsePresentation(type: SellerResponseAnalysis["responseType"], locale: Locale = "ru") {
  const copy = getMessages(locale).seller;
  switch (type) {
    case "accepted":
      return { label: copy.status.accepted, tone: "success", nextTitle: copy.nextTitle.accepted, meaningFallback: copy.meaningFallback.accepted } as const;
    case "rejected":
      return { label: copy.status.rejected, tone: "danger", nextTitle: copy.nextTitle.rejected, meaningFallback: copy.meaningFallback.rejected } as const;
    case "additional_information_requested":
      return { label: copy.status.additional_information_requested, tone: "notice", nextTitle: copy.nextTitle.additional_information_requested, meaningFallback: copy.meaningFallback.additional_information_requested } as const;
    case "unclear":
      return { label: copy.status.unclear, tone: "notice", nextTitle: copy.nextTitle.unclear, meaningFallback: copy.meaningFallback.unclear } as const;
    case "no_response":
      return { label: copy.status.no_response, tone: "notice", nextTitle: copy.nextTitle.no_response, meaningFallback: copy.meaningFallback.no_response } as const;
  }
}
