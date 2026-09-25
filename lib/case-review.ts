import type { CaseAnalysis } from "../types/qaitar.ts";
import { getMessages, type Locale } from "./i18n/index.ts";

export function applyReviewIssueEdit(
  analysis: CaseAnalysis,
  description: string,
  locale: Locale,
  demo: boolean,
) {
  const categoryLabel = getMessages(locale).newCase.problems.find(([id]) => id === analysis.caseType)?.[1];
  return {
    problemDescription: description,
    analysis: {
      ...analysis,
      issue: description || null,
      summary: demo ? description || categoryLabel || analysis.summary : analysis.summary,
      facts: analysis.facts.map((fact) => fact.key === "issue"
        ? { ...fact, value: description, source: "user" as const }
        : fact),
    },
  };
}
