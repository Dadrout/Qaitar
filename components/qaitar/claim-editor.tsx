"use client";

import { useState } from "react";
import { Check, Clipboard, Download, FilePenLine, LoaderCircle, Send } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { downloadClaimPdf } from "../../lib/pdf.ts";
import { ru } from "../../lib/i18n/ru.ts";

export type ConsumerForm = { name: string; address: string; phone: string; email: string };

export function ClaimEditor({ claim, demo, busy, onGenerate, onChangeClaim, onAddResponse }: {
  claim: string | null;
  demo: boolean;
  busy: boolean;
  onGenerate: (consumer: ConsumerForm) => void;
  onChangeClaim: (value: string) => void;
  onAddResponse: () => void;
}) {
  const [consumer, setConsumer] = useState<ConsumerForm>(demo ? { name: "Алия Сейдахметова", address: "г. Алматы, ул. Абая, 10", phone: "+7 700 000 00 00", email: "aliya@example.kz" } : { name: "", address: "", phone: "", email: "" });
  const [copied, setCopied] = useState(false);

  if (!claim) return (
    <section className="px-4 py-8 sm:px-7 lg:px-12 lg:py-11"><div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><FilePenLine className="size-5" /></span><div><h1 className="text-3xl font-bold tracking-[-.04em]">{ru.claim.title}</h1><p className="mt-1 text-sm text-muted-foreground">{ru.claim.details}</p></div></div>
      <Card className="mt-7 rounded-[24px] py-0 shadow-none"><CardContent className="grid gap-4 p-6 sm:grid-cols-2">
        {([['name', ru.claim.name], ['address', ru.claim.address], ['phone', ru.claim.phone], ['email', ru.claim.email]] as const).map(([key, label]) => <label key={key} className="space-y-2 text-sm font-semibold"><span>{label}</span><Input type={key === "email" ? "email" : "text"} value={consumer[key]} onChange={(event) => setConsumer((value) => ({ ...value, [key]: event.target.value }))} className="h-11 rounded-xl" /></label>)}
      </CardContent></Card>
      <div className="mt-6 flex justify-end"><Button disabled={busy || Object.values(consumer).some((value) => !value.trim())} onClick={() => onGenerate(consumer)} size="lg" className="h-12 w-full rounded-xl sm:w-auto">{busy ? <LoaderCircle className="animate-spin" /> : <FilePenLine />} {ru.claim.generate}</Button></div>
    </div></section>
  );

  async function copyClaim() {
    await navigator.clipboard.writeText(claim!); setCopied(true); window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9"><div className="mx-auto max-w-[940px]">
      <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="size-5" /></span><div><h1 className="text-3xl font-bold tracking-[-.04em]">{ru.claim.ready}</h1><p className="mt-1 text-sm text-muted-foreground">{ru.claim.readyHint}</p></div></div>
      <div aria-label="Действия с претензией" className="mt-7 flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-[0_8px_24px_rgba(20,39,78,.05)] sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 px-2 text-xs font-semibold text-muted-foreground"><FilePenLine className="size-4" /> Редактируйте текст прямо в документе</span>
        <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={copyClaim} variant="outline" className="h-11 rounded-xl">{copied ? <Check /> : <Clipboard />} {copied ? ru.claim.copied : ru.claim.copy}</Button><Button onClick={() => downloadClaimPdf(claim)} className="h-11 rounded-xl"><Download /> {ru.claim.download}</Button></div>
      </div>
      <Card className="mt-4 rounded-[24px] border-border bg-muted/55 py-0 shadow-[0_18px_55px_rgba(20,39,78,.09)]"><CardContent className="p-3 sm:p-7"><div className="mx-auto aspect-[1/1.414] min-h-[620px] max-w-[720px] overflow-hidden rounded-sm bg-white shadow-[0_8px_34px_rgba(20,39,78,.12)]"><Textarea aria-label="Текст претензии" value={claim} onChange={(event) => onChangeClaim(event.target.value)} className="h-full min-h-full resize-none rounded-none border-0 bg-white p-6 font-serif text-[15px] leading-7 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-10" /></div></CardContent></Card>
      <div className="mt-5 flex justify-end"><Button onClick={onAddResponse} variant="secondary" className="h-11 w-full rounded-xl sm:w-auto">{ru.claim.response} <Send /></Button></div>
    </div></section>
  );
}
