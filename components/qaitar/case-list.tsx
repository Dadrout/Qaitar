"use client";

import { ArrowRight, Clock3, FileText, Plus, Trash2 } from "lucide-react";

import { getTimelineSteps } from "../../lib/client-case.ts";
import type { QaitarCase } from "../../types/qaitar.ts";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useLanguage } from "./language-provider";

export function CaseList({ cases, onContinue, onDelete, onNew }: {
  cases: QaitarCase[];
  onContinue: (caseId: string) => void;
  onDelete: (caseId: string) => void;
  onNew: () => void;
}) {
  const { locale, messages } = useLanguage();
  const dateFormatter = new Intl.DateTimeFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale], {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return <section className="px-4 py-8 sm:px-7 lg:px-12 lg:py-11"><div className="mx-auto max-w-4xl">
    <div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold tracking-[-.04em]">{messages.cases.title}</h1><Button onClick={onNew} className="rounded-xl"><Plus /> {messages.cases.start}</Button></div>
    {cases.length ? <ul className="mt-7 space-y-4">{[...cases].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map((item) => {
      const steps = getTimelineSteps(item.state);
      const currentIndex = steps.findIndex((step) => step.status === "current");
      const stageIndex = currentIndex < 0 ? steps.length - 1 : currentIndex;
      const stage = item.state === "NEW_CASE" ? messages.cases.draft : messages.timeline.steps[stageIndex];
      return <li key={item.id}><Card className="rounded-[24px] py-0 shadow-none"><CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText /></span>
        <div className="min-w-0 flex-1"><p className="font-semibold">{item.analysis?.product.name || messages.cases.newRequest}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.problemDescription || item.analysis?.summary || messages.cases.documentsAdded}</p><p className="mt-2 text-xs font-medium text-primary">{stage}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> {messages.cases.updated} {dateFormatter.format(new Date(item.updatedAt))}</p></div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => onContinue(item.id)} variant="outline" className="rounded-xl">{messages.cases.continue} <ArrowRight /></Button><Button onClick={() => onDelete(item.id)} variant="ghost" className="rounded-xl text-destructive hover:text-destructive"><Trash2 /> {messages.cases.delete}</Button></div>
      </CardContent></Card></li>;
    })}</ul> : <Card className="mt-7 rounded-[24px] py-0 shadow-none"><CardContent className="p-12 text-center text-muted-foreground">{messages.cases.empty}</CardContent></Card>}
  </div></section>;
}
