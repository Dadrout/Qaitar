import { Check, Circle } from "lucide-react";

import { getTimelineSteps } from "../../lib/client-case.ts";
import { ru } from "../../lib/i18n/ru.ts";

export function CaseTimeline({ state, compact = false }: { state: string; compact?: boolean }) {
  const steps = getTimelineSteps(state);

  if (compact) {
    const current = steps.findIndex((step) => step.status === "current");
    const active = current === -1 ? steps.length - 1 : current;
    return (
      <div className="border-b border-border/80 bg-card px-4 py-3 lg:hidden">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center justify-between gap-4 text-xs">
            <span className="min-w-0 truncate font-semibold text-foreground">Сейчас: {steps[active].label}</span>
            <span className="shrink-0 font-medium text-muted-foreground">Шаг {active + 1} из {steps.length}</span>
          </div>
          <div className="flex gap-1.5" aria-label={`Прогресс дела: шаг ${active + 1} из ${steps.length}`}>{steps.map((step, index) => <span key={step.label} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${index < active ? "bg-primary/55" : index === active ? "bg-primary" : "bg-muted"}`} />)}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 px-2 text-[11px] font-bold uppercase tracking-[.14em] text-muted-foreground">{ru.timeline.title}</p>
      <ol className="space-y-1">
        {steps.map((step, index) => (
          <li key={step.label} aria-current={step.status === "current" ? "step" : undefined} className={`relative flex min-h-11 items-center gap-3 rounded-xl px-2 transition-colors duration-200 ${step.status === "current" ? "bg-primary/[.055]" : ""}`}>
            {index < steps.length - 1 && <span className={`absolute left-[21px] top-8 h-7 w-px ${step.status === "complete" ? "bg-primary/45" : "bg-border"}`} />}
            <span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${step.status === "complete" ? "border-primary bg-primary text-primary-foreground" : step.status === "current" ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(25,94,234,.10)]" : "border-border bg-card text-muted-foreground"}`}>
              {step.status === "complete" ? <Check className="size-3.5" /> : <Circle className={`size-2.5 ${step.status === "current" ? "fill-current" : ""}`} />}
            </span>
            <span className={`text-sm ${step.status === "current" ? "font-semibold text-foreground" : step.status === "complete" ? "font-medium text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
