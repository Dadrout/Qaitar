"use client";

import { useState } from "react";
import { Clipboard, Download, ExternalLink } from "lucide-react";

import { downloadTextPdf } from "../../lib/pdf.ts";
import type { OfficialActionPlan as OfficialActionPlanData } from "../../types/qaitar.ts";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useLanguage } from "./language-provider";

function verifiedSource(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && (parsed.hostname === "adilet.zan.kz" || parsed.hostname === "law.gov.kz" || parsed.hostname === "gov.kz" || parsed.hostname.endsWith(".gov.kz")) ? url : null;
  } catch {
    return null;
  }
}

function verifiedChannel(url: string | null) {
  return url === "https://eotinish.kz" || url === "https://eotinish.gov.kz" || url === "https://e-tutynushy.kz" ? url : null;
}

export function OfficialActionPlan({ plan }: { plan: OfficialActionPlanData }) {
  return <OfficialActionPlanContent key={`${plan.status}:${plan.appealText ?? plan.title}`} plan={plan} />;
}

function OfficialActionPlanContent({ plan }: { plan: OfficialActionPlanData }) {
  const { messages } = useLanguage();
  const t = messages.officialAction;
  const [appeal, setAppeal] = useState(plan.appealText ?? "");
  const [feedback, setFeedback] = useState("");

  if (plan.status !== "ready") {
    return <Card className="mt-6 rounded-[24px] border-amber-300 bg-amber-50 py-0 text-amber-950 shadow-none"><CardContent className="p-6">
      <h2 className="text-xl font-bold">{t.manual}</h2><p className="mt-2 text-sm leading-6">{t.manualHint}</p>
      {plan.missingInformation.length > 0 && <div className="mt-4"><h3 className="font-semibold">{t.missing}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.missingInformation.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    </CardContent></Card>;
  }

  const sourceLink = (url: string | null, label = t.source) => {
    const href = verifiedSource(url);
    return href ? <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline underline-offset-2"><ExternalLink className="size-3.5" aria-hidden="true" />{label}</a> : null;
  };

  async function copyAppeal() {
    try {
      await navigator.clipboard.writeText(appeal);
      setFeedback(t.copied);
    } catch {
      setFeedback(t.copyError);
    }
  }

  async function downloadAppeal() {
    try {
      await downloadTextPdf(appeal, { fileName: "qaitar-official-appeal.pdf", title: "Обращение потребителя" });
      setFeedback("");
    } catch {
      setFeedback(t.downloadError);
    }
  }

  return <div className="mt-7 space-y-5">
    <h2 className="text-2xl font-bold tracking-tight">{plan.title}</h2>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.destination}</h3><p className="mt-3 font-medium">{plan.authority.name}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.authority.reason}</p><div className="mt-3">{sourceLink(plan.authority.sourceUrl)}</div></CardContent></Card>
      <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.deadline}</h3><p className="mt-3 font-medium">{plan.deadline.label}</p>{plan.deadline.date && <p className="mt-1 text-sm">{plan.deadline.date}</p>}<p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.deadline.explanation}</p><div className="mt-3">{sourceLink(plan.deadline.sourceUrl)}</div></CardContent></Card>
    </div>
    <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.channels}</h3><ul className="mt-3 space-y-4">{plan.channels.filter((channel) => verifiedSource(channel.sourceUrl)).map((channel, index) => <li key={index} className="flex flex-col gap-1"><span className="font-medium">{channel.label}</span>{sourceLink(channel.sourceUrl, t.channelSource)}{verifiedChannel(channel.url) && <a href={verifiedChannel(channel.url)!} target="_blank" rel="noreferrer" className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ExternalLink className="size-4" aria-hidden="true" />{channel.label}</a>}</li>)}</ul><p className="mt-4 text-xs text-muted-foreground">{t.externalHint}</p></CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.attachments}</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{plan.requiredAttachments.map((item, index) => <li key={index}>{item}</li>)}</ul></CardContent></Card>
      <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.steps}</h3><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{plan.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></CardContent></Card>
    </div>
    <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.legalBasis}</h3><ul className="mt-3 space-y-4">{plan.legalBasis.filter((basis) => verifiedSource(basis.sourceUrl)).map((basis, index) => <li key={index}><p className="font-medium">{basis.lawName} · {basis.article}</p><p className="mt-1 text-sm text-muted-foreground">{basis.explanation}</p>{sourceLink(basis.sourceUrl)}</li>)}</ul></CardContent></Card>
    <Card className="rounded-[22px] py-0 shadow-none"><CardContent className="p-6"><h3 className="text-lg font-semibold">{t.appeal}</h3><p className="mt-1 text-sm text-muted-foreground">{t.editHint}</p><label htmlFor="official-appeal-text" className="mt-4 block text-sm font-semibold">{t.appealLabel}</label><textarea id="official-appeal-text" value={appeal} onChange={(event) => { setAppeal(event.target.value); setFeedback(""); }} rows={14} className="mt-2 w-full rounded-xl border border-input bg-background p-4 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><div role="group" aria-label={t.actionFeedback} className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!appeal.trim()} onClick={copyAppeal}><Clipboard />{t.copy}</Button><Button type="button" disabled={!appeal.trim()} onClick={downloadAppeal}><Download />{t.download}</Button></div><p aria-live="polite" role="status" className="mt-2 min-h-5 text-sm">{feedback}</p></CardContent></Card>
  </div>;
}
