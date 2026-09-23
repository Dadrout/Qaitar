"use client";

import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, CircleHelp, FileUp, Scale, UploadCloud, XCircle } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { ru } from "../../lib/i18n/ru.ts";
import { getSellerResponsePresentation } from "../../lib/seller-response-presentation.ts";
import type { LegalRecommendation, SellerResponseAnalysis } from "../../types/qaitar.ts";

export function SellerResponse({ result, recommendation, onAnalyze, onDemo }: { result: SellerResponseAnalysis | null; recommendation: LegalRecommendation | null; onAnalyze: (file: File) => void; onDemo: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  if (!result) return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9"><div className="mx-auto max-w-3xl">
      <Badge variant="secondary" className="mb-4 rounded-full"><FileUp /> Новый этап дела</Badge><h1 className="text-3xl font-bold tracking-[-.04em]">{ru.seller.title}</h1><p className="mt-2 text-muted-foreground">{ru.seller.add}</p>
      <Card className="mt-7 rounded-[24px] border-dashed border-primary/25 bg-[linear-gradient(180deg,rgba(237,243,255,.65),rgba(255,255,255,.4))] py-0 shadow-[0_14px_38px_rgba(20,39,78,.06)]"><CardContent className="flex min-h-[280px] flex-col items-center justify-center p-7 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(25,94,234,.2)]"><UploadCloud className="size-6" /></span>{file ? <><p className="mt-4 font-semibold">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">Ответ готов к разбору</p></> : <><p className="mt-4 font-semibold">Добавьте ответ продавца</p><p className="mt-1 text-sm text-muted-foreground">PDF, JPG, PNG или WEBP</p></>}<div className="mt-5 flex w-full max-w-sm flex-col justify-center gap-2 sm:flex-row"><Button onClick={() => input.current?.click()} variant="outline" className="h-11 flex-1 rounded-xl bg-white"><UploadCloud /> Выбрать файл</Button><Button onClick={onDemo} variant="ghost" className="h-11 flex-1 rounded-xl text-primary">{ru.seller.demo}</Button></div><input ref={input} type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></CardContent></Card>
      <div className="mt-6 flex justify-end"><Button disabled={!file} onClick={() => file && onAnalyze(file)} size="lg" className="h-12 w-full rounded-xl sm:w-auto">{ru.seller.analyze} <ArrowRight /></Button></div>
    </div></section>
  );

  const presentation = getSellerResponsePresentation(result.responseType);
  const badgeTone = {
    success: "bg-emerald-100 text-emerald-800",
    danger: "bg-rose-100 text-rose-800",
    notice: "bg-amber-100 text-amber-900",
  }[presentation.tone];
  const StatusIcon = presentation.tone === "success" ? CheckCircle2 : presentation.tone === "danger" ? XCircle : CircleHelp;
  return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9"><div className="mx-auto max-w-[920px]">
      <Badge className={`mb-4 rounded-full ${badgeTone}`}><StatusIcon /> {presentation.label}</Badge><h1 className="text-3xl font-bold tracking-[-.04em]">Ответ продавца получен</h1><p className="mt-2 text-sm text-muted-foreground">Qaitar отделил позицию продавца от правовой оценки и проверил, что делать дальше.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2"><Card className="rounded-[22px] py-0 shadow-[0_10px_30px_rgba(20,39,78,.05)]"><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">Позиция продавца</p><p className="mt-3 text-lg font-semibold leading-7">{result.sellerReason ?? "Причина не указана"}</p><p className="mt-4 text-sm leading-6 text-muted-foreground">{result.summary}</p></CardContent></Card><Card className="rounded-[22px] border-primary/20 bg-primary/[.045] py-0 shadow-none"><CardContent className="p-6"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.1em] text-primary"><Scale className="size-4" /> {ru.seller.meaning}</div><p className="mt-3 text-base font-semibold leading-7">{recommendation?.summary ?? presentation.meaningFallback}</p></CardContent></Card></div>
      {recommendation && <Card className="mt-5 rounded-[24px] border-primary bg-primary text-primary-foreground py-0 shadow-[0_18px_42px_rgba(25,94,234,.22)]"><CardContent className="p-6 sm:p-7"><p className="text-xs font-bold uppercase tracking-[.1em] text-primary-foreground/70">{ru.seller.next}</p><h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-[-.03em]">{presentation.nextTitle}</h2><p className="mt-3 max-w-2xl text-sm font-medium leading-6">{recommendation.title}</p><p className="mt-2 max-w-2xl text-sm leading-6 text-primary-foreground/80">{recommendation.reasoning}</p></CardContent></Card>}
    </div></section>
  );
}
