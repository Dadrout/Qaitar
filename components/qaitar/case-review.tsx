"use client";

import { useState } from "react";
import { ArrowRight, Bot, Check, FileCheck2, Pencil } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { ru } from "../../lib/i18n/ru.ts";
import type { CaseAnalysis } from "../../types/qaitar.ts";

export function CaseReview({ analysis, onChange, onConfirm }: { analysis: CaseAnalysis; onChange: (key: string, value: string) => void; onConfirm: () => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-[920px]">
        <Badge variant="secondary" className="mb-4 rounded-full px-3 py-1.5"><FileCheck2 /> {ru.review.eyebrow}</Badge>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div><h1 className="text-3xl font-bold tracking-[-.045em] sm:text-4xl">{ru.review.title}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{ru.review.hint}</p></div>
          <Button variant="outline" onClick={() => setEditing((value) => !value)} className="shrink-0 rounded-xl"><Pencil /> {editing ? ru.review.save : ru.review.edit}</Button>
        </div>

        <Card className="mt-7 overflow-hidden rounded-[26px] border-border py-0 shadow-[0_18px_50px_rgba(20,39,78,.07)]">
          <CardContent className="p-0">
            <div className="flex gap-3 border-b border-border bg-primary/[.035] p-5 sm:p-6"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="size-4.5" /></span><div><p className="text-xs font-bold uppercase tracking-[.1em] text-primary">Объяснение Qaitar</p><p className="mt-2 text-base font-medium leading-7">{analysis.summary}</p></div></div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
          {analysis.facts.map((fact) => (
            <div key={fact.key} className="bg-card p-5 sm:p-6">
                <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor={`fact-${fact.key}`} className="text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">{fact.label}</label><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${fact.source === "document" ? "bg-emerald-50 text-emerald-700" : fact.source === "user" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{ru.review.source[fact.source]}</span></div>
                <Input
                  id={`fact-${fact.key}`}
                  type={editing && fact.key === "purchaseDate" ? "date" : "text"}
                  value={editing && fact.key === "purchaseDate" ? analysis.purchaseDate ?? "" : fact.value}
                  readOnly={!editing}
                  onChange={(event) => onChange(fact.key, event.target.value)}
                  className={`h-11 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0 ${editing ? "rounded-none border-b border-primary bg-transparent" : "bg-transparent"}`}
                />
            </div>
          ))}
            </div>
          </CardContent>
        </Card>

        {analysis.missingInformation.length > 0 && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-semibold text-amber-900">Нужно уточнить</p><ul className="mt-2 space-y-1 text-sm text-amber-800">{analysis.missingInformation.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
        <div className="mt-6 flex justify-end"><Button onClick={onConfirm} size="lg" className="h-12 w-full rounded-xl px-7 shadow-[0_10px_24px_rgba(25,94,234,.18)] sm:w-auto"><Check /> {ru.review.confirm} <ArrowRight /></Button></div>
      </div>
    </section>
  );
}
