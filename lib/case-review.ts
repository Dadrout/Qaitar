import type { CaseAnalysis } from "../types/qaitar.ts";
import { getMessages, type Locale } from "./i18n/index.ts";

export function applyReviewIssueEdit(
  analysis: CaseAnalysis,
  description: string,
  locale: Locale,
  demo: boolean,
) {
  const categoryLabel = getMessages(locale).newCase.problems.find(([id]) => id === analysis.caseType)?.[1];
  const issue = description.trim() ? description : categoryLabel || analysis.issue || analysis.summary;
  return {
    problemDescription: description,
    analysis: {
      ...analysis,
      issue,
      summary: demo ? issue : analysis.summary,
      facts: analysis.facts.map((fact) => fact.key === "issue"
        ? { ...fact, value: issue, source: "user" as const }
        : fact),
    },
  };
}
