"use client";

import { useRef, useState } from "react";
import { ArrowRight, Camera, Check, FileCheck2, FileText, Image as ImageIcon, MessageSquareText, ReceiptText, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Textarea } from "../ui/textarea";
import { useLanguage } from "./language-provider";
import { ru } from "../../lib/i18n/ru.ts";
import { selectUploadBatch, validateProblemInput } from "../../lib/workflow.ts";
import type { CaseAnalysis, EvidenceItem } from "../../types/qaitar.ts";

type ProblemType = CaseAnalysis["caseType"];

const problemIcons = [Sparkles, ReceiptText, MessageSquareText, ImageIcon, FileText];

export function NewCase({
  files,
  evidence,
  problemType,
  problemDescription,
  error,
  onFiles,
  onRemove,
  onProblem,
  onProblemDescription,
  onAnalyze,
  onDemo,
}: {
  files: File[];
  evidence: EvidenceItem[];
  problemType: ProblemType | null;
  problemDescription: string;
  error: string | null;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onProblem: (type: ProblemType) => void;
  onProblemDescription: (description: string) => void;
  onAnalyze: () => void;
  onDemo: () => void;
}) {
  const { messages } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const validation = validateProblemInput(problemType, problemDescription);
  const validationMessage = problemType === "other" ? messages.newCase.descriptionRequired : messages.newCase.chooseProblem;

  function acceptFiles(incoming: File[]) {
    const selection = selectUploadBatch(files, incoming);
    setUploadError(selection.error);
    onFiles(selection.files);
  }

  return (
    <section className="relative overflow-hidden px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-9">
      <div className="pointer-events-none absolute -right-32 -top-40 size-[440px] rounded-full bg-primary/[.04] blur-3xl" />
      <div className="relative mx-auto max-w-[980px]">
        <div className="mb-6 sm:mb-7">
          <Badge variant="secondary" className="mb-3 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.12em]"><Sparkles className="size-3.5" /> {ru.newCase.eyebrow}</Badge>
          <h1 className="max-w-3xl text-[clamp(2.25rem,5vw,3.35rem)] font-bold leading-[1.02] tracking-[-.055em]">{ru.newCase.title}</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-muted-foreground sm:text-base sm:leading-7">{ru.newCase.subtitle}</p>
        </div>

        <Card className={`gap-0 overflow-hidden rounded-[26px] border bg-card p-2.5 shadow-[0_22px_60px_rgba(20,39,78,.10)] transition-all duration-200 ${dragging ? "border-primary bg-primary/[.025] ring-4 ring-primary/10" : "border-border hover:border-primary/35"}`}>
          <div
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(Array.from(event.dataTransfer.files)); }}
            className={`flex min-h-[300px] flex-col items-center justify-center rounded-[20px] border border-dashed px-5 py-9 text-center transition-colors duration-200 sm:px-8 ${dragging ? "border-primary bg-primary/[.06]" : "border-border bg-[linear-gradient(180deg,rgba(237,243,255,.7),rgba(255,255,255,.35))]"}`}
          >
            <span className="mb-5 grid size-16 place-items-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_14px_32px_rgba(25,94,234,.24)]"><UploadCloud className="size-7" /></span>
            <h2 className="text-xl font-semibold tracking-[-.03em] sm:text-2xl">{ru.newCase.dropTitle}</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{ru.newCase.dropHint}</p>
            <div className="mt-6 flex w-full max-w-sm flex-col justify-center gap-2.5 sm:flex-row">
              <Button type="button" onClick={() => input.current?.click()} className="h-12 flex-1 rounded-xl shadow-[0_8px_20px_rgba(25,94,234,.18)]"><UploadCloud /> {ru.newCase.choose}</Button>
              <Button type="button" onClick={() => camera.current?.click()} variant="outline" className="h-12 flex-1 rounded-xl bg-white"><Camera /> {ru.newCase.camera}</Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{ru.newCase.limit}</p>
            <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { acceptFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
            <input ref={camera} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => { acceptFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
            {uploadError && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{uploadError}</p>}
          </div>

          {evidence.length > 0 && (
            <div className="border-t border-border/70 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold">Добавленные материалы</p><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{evidence.length} из 6</span></div>
              <div className="grid gap-2 sm:grid-cols-2">{evidence.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary">{item.mimeType === "application/pdf" ? <FileText className="size-5" /> : <ImageIcon className="size-5" />}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="size-3 text-emerald-600" /> {item.detectedType}</span></span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Удалить ${item.name}`} onClick={() => onRemove(item.id)} className="rounded-lg text-muted-foreground hover:text-destructive"><Trash2 /></Button>
                </div>
              ))}</div>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4 text-emerald-600" /> Файлы хранятся в приватном хранилище</span>
            <Button variant="ghost" onClick={onDemo} className="h-8 justify-start rounded-lg px-2 text-xs text-primary">{ru.newCase.demo}</Button>
          </div>
        </Card>

        <div className="mt-8 rounded-[24px] border border-border bg-card p-4 shadow-[0_12px_36px_rgba(20,39,78,.05)] sm:p-6">
          <div><h2 className="text-xl font-semibold tracking-[-.03em]">{ru.newCase.problem}</h2><p className="mt-1 text-sm text-muted-foreground">Выберите вариант или оставьте определение Qaitar</p></div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ru.newCase.problems.map(([id, title, description], index) => {
              const Icon = problemIcons[index];
              const selected = problemType === id;
              return (
                <button key={id} type="button" aria-pressed={selected} onClick={() => onProblem(id as ProblemType)} className={`group relative min-h-28 rounded-2xl border p-4 text-left outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_10px_24px_rgba(20,39,78,.07)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${selected ? "border-primary bg-primary/[.055] shadow-[inset_0_0_0_1px_rgba(25,94,234,.08)]" : "border-border bg-card"}`}>
                  <span className="flex items-center justify-between gap-3"><Icon className={`size-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />{selected && <span className="grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3.5" /></span>}</span>
                  <span className="mt-3 block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="problem-description" className="text-sm font-semibold">{messages.newCase.descriptionLabel}</label>
              <span className="text-xs text-muted-foreground">{problemDescription.length} / 2 000</span>
            </div>
            <Textarea id="problem-description" value={problemDescription} onChange={(event) => onProblemDescription(event.target.value)} maxLength={2_000} rows={4} placeholder={messages.newCase.descriptionPlaceholder} aria-describedby="problem-description-hint problem-description-error" aria-invalid={!validation.ok && problemType === "other"} className="mt-2 min-h-28 rounded-xl" />
            <p id="problem-description-hint" className="mt-2 text-xs leading-5 text-muted-foreground">{messages.newCase.descriptionHint}</p>
            {!validation.ok && problemType === "other" && <p id="problem-description-error" role="alert" className="mt-2 text-sm text-destructive">{messages.newCase.descriptionRequired}</p>}
          </div>
          {error && <p role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
          <div className="mt-6 border-t border-border pt-5">
            {files.length === 0 && <p className="mb-3 text-sm text-muted-foreground">Добавьте хотя бы один файл, чтобы начать разбор.</p>}
            {files.length > 0 && !validation.ok && <p className="mb-3 text-sm text-destructive">{validationMessage}</p>}
            <Button disabled={files.length === 0 || !validation.ok} onClick={onAnalyze} size="lg" className="h-13 w-full rounded-xl px-7 text-[15px] shadow-[0_10px_24px_rgba(25,94,234,.20)] transition-transform duration-200 enabled:hover:-translate-y-0.5">{ru.newCase.action} <ArrowRight /></Button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-border/80 bg-card/70 p-3 sm:grid-cols-3 sm:p-4">
          {["Проверяем по официальным источникам Казахстана", "Показываем ссылки на нормы", "Просим подтвердить извлечённые факты"].map((item, index) => (
            <div key={item} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-xs font-medium text-muted-foreground">{index === 0 ? <ShieldCheck className="size-4 shrink-0 text-primary" /> : index === 1 ? <FileText className="size-4 shrink-0 text-primary" /> : <FileCheck2 className="size-4 shrink-0 text-primary" />}<span>{item}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}
