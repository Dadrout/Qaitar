"use client";

import { ArrowRight, BookOpen, CheckCircle2, ExternalLink, Lightbulb, ShieldAlert, ShieldCheck } from "lucide-react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useLanguage } from "./language-provider";
import type { LegalRecommendation } from "../../types/qaitar.ts";

export function LegalResult({ recommendation, onPrepare }: { recommendation: LegalRecommendation; onPrepare: () => void }) {
  const { messages } = useLanguage();
  const found = recommendation.status === "legal_basis_found";

  return (
    <section className="px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
      <div className="mx-auto max-w-[940px]">
        <Badge className={`mb-4 rounded-full px-3 py-1.5 ${found ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-900 hover:bg-amber-100"}`}>
          {found ? <CheckCircle2 /> : <ShieldAlert />}
          {found ? messages.legal.found : messages.legal.review}
        </Badge>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-[-.045em] sm:text-[44px]">{recommendation.title}</h1>

        <div className="mt-8 space-y-7">
          <section aria-labelledby="case-summary-title">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><Lightbulb className="size-4" /></span>
              <h2 id="case-summary-title" className="text-xl font-semibold tracking-[-.025em]">{messages.legal.happened}</h2>
            </div>
            <Card className="rounded-[22px] border-border py-0 shadow-[0_10px_32px_rgba(20,39,78,.05)]">
              <CardContent className="p-5 sm:p-6">
                <p className="text-lg font-semibold leading-8">{recommendation.summary}</p>
                <div className="mt-4 border-t border-border pt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-muted-foreground">{messages.legal.explanation}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{recommendation.reasoning}</p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="legal-basis-title">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen className="size-4" /></span>
              <h2 id="legal-basis-title" className="text-xl font-semibold tracking-[-.025em]">{messages.legal.lawSays}</h2>
            </div>
            {recommendation.legalBasis.length ? (
              <div className="space-y-3">
                {recommendation.legalBasis.map((basis) => (
                  <Card key={`${basis.article}-${basis.sourceUrl}`} className="gap-0 rounded-[22px] border-border py-0 shadow-none transition-shadow duration-200 hover:shadow-[0_10px_28px_rgba(20,39,78,.06)]">
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4" /> {/^[0-9]/.test(basis.article) ? `${messages.legal.article} ${basis.article}` : basis.article}</div>
                          <h3 className="mt-2 font-semibold leading-6">{basis.lawName}</h3>
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{basis.explanation}</p>
                        </div>
                        <Button asChild variant="outline" className="shrink-0 rounded-xl bg-card">
                          <a href={basis.sourceUrl} target="_blank" rel="noreferrer">{messages.legal.officialSource} <ExternalLink /></a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-[22px] border-amber-200 bg-amber-50 py-0 shadow-none">
                <CardContent className="p-5 text-sm leading-6 text-amber-900">{messages.legal.noSource}</CardContent>
              </Card>
            )}
          </section>

          <section aria-labelledby="next-action-title">
            <div className="mb-3 flex items-center gap-2.5">
              <span className={`grid size-8 place-items-center rounded-xl ${found ? "bg-primary text-primary-foreground" : "bg-amber-100 text-amber-800"}`}><ArrowRight className="size-4" /></span>
              <h2 id="next-action-title" className="text-xl font-semibold tracking-[-.025em]">{messages.legal.whatNext}</h2>
            </div>
            <Card className={`overflow-hidden rounded-[26px] py-0 ${found ? "border-primary bg-primary text-primary-foreground shadow-[0_18px_44px_rgba(25,94,234,.22)]" : "border-amber-200 bg-amber-50 text-amber-950 shadow-none"}`}>
              <CardContent className="p-6 sm:p-8">
                <p className={`text-xs font-bold uppercase tracking-[.12em] ${found ? "text-primary-foreground/70" : "text-amber-800"}`}>{messages.legal.next}</p>
                <h3 className="mt-3 max-w-2xl text-2xl font-bold tracking-[-.035em] sm:text-3xl">{found ? messages.legal.sendClaim : messages.legal.needMore}</h3>
                <p className={`mt-3 max-w-2xl text-sm leading-6 ${found ? "text-primary-foreground/80" : "text-amber-800"}`}>{found ? messages.legal.sendClaimHint : messages.legal.needMoreHint}</p>
                {found && <Button onClick={onPrepare} size="lg" variant="secondary" className="mt-6 h-12 w-full rounded-xl bg-white text-primary hover:bg-white/90 sm:w-auto">{messages.legal.prepare} <ArrowRight /></Button>}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </section>
  );
}
