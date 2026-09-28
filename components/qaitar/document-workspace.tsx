"use client";

import { useRef, useState } from "react";
import { ArrowRight, CheckSquare2, FileSearch, LoaderCircle, Plus, ScanText, UploadCloud } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useLanguage } from "./language-provider";

type Explanation = { title: string; description: string; important: Array<{ label: string; value: string }>; checklist: string[]; canAddToCase: boolean };

export function DocumentWorkspace({ onAddToCase }: { onAddToCase?: (file: File) => void }) {
  const { locale, messages } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Explanation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", file);
    body.set("locale", locale);
    try {
      const response = await fetch("/api/document", { method: "POST", body });
      const payload = await response.json() as { error?: string; explanation?: Explanation };
      if (!response.ok) throw new Error(payload.error);
      if (!payload.explanation) throw new Error(messages.common.emptyResponse);
      setResult(payload.explanation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messages.common.analyzeError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-[920px]">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><FileSearch className="size-5" /></span>
          <div><h1 className="text-3xl font-bold tracking-[-.04em]">{messages.document.title}</h1><p className="mt-1 text-sm text-muted-foreground">{messages.document.subtitle}</p></div>
        </div>

        {!result ? (
          <>
            <Card className="mt-7 rounded-[26px] border-dashed border-primary/25 bg-[linear-gradient(180deg,rgba(237,243,255,.65),rgba(255,255,255,.45))] py-0 shadow-[0_16px_42px_rgba(20,39,78,.07)]">
              <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-7 text-center sm:p-9">
                <span className="grid size-16 place-items-center rounded-[20px] bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(25,94,234,.22)]"><UploadCloud className="size-7" /></span>
                {file ? <><p className="mt-5 font-semibold">{file.name}</p><p className="mt-1 text-sm text-muted-foreground">{messages.document.ready}</p></> : <><p className="mt-5 text-xl font-semibold tracking-[-.025em]">{messages.document.upload}</p><p className="mt-2 text-sm text-muted-foreground">PDF, JPG, PNG, WEBP · 10 MB</p></>}
                <Button onClick={() => input.current?.click()} variant="outline" className="mt-6 h-11 rounded-xl bg-white"><UploadCloud /> {messages.document.choose}</Button>
                <input ref={input} type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </CardContent>
            </Card>
            {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
            <div className="mt-5 flex justify-end"><Button disabled={!file || busy} onClick={analyze} size="lg" className="h-12 w-full rounded-xl shadow-[0_10px_24px_rgba(25,94,234,.18)] sm:w-auto">{busy ? <LoaderCircle className="animate-spin" /> : <ScanText />} {messages.document.title} <ArrowRight /></Button></div>
          </>
        ) : (
          <div className="mt-7 space-y-6">
            <section aria-labelledby="document-kind-title">
              <Card className="rounded-[24px] py-0 shadow-[0_12px_34px_rgba(20,39,78,.06)]"><CardContent className="p-6 sm:p-7"><p id="document-kind-title" className="text-xs font-bold uppercase tracking-[.1em] text-primary">{messages.document.what}</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">{result.title}</h2><p className="mt-3 leading-7 text-muted-foreground">{result.description}</p></CardContent></Card>
            </section>
            <section aria-labelledby="important-title"><h2 id="important-title" className="mb-3 text-xl font-semibold tracking-[-.025em]">{messages.document.important}</h2><div className="grid gap-3 sm:grid-cols-2">{result.important.map((item) => <Card key={`${item.label}-${item.value}`} className="gap-2 rounded-[20px] py-0 shadow-none"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-[.08em] text-muted-foreground">{item.label}</p><p className="mt-2 font-semibold leading-6">{item.value}</p></CardContent></Card>)}</div></section>
            <section aria-labelledby="checklist-title"><Card className="rounded-[24px] border-primary/20 bg-primary/[.04] py-0 shadow-none"><CardContent className="p-6"><div id="checklist-title" className="flex items-center gap-2 text-sm font-bold"><CheckSquare2 className="size-5 text-primary" /> {messages.document.do}</div><ul className="mt-4 space-y-3">{result.checklist.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded border border-primary/30 bg-card text-primary">✓</span>{item}</li>)}</ul></CardContent></Card></section>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => { setResult(null); setFile(null); }} className="h-11 rounded-xl">{messages.document.another}</Button>{result.canAddToCase && file && onAddToCase && <Button onClick={() => onAddToCase(file)} className="h-11 rounded-xl"><Plus /> {messages.document.addToCase}</Button>}</div>
          </div>
        )}
      </div>
    </section>
  );
}
