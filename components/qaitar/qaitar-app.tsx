"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyReviewIssueEdit } from "../../lib/case-review.ts";
import { readCaseCollection, writeCaseCollection } from "../../lib/case-collection-storage.ts";
import { activateCase, createEmptyCase, getActiveCase, removeCase, updateCaseById, upsertCase, type CaseCollection } from "../../lib/case-history.ts";
import { ClientRequestError, getClientErrorMessage } from "../../lib/client-errors.ts";
import type { Locale } from "../../lib/i18n/index.ts";
import { getBrowserSupabase } from "../../lib/supabase/browser.ts";
import { requiresDirectUpload } from "../../lib/upload-strategy.ts";
import { createSellerResponseRequest, emptySellerResponseDrafts, isClaimSentConfirmed, saveSellerResponseDraft, sellerResponseNextState, validateClaimSentDate, validateSellerResponseDraft, type SellerResponseDraft, type SellerResponseDrafts } from "../../lib/seller-response-input.ts";
import { resolveUploadType, validateProblemInput } from "../../lib/workflow.ts";
import type { CaseAnalysis, EvidenceItem, LegalRecommendation, OfficialActionPlan, QaitarCase, SellerResponseAnalysis, SellerResponseInput } from "../../types/qaitar.ts";
import { AnalysisProgress } from "./analysis-progress";
import { AppShell } from "./app-shell";
import { CaseList } from "./case-list";
import { CaseReview } from "./case-review";
import { ClaimEditor, type ConsumerForm } from "./claim-editor";
import { DocumentWorkspace } from "./document-workspace";
import { LegalResult } from "./legal-result";
import { LanguageProvider, useLanguage } from "./language-provider";
import { NewCase } from "./new-case";
import { SellerResponse } from "./seller-response";

