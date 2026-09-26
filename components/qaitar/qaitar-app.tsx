"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Clock3, FileText, Plus } from "lucide-react";

import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { applyReviewIssueEdit } from "../../lib/case-review.ts";
import { ClientRequestError, getClientErrorMessage } from "../../lib/client-errors.ts";
import { restoreCaseSnapshot, serializeCaseSnapshot } from "../../lib/client-case.ts";
import type { Locale } from "../../lib/i18n/index.ts";
import { getBrowserSupabase } from "../../lib/supabase/browser.ts";
import { requiresDirectUpload } from "../../lib/upload-strategy.ts";
import { createSellerResponseRequest, emptySellerResponseDrafts, isClaimSentConfirmed, saveSellerResponseDraft, sellerResponseNextState, validateClaimSentDate, validateSellerResponseDraft, type SellerResponseDraft, type SellerResponseDrafts } from "../../lib/seller-response-input.ts";
import { resolveUploadType, validateProblemInput } from "../../lib/workflow.ts";
import type { CaseAnalysis, EvidenceItem, LegalRecommendation, OfficialActionPlan, QaitarCase, SellerResponseAnalysis, SellerResponseInput } from "../../types/qaitar.ts";
import { AnalysisProgress } from "./analysis-progress";
import { AppShell } from "./app-shell";
import { CaseReview } from "./case-review";
import { ClaimEditor, type ConsumerForm } from "./claim-editor";
import { DocumentWorkspace } from "./document-workspace";
import { LegalResult } from "./legal-result";
import { LanguageProvider, useLanguage } from "./language-provider";
import { NewCase } from "./new-case";
import { SellerResponse } from "./seller-response";

type View = "workflow" | "cases" | "document";
type BusyPhase = "analysis" | "legal" | "response" | null;
const STORAGE_KEY = "qaitar.current-case.v1";

const emptyCase = (): QaitarCase => ({
  id: "draft",
  state: "NEW_CASE",
  problemType: null,
  problemDescription: "",
  demo: false,
  evidence: [],
  analysis: null,
  recommendation: null,
  claim: null,
  claimSentAt: null,
  sellerResponseInput: null,
  sellerResponse: null,
  officialActionPlan: null,
  updatedAt: new Date().toISOString(),
});

function evidenceId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function detectType(name: string, locale: Locale) {
  const value = name.toLowerCase();
  const names = {
    ru: ["Чек", "Переписка", "Гарантия", "PDF-документ", "Фото товара"],
    kk: ["Түбіртек", "Хат алмасу", "Кепілдік", "PDF-құжат", "Тауар фотосы"],
    en: ["Receipt", "Seller chat", "Warranty", "PDF document", "Product photo"],
  }[locale];
  if (value.includes("receipt") || value.includes("чек")) return names[0];
  if (value.includes("chat") || value.includes("переписк")) return names[1];
  if (value.includes("warranty") || value.includes("гарант")) return names[2];
  if (value.endsWith(".pdf")) return names[3];
  return names[4];
}

