import { CASE_STATES, type CaseState, type QaitarCase } from "../types/qaitar.ts";
import { restoreCaseCollection } from "./case-history.ts";

const timeline = [
  { label: "Документы добавлены", completeAt: "FILES_UPLOADED" as CaseState },
  { label: "Ситуация определена", completeAt: "DOCUMENTS_ANALYZED" as CaseState },
  { label: "Закон проверен", completeAt: "LEGAL_BASIS_FOUND" as CaseState },
  { label: "Претензия подготовлена", completeAt: "CLAIM_GENERATED" as CaseState },
  { label: "Ожидается ответ продавца", completeAt: "SELLER_RESPONSE_UPLOADED" as CaseState },
  { label: "Следующий официальный шаг", completeAt: "ESCALATION_READY" as CaseState },
];

const stateIndex = new Map(CASE_STATES.map((state, index) => [state, index]));

export function getTimelineSteps(state: string) {
  const current = stateIndex.get(state as CaseState) ?? 0;
  const firstIncomplete = timeline.findIndex((step) => current < (stateIndex.get(step.completeAt) ?? Infinity));
  return timeline.map((step, index) => ({
    label: step.label,
    status: current >= (stateIndex.get(step.completeAt) ?? Infinity)
      ? "complete" as const
      : index === firstIncomplete
        ? "current" as const
        : "upcoming" as const,
  }));
}

export function restoreCaseSnapshot(value: string): QaitarCase | null {
  return restoreCaseCollection("", value).cases[0] ?? null;
}

export function serializeCaseSnapshot(value: QaitarCase) {
  return JSON.stringify({
    ...value,
    evidence: value.evidence.map(removePreviewUrl),
  });
}

function removePreviewUrl(item: QaitarCase["evidence"][number]) {
  const copy = { ...item };
  delete copy.previewUrl;
  return copy;
}