type View = "workflow" | "cases" | "document";
type BusyPhase = "analysis" | "legal" | "response";

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
  const [view, setView] = useState<View>("cases");
  const [caseData, setCaseData] = useState<QaitarCase | null>(null);
  const caseDataRef = useRef(caseData);
  const [collection, setCollection] = useState<CaseCollection>({ version: 2, activeCaseId: null, cases: [] });
  const collectionRef = useRef(collection);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState(false);
  const caseFiles = useRef(new Map<string, File[]>());
  const caseResponseDrafts = useRef(new Map<string, SellerResponseDrafts>());
  const caseSentDateDrafts = useRef(new Map<string, string>());
  const caseErrors = useRef(new Map<string, string>());
  const demo = caseData?.demo ?? false;
  const [files, setFiles] = useState<File[]>([]);
  const [busyByCase, setBusyByCase] = useState<Record<string, BusyPhase>>({});
  const busy = caseData ? busyByCase[caseData.id] ?? null : null;
  const [error, setError] = useState<string | null>(null);
  const [responseOpen, setResponseOpen] = useState(false);
  const [claimSentDateDraft, setClaimSentDateDraft] = useState("");
  const [responseMode, setResponseMode] = useState<SellerResponseDraft["mode"]>("file");
  const [responseDrafts, setResponseDrafts] = useState<SellerResponseDrafts>(() => emptySellerResponseDrafts());
  const responseInFlight = useRef(new Set<string>());
  const responseDraft = responseDrafts[responseMode];

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const restored = readCaseCollection(window.localStorage, () => setPersistenceWarning(true));
      const active = getActiveCase(restored);
      const selected = active?.state === "SELLER_RESPONSE_UPLOADED" ? { ...active, state: "WAITING_FOR_RESPONSE" as const } : active;
      const nextCollection = selected && selected !== active ? upsertCase(restored, selected) : restored;
      collectionRef.current = nextCollection;
      setCollection(nextCollection);
      const nextCase = selected ?? null;
      caseDataRef.current = nextCase;
      setCaseData(nextCase);
      setClaimSentDateDraft(nextCase?.claimSentAt ?? "");
      setResponseDrafts(emptySellerResponseDrafts(nextCase?.claimSentAt ?? ""));
      setView(nextCase ? "workflow" : "cases");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (hydrated) {
      const saved = writeCaseCollection(window.localStorage, collection);
      queueMicrotask(() => setPersistenceWarning(!saved));
    }
  }, [collection, hydrated]);
  const evidence = useMemo<EvidenceItem[]>(() => files.map((file) => ({
    id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type,
    detectedType: detectType(file.name, locale), status: "ready",
  })), [files, locale]);

  function updateCase(updates: Partial<QaitarCase>) {
    const current = caseDataRef.current;
    if (!current) return;
    const next = { ...current, ...updates, updatedAt: new Date().toISOString() };
    const base = next.id === current.id ? collectionRef.current : removeCase(collectionRef.current, current.id);
    commitCase(next, base);
  }

  function commitCase(next: QaitarCase, base = collectionRef.current) {
    caseDataRef.current = next;
    setCaseData(next);
    const updated = upsertCase(base, next);
    collectionRef.current = updated;
    setCollection(updated);
  }

  function commitAsyncCase(caseId: string, updates: Partial<QaitarCase>) {
    const updated = updateCaseById(collectionRef.current, caseId, updates);
    if (updated === collectionRef.current) return false;
    collectionRef.current = updated;
    setCollection(updated);
    if (caseDataRef.current?.id === caseId) {
      const selected = updated.cases.find((item) => item.id === caseId) ?? null;
      caseDataRef.current = selected;
      setCaseData(selected);
    }
    return true;
  }

  function setCaseError(caseId: string, message: string | null) {
    if (!collectionRef.current.cases.some((item) => item.id === caseId)) return;
    if (message) caseErrors.current.set(caseId, message);
    else caseErrors.current.delete(caseId);
    if (caseDataRef.current?.id === caseId) setError(message);
  }

  function startBusy(caseId: string, phase: BusyPhase) {
    setBusyByCase((current) => ({ ...current, [caseId]: phase }));
  }

  function finishBusy(caseId: string) {
    setBusyByCase((current) => {
      const next = { ...current };
      delete next[caseId];
      return next;
    });
  }

  function resetTransientCaseState(next: QaitarCase | null, preserveCurrent = true) {
    if (preserveCurrent && caseDataRef.current) {
      caseResponseDrafts.current.set(caseDataRef.current.id, responseDrafts);
      caseSentDateDrafts.current.set(caseDataRef.current.id, claimSentDateDraft);
    }
    caseDataRef.current = next;
    setCaseData(next);
    setFiles(next ? caseFiles.current.get(next.id) ?? [] : []);
    setResponseOpen(false);
    setClaimSentDateDraft(next ? caseSentDateDrafts.current.get(next.id) ?? next.claimSentAt ?? "" : "");
    setResponseMode("file");
    setResponseDrafts(next ? caseResponseDrafts.current.get(next.id) ?? emptySellerResponseDrafts(next.claimSentAt ?? "") : emptySellerResponseDrafts());
    setError(next ? caseErrors.current.get(next.id) ?? null : null);
  }

  function openCase(caseId: string) {
    const activated = activateCase(collectionRef.current, caseId);
    const next = getActiveCase(activated);
    if (next?.id !== caseId) return;
    collectionRef.current = activated;
    setCollection(activated);
    resetTransientCaseState(next);
    setView("workflow");
  }

  function deleteCase(caseId: string) {
    if (!window.confirm(messages.cases.deleteConfirm)) return;
    const updated = removeCase(collectionRef.current, caseId);
    if (updated === collectionRef.current) return;
    collectionRef.current = updated;
    setCollection(updated);
    caseFiles.current.delete(caseId);
    caseResponseDrafts.current.delete(caseId);
    caseSentDateDrafts.current.delete(caseId);
    caseErrors.current.delete(caseId);
    if (caseDataRef.current?.id === caseId) {
      const next = getActiveCase(updated);
      resetTransientCaseState(next, false);
      if (!next) setView("cases");
    }
  }

  function chooseFiles(nextFiles: File[]) {
    if (!caseDataRef.current) return;
    setFiles(nextFiles);
    caseFiles.current.set(caseDataRef.current.id, nextFiles);
    updateCase({ demo: false, evidence: nextFiles.map((file) => ({ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" })), state: nextFiles.length ? "FILES_UPLOADED" : "NEW_CASE" });
    setError(null);
  }

  function addDemo() {
    if (!caseDataRef.current) return;
    const demoFiles = [
      new File(["Qaitar demo receipt"], "receipt.jpg", { type: "image/jpeg", lastModified: 1 }),
      new File(["Qaitar demo seller chat"], "seller-chat.png", { type: "image/png", lastModified: 2 }),
    ];
    setFiles(demoFiles); setError(null);
    caseFiles.current.set(caseDataRef.current.id, demoFiles);
    updateCase({ demo: true, problemType: "defective_product", evidence: demoFiles.map((file) => ({ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" })), state: "FILES_UPLOADED" });
  }

  async function analyze() {
    if (!caseData) return;
    if (!files.length) return;
    if (!validateProblemInput(caseData.problemType, caseData.problemDescription).ok) return;
    const originId = caseData.id;
    startBusy(originId, "analysis"); setCaseError(originId, null);
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
      commitAsyncCase(originId, { state: "DOCUMENTS_ANALYZED", analysis: payload.analysis, evidence: evidence.map((item) => ({ ...item, status: "processed" })) });
    } catch (reason) {
      setCaseError(originId, getClientErrorMessage("analysis", locale, reason));
    } finally { finishBusy(originId); }
  }

  function updateFact(key: string, value: string) {
    if (!caseData?.analysis) return;
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
    if (!caseData?.analysis) return;
    const originId = caseData.id;
    commitAsyncCase(originId, { state: "CASE_CONFIRMED" }); startBusy(originId, "legal"); setCaseError(originId, null);
    try {
      const [response] = await Promise.all([fetch("/api/legal-recommendation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis: caseData.analysis, demo, locale }) }), wait(3_200)]);
      const payload = await response.json() as { error?: string; recommendation?: LegalRecommendation };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.recommendation) throw new Error("Пустой ответ сервиса");
      const recommendation = payload.recommendation;
      commitAsyncCase(originId, { recommendation, state: recommendation.status === "legal_basis_found" ? "LEGAL_BASIS_FOUND" : "LEGAL_SEARCH_COMPLETED" });
    } catch (reason) {
      commitAsyncCase(originId, { state: "DOCUMENTS_ANALYZED" });
      setCaseError(originId, getClientErrorMessage("legal", locale, reason));
    }
    finally { finishBusy(originId); }
  }

  async function generateClaim(consumer: ConsumerForm) {
    if (!caseData?.analysis || !caseData.recommendation) return;
    const originId = caseData.id;
    setCaseError(originId, null);
    try {
      const response = await fetch("/api/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ analysis: caseData.analysis, recommendation: caseData.recommendation, consumer, locale }) });
      const payload = await response.json() as { error?: string; claim?: string };
      if (!response.ok) throw new ClientRequestError(response.status, payload.error);
      if (!payload.claim) throw new Error("Пустой ответ сервиса");
      commitAsyncCase(originId, { claim: payload.claim, state: "CLAIM_GENERATED" });
    } catch (reason) { setCaseError(originId, getClientErrorMessage("claim", locale, reason)); }
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
    if (!caseData) return;
    const originId = caseData.id;
    if (responseInFlight.current.has(originId) || busy === "response") return;
    const validation = validateSellerResponseDraft(draft, locale);
    if (!validation.ok) { setError(validation.error); return; }
    responseInFlight.current.add(originId);
    const previousState = caseData.state;
    startBusy(originId, "response"); setCaseError(originId, null);
    commitAsyncCase(originId, { state: "SELLER_RESPONSE_UPLOADED" });
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
      if (commitAsyncCase(originId, { sellerResponseInput, sellerResponse, recommendation: payload.recommendation ?? null, officialActionPlan: payload.officialActionPlan ?? null, claimSentAt: draft.mode === "no_response" ? draft.claimSentAt : caseData.claimSentAt, state: sellerResponseNextState(sellerResponse, payload.officialActionPlan ?? null) })) {
        const emptyDrafts = emptySellerResponseDrafts(caseData.claimSentAt ?? "");
        caseResponseDrafts.current.set(originId, emptyDrafts);
        if (caseDataRef.current?.id === originId) {
          setResponseDrafts(emptyDrafts);
          setResponseOpen(false);
        }
      }
    } catch (reason) {
      commitAsyncCase(originId, { state: previousState === "SELLER_RESPONSE_UPLOADED" ? "WAITING_FOR_RESPONSE" : previousState });
      setCaseError(originId, getClientErrorMessage("seller", locale, reason));
    } finally { responseInFlight.current.delete(originId); finishBusy(originId); }
  }

  function resetCase() {
    resetTransientCaseState(createEmptyCase(crypto.randomUUID()));
    setView("workflow");
  }

  function navigate(next: View) {
    setView(next === "workflow" && !caseDataRef.current ? "cases" : next);
  }

  function addDocumentToNewCase(file: File) {
    const next = {
      ...createEmptyCase(crypto.randomUUID()),
      state: "FILES_UPLOADED" as const,
      evidence: [{ id: evidenceId(file), name: file.name, size: file.size, mimeType: file.type, detectedType: detectType(file.name, locale), status: "ready" as const }],
    };
    resetTransientCaseState(next);
    caseFiles.current.set(next.id, [file]);
    setFiles([file]);
    commitCase(next);
    setView("workflow");
  }

  return (
    <AppShell view={view} state={caseData?.state ?? null} onView={navigate} onNew={resetCase}>
      {persistenceWarning && <div className="mx-auto mt-5 max-w-4xl px-4"><p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{messages.cases.saveWarning}</p></div>}
      {view === "cases" ? <CaseList cases={collection.cases} onContinue={openCase} onDelete={deleteCase} onNew={resetCase} /> : view === "document" ? <DocumentWorkspace onAddToCase={addDocumentToNewCase} /> : !caseData ? <CaseList cases={collection.cases} onContinue={openCase} onDelete={deleteCase} onNew={resetCase} /> : busy ? <AnalysisProgress phase={busy} /> : (
        <>
          {error && caseData.state !== "NEW_CASE" && caseData.state !== "FILES_UPLOADED" && <div className="mx-auto mt-5 max-w-4xl px-4"><p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p></div>}
          {(caseData.state === "NEW_CASE" || caseData.state === "FILES_UPLOADED") && <NewCase files={files} evidence={evidence} problemType={caseData.problemType} problemDescription={caseData.problemDescription} error={error} onFiles={chooseFiles} onRemove={(id) => chooseFiles(files.filter((file) => evidenceId(file) !== id))} onProblem={(problemType) => updateCase({ problemType })} onProblemDescription={(problemDescription) => updateCase({ problemDescription })} onAnalyze={analyze} onDemo={addDemo} />}
          {caseData.state === "DOCUMENTS_ANALYZED" && caseData.analysis && <CaseReview analysis={caseData.analysis} onChange={updateFact} onConfirm={confirmCase} />}
          {(caseData.state === "LEGAL_BASIS_FOUND" || caseData.state === "LEGAL_SEARCH_COMPLETED") && caseData.recommendation && <LegalResult recommendation={caseData.recommendation} onPrepare={() => updateCase({ state: "CLAIM_READY" })} />}
          {caseData.state === "CLAIM_READY" && <ClaimEditor claim={null} demo={demo} busy={false} claimSentAt="" sent={false} onGenerate={generateClaim} onChangeClaim={() => undefined} onClaimSentAtChange={() => undefined} onMarkSent={() => undefined} onAddResponse={() => undefined} />}
          {(caseData.state === "CLAIM_GENERATED" || caseData.state === "WAITING_FOR_RESPONSE") && !responseOpen && <ClaimEditor claim={caseData.claim} demo={demo} busy={false} claimSentAt={claimSentDateDraft} sent={isClaimSentConfirmed(caseData.state, caseData.claimSentAt, claimSentDateDraft)} onGenerate={generateClaim} onChangeClaim={(claim) => updateCase({ claim })} onClaimSentAtChange={changeClaimSentAt} onMarkSent={markClaimSent} onAddResponse={() => setResponseOpen(true)} />}
          {(responseOpen || ["SELLER_RESPONSE_UPLOADED", "SELLER_ACCEPTED", "SELLER_REJECTED", "ESCALATION_READY", "RESOLVED"].includes(caseData.state)) && <SellerResponse result={caseData.sellerResponse} recommendation={caseData.sellerResponse ? caseData.recommendation : null} plan={caseData.officialActionPlan} state={caseData.state} draft={responseDraft} onDraftChange={changeResponseDraft} onModeChange={(mode) => { setResponseMode(mode); setError(null); }} onAnalyze={() => analyzeResponse()} onDemo={() => analyzeResponse({ mode: "file", file: new File(["Qaitar demo rejection"], "seller-rejection.pdf", { type: "application/pdf" }) }, true)} onMarkResolved={() => updateCase({ state: "RESOLVED" })} error={error} />}
        </>
      )}
      <footer className="mx-auto max-w-5xl px-6 pb-8 pt-4 text-center text-xs leading-5 text-muted-foreground">{messages.disclaimer}</footer>
    </AppShell>
  );
}