function wait(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

export function QaitarApp() {
  return <LanguageProvider><QaitarAppContent /></LanguageProvider>;
}

function QaitarAppContent() {
  const { locale, messages } = useLanguage();
  const [view, setView] = useState<View>("workflow");
  const [caseData, setCaseData] = useState<QaitarCase>(emptyCase);
  const demo = caseData.demo;
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<BusyPhase>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseOpen, setResponseOpen] = useState(false);
  const [claimSentDateDraft, setClaimSentDateDraft] = useState("");
  const [responseMode, setResponseMode] = useState<SellerResponseDraft["mode"]>("file");
  const [responseDrafts, setResponseDrafts] = useState<SellerResponseDrafts>(() => emptySellerResponseDrafts());
  const responseInFlight = useRef(false);
  const responseDraft = responseDrafts[responseMode];

  useEffect(() => {
    const saved = restoreCaseSnapshot(window.localStorage.getItem(STORAGE_KEY) ?? "");
    const timeout = window.setTimeout(() => {
      if (saved && saved.state !== "NEW_CASE" && saved.state !== "FILES_UPLOADED") {
        setCaseData(saved.state === "SELLER_RESPONSE_UPLOADED" ? { ...saved, state: "WAITING_FOR_RESPONSE" } : saved);
        setClaimSentDateDraft(saved.claimSentAt ?? "");
        setResponseDrafts(emptySellerResponseDrafts(saved.claimSentAt ?? ""));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (caseData.state !== "NEW_CASE" && caseData.state !== "FILES_UPLOADED") {
      window.localStorage.setItem(STORAGE_KEY, serializeCaseSnapshot(caseData));
    }
  }, [caseData]);

  const savedCaseExists = caseData.state !== "NEW_CASE";
  const evidence = useMemo<EvidenceItem[]>(() => files.map((file) => ({
    id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type,
    detectedType: detectType(file.name, locale), status: "ready",
  })), [files, locale]);

  function updateCase(updates: Partial<QaitarCase>) {
    setCaseData((current) => ({ ...current, ...updates, updatedAt: new Date().toISOString() }));
  }

  function chooseFiles(nextFiles: File[]) {
    setFiles(nextFiles);
    updateCase({ demo: false, evidence: nextFiles.map((file) => ({ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" })), state: nextFiles.length ? "FILES_UPLOADED" : "NEW_CASE" });
    setError(null);
  }

  function addDemo() {
    const demoFiles = [
      new File(["Qaitar demo receipt"], "receipt.jpg", { type: "image/jpeg", lastModified: 1 }),
      new File(["Qaitar demo seller chat"], "seller-chat.png", { type: "image/png", lastModified: 2 }),
    ];
    setFiles(demoFiles); setError(null);
    updateCase({ demo: true, problemType: "defective_product", evidence: demoFiles.map((file) => ({ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" })), state: "FILES_UPLOADED" });
  }

  async function analyze() {
    if (!files.length) return;
    if (!validateProblemInput(caseData.problemType, caseData.problemDescription).ok) return;
    setBusy("analysis"); setError(null);
    try {
      let responsePromise: Promise<Response>;
      if (!demo && getBrowserSupabase()) {
        const caseId = caseData.id === "draft" ? crypto.randomUUID() : caseData.id;
        const signResponse = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })) }),
        });
        const signed = await signResponse.json() as { error?: string; uploads?: Array<{ name: string; type: string; size: number; path: string; token: string }> };
        if (!signResponse.ok) throw new ClientRequestError(signResponse.status, signed.error);
        if (!signed.uploads) throw new Error("Missing signed uploads");
        const supabase = getBrowserSupabase();
        if (!supabase) throw new Error("Хранилище не настроено");
        await Promise.all(signed.uploads.map(async (upload, index) => {
          const { error: uploadError } = await supabase.storage.from("case-documents").uploadToSignedUrl(upload.path, upload.token, files[index], { contentType: upload.type });
          if (uploadError) throw uploadError;
        }));
        responsePromise = fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, locale, problemType: caseData.problemType ?? undefined, problemDescription: caseData.problemDescription, files: signed.uploads.map((upload) => ({ name: upload.name, type: upload.type, size: upload.size, path: upload.path })) }),
        });
      } else {
        if (!demo && requiresDirectUpload(files.map((file) => file.size))) {
          throw new Error("Для файлов такого размера настройте Supabase Storage");
        }
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        formData.set("demo", String(demo));
        formData.set("locale", locale);
        formData.set("problemType", caseData.problemType ?? "");
        formData.set("problemDescription", caseData.problemDescription);
        if (caseData.id !== "draft") formData.set("caseId", caseData.id);
        responsePromise = fetch("/api/analyze", { method: "POST", body: formData });
      }
      const response = await responsePromise;
      const payload = await response.json() as { error?: string; caseId?: string; analysis?: CaseAnalysis };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.caseId || !payload.analysis) throw new Error("Пустой ответ сервиса");
      updateCase({ id: payload.caseId, state: "DOCUMENTS_ANALYZED", analysis: payload.analysis, evidence: evidence.map((item) => ({ ...item, status: "processed" })) });
    } catch (reason) {
      setError(getClientErrorMessage("analysis", locale, reason));
    } finally { setBusy(null); }
  }

  function updateFact(key: string, value: string) {
    if (!caseData.analysis) return;
    if (key === "issue") {
      updateCase(applyReviewIssueEdit(caseData.analysis, value, locale, demo));
      return;
    }
    const factValue = key === "purchaseDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Intl.DateTimeFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale], { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00Z`))
      : value;
    const analysis = { ...caseData.analysis, facts: caseData.analysis.facts.map((fact) => fact.key === key ? { ...fact, value: factValue, source: "user" as const } : fact) };
    if (key === "seller") analysis.seller = { name: value || null };
    if (key === "product") analysis.product = { ...analysis.product, name: value || null };
    if (key === "amount") analysis.product = { ...analysis.product, price: Number(value.replace(/[^0-9.]/g, "")) || null };
    if (key === "purchaseDate" && /^\d{4}-\d{2}-\d{2}$/.test(value)) analysis.purchaseDate = value;
    if (key === "sellerResponse") analysis.sellerResponse = value || null;
    updateCase({ analysis });
  }

  async function confirmCase() {
    if (!caseData.analysis) return;
    updateCase({ state: "CASE_CONFIRMED" }); setBusy("legal"); setError(null);
    try {
      const [response] = await Promise.all([fetch("/api/legal-recommendation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis: caseData.analysis, demo, locale }) }), wait(3_200)]);
      const payload = await response.json() as { error?: string; recommendation?: LegalRecommendation };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.recommendation) throw new Error("Пустой ответ сервиса");
      const recommendation = payload.recommendation;
      updateCase({ recommendation, state: recommendation.status === "legal_basis_found" ? "LEGAL_BASIS_FOUND" : "LEGAL_SEARCH_COMPLETED" });
    } catch (reason) { setError(getClientErrorMessage("legal", locale, reason)); }
    finally { setBusy(null); }
  }

  async function generateClaim(consumer: ConsumerForm) {
    if (!caseData.analysis || !caseData.recommendation) return;
    setError(null);
    try {
      const response = await fetch("/api/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis: caseData.analysis, recommendation: caseData.recommendation, consumer, locale }) });
      const payload = await response.json() as { error?: string; claim?: string };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.claim) throw new Error("Пустой ответ сервиса");
      updateCase({ claim: payload.claim, state: "CLAIM_GENERATED" });
    } catch (reason) { setError(getClientErrorMessage("claim", locale, reason)); }
  }

  function changeResponseDraft(draft: SellerResponseDraft) {
    setResponseDrafts((current) => saveSellerResponseDraft(current, draft));
    setError(null);
  }

  function changeClaimSentAt(value: string) {
    setClaimSentDateDraft(value);
    setError(null);
  }

  function markClaimSent() {
    if (!validateClaimSentDate(claimSentDateDraft)) {
      setError(messages.seller.validation.sentInvalid);
      return;
    }
    updateCase({ claimSentAt: claimSentDateDraft, state: "WAITING_FOR_RESPONSE" });
    setResponseDrafts((current) => ({ ...current, no_response: { ...current.no_response, claimSentAt: claimSentDateDraft } }));
    setError(null);
  }

  async function analyzeResponse(draft: SellerResponseDraft = responseDraft, forceDemo = false) {
    if (responseInFlight.current || busy === "response") return;
    const validation = validateSellerResponseDraft(draft, locale);
    if (!validation.ok) { setError(validation.error); return; }
    responseInFlight.current = true;
    const previousState = caseData.state;
    setBusy("response"); setError(null);
    updateCase({ state: "SELLER_RESPONSE_UPLOADED" });
    try {
      const request = createSellerResponseRequest(draft, caseData.analysis, locale, forceDemo || demo);
      const [response] = await Promise.all([fetch("/api/seller-response", request), wait(3_200)]);
      const payload = await response.json() as { error?: string; responseAnalysis?: SellerResponseAnalysis; recommendation?: LegalRecommendation | null; officialActionPlan?: OfficialActionPlan | null };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.responseAnalysis) throw new Error("Пустой ответ сервиса");
      const sellerResponse = payload.responseAnalysis;
      const submittedAt = new Date().toISOString();
      const sellerResponseInput: SellerResponseInput = draft.mode === "file"
        ? { mode: "file", fileName: draft.file!.name, mimeType: resolveUploadType(draft.file!), size: draft.file!.size, submittedAt }
        : draft.mode === "text"
          ? { mode: "text", text: draft.text.trim(), submittedAt }
          : { mode: "no_response", claimSentAt: draft.claimSentAt, ...(draft.receiptVerified ? { claimReceivedAt: draft.claimReceivedAt } : {}), submittedAt };
      updateCase({ sellerResponseInput, sellerResponse, recommendation: payload.recommendation ?? null, officialActionPlan: payload.officialActionPlan ?? null, claimSentAt: draft.mode === "no_response" ? draft.claimSentAt : caseData.claimSentAt, state: sellerResponseNextState(sellerResponse, payload.officialActionPlan ?? null) });
      setResponseDrafts(emptySellerResponseDrafts(caseData.claimSentAt ?? ""));
      setResponseOpen(false);
    } catch (reason) {
      updateCase({ state: previousState === "SELLER_RESPONSE_UPLOADED" ? "WAITING_FOR_RESPONSE" : previousState });
      setError(getClientErrorMessage("seller", locale, reason));
    } finally { responseInFlight.current = false; setBusy(null); }
  }

  function resetCase() {
    if (savedCaseExists && !window.confirm(messages.common.newCaseConfirm)) return;
    setCaseData(emptyCase()); setFiles([]); setResponseOpen(false); setClaimSentDateDraft(""); setResponseMode("file"); setResponseDrafts(emptySellerResponseDrafts()); setError(null); setView("workflow"); window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AppShell view={view} state={caseData.state} onView={setView} onNew={resetCase}>
      {busy ? <AnalysisProgress phase={busy} /> : view === "cases" ? <CasesView caseData={caseData} onContinue={() => setView("workflow")} onNew={resetCase} /> : view === "document" ? <DocumentWorkspace onAddToCase={(file) => { setCaseData(emptyCase()); setFiles([file]); setView("workflow"); setCaseData((current) => ({ ...current, state: "FILES_UPLOADED", evidence: [{ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" }] })); }} /> : (
        <>
          {error && caseData.state !== "NEW_CASE" && caseData.state !== "FILES_UPLOADED" && <div className="mx-auto mt-5 max-w-4xl px-4"><p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p></div>}
          {(caseData.state === "NEW_CASE" || caseData.state === "FILES_UPLOADED") && <NewCase files={files} evidence={evidence} problemType={caseData.problemType} problemDescription={caseData.problemDescription} error={error} onFiles={chooseFiles} onRemove={(id) => chooseFiles(files.filter((file) => evidenceId(file) !== id))} onProblem={(problemType) => updateCase({ problemType })} onProblemDescription={(problemDescription) => updateCase({ problemDescription })} onAnalyze={analyze} onDemo={addDemo} />}
          {caseData.state === "DOCUMENTS_ANALYZED" && caseData.analysis && <CaseReview analysis={caseData.analysis} onChange={updateFact} onConfirm={confirmCase} />}
          {(caseData.state === "LEGAL_BASIS_FOUND" || caseData.state === "LEGAL_SEARCH_COMPLETED") && caseData.recommendation && <LegalResult recommendation={caseData.recommendation} onPrepare={() => updateCase({ state: "CLAIM_READY" })} />}
          {caseData.state === "CLAIM_READY" && <ClaimEditor claim={null} demo={demo} busy={false} claimSentAt="" sent={false} onGenerate={generateClaim} onChangeClaim={() => undefined} onClaimSentAtChange={() => undefined} onMarkSent={() => undefined} onAddResponse={() => undefined} />}
          {(caseData.state === "CLAIM_GENERATED" || caseData.state === "WAITING_FOR_RESPONSE") && !responseOpen && <ClaimEditor claim={caseData.claim} demo={demo} busy={false} claimSentAt={claimSentDateDraft} sent={isClaimSentConfirmed(caseData.state, caseData.claimSentAt, claimSentDateDraft)} onGenerate={generateClaim} onChangeClaim={(claim) => updateCase({ claim })} onClaimSentAtChange={changeClaimSentAt} onMarkSent={markClaimSent} onAddResponse={() => setResponseOpen(true)} />}
          {(responseOpen || ["SELLER_RESPONSE_UPLOADED", "SELLER_ACCEPTED", "SELLER_REJECTED", "ESCALATION_READY"].includes(caseData.state)) && <SellerResponse result={caseData.sellerResponse} recommendation={caseData.sellerResponse ? caseData.recommendation : null} draft={responseDraft} onDraftChange={changeResponseDraft} onModeChange={(mode) => { setResponseMode(mode); setError(null); }} onAnalyze={() => analyzeResponse()} onDemo={() => analyzeResponse({ mode: "file", file: new File(["Qaitar demo rejection"], "seller-rejection.pdf", { type: "application/pdf" }) }, true)} error={error} />}
        </>
      )}
      <footer className="mx-auto max-w-5xl px-6 pb-8 pt-4 text-center text-xs leading-5 text-muted-foreground">{messages.disclaimer}</footer>
    </AppShell>
  );
}

function CasesView({ caseData, onContinue, onNew }: { caseData: QaitarCase; onContinue: () => void; onNew: () => void }) {
  const { locale, messages } = useLanguage();
  const hasCase = caseData.state !== "NEW_CASE";
  return <section className="px-4 py-8 sm:px-7 lg:px-12 lg:py-11"><div className="mx-auto max-w-4xl"><div className="flex items-center justify-between gap-4"><h1 className="text-3xl font-bold tracking-[-.04em]">{messages.cases.title}</h1><Button onClick={onNew} className="rounded-xl"><Plus /> {messages.cases.start}</Button></div>{hasCase ? <Card className="mt-7 rounded-[24px] py-0 shadow-none"><CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText /></span><div className="min-w-0 flex-1"><p className="font-semibold">{caseData.analysis?.product.name ?? messages.cases.newRequest}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{caseData.analysis?.summary ?? messages.cases.documentsAdded}</p><p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5" /> {messages.cases.updated} {new Intl.DateTimeFormat({ ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[locale], { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(caseData.updatedAt))}</p></div><Button onClick={onContinue} variant="outline" className="rounded-xl">{messages.cases.continue} <ArrowRight /></Button></CardContent></Card> : <Card className="mt-7 rounded-[24px] py-0 shadow-none"><CardContent className="p-12 text-center text-muted-foreground">{messages.cases.empty}</CardContent></Card>}</div></section>;
}
