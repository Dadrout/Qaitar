import { getMessages, type Locale } from "./i18n/index.ts";

export type ClientRequestPhase = "analysis" | "legal" | "claim" | "seller";

export class ClientRequestError extends Error {
  readonly status: number;
  readonly serverMessage: string | undefined;

  constructor(status: number, serverMessage: string | undefined) {
    super("Request failed");
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

export function getClientErrorMessage(phase: ClientRequestPhase, locale: Locale, reason: unknown): string {
  const messages = getMessages(locale);
  const errors = messages.common.requestErrors;
  if (reason instanceof ClientRequestError) {
    if (phase === "seller") {
      const serverMessage = reason.serverMessage;
      if (serverMessage === "Срок ответа продавца ещё не истёк") return messages.seller.validation.deadline;
      if (serverMessage?.startsWith("Дата получения претензии не может предшествовать")) return messages.seller.validation.chronology;
      if (serverMessage === "Добавьте ответ продавца") return messages.seller.validation.fileRequired;
      if (serverMessage === "Этот формат не поддерживается") return messages.seller.validation.fileFormat;
      if (serverMessage === "Файл больше 10 МБ") return messages.seller.validation.fileSize;
      if (serverMessage === "Файл пуст") return messages.seller.validation.fileEmpty;
      if (reason.status === 413) return messages.seller.validation.fileSize;
      if (reason.status === 415) return messages.seller.validation.fileFormat;
      if (reason.status === 400) return errors.invalidResponse;
    }
    if (reason.status >= 500) return errors.serviceUnavailable;
  }
  if (reason instanceof DOMException && reason.name === "AbortError") return errors.timeout;
  if (reason instanceof TypeError) return errors.network;
  return errors[phase];
}
