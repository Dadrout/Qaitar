"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

import { Card, CardContent } from "../ui/card";
import { ru } from "../../lib/i18n/ru.ts";

export function AnalysisProgress({ phase }: { phase: "analysis" | "legal" | "response" }) {
  const messages = ru.progress[phase];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setActive((value) => Math.min(value + 1, messages.length - 1)), 850);
    return () => window.clearInterval(interval);
  }, [messages]);

  return (
    <div className="mx-auto flex min-h-[560px] max-w-3xl items-center justify-center px-5 py-10">
      <Card className="w-full overflow-hidden rounded-[28px] border-border py-0 shadow-[0_24px_70px_rgba(20,39,78,.10)]">
        <div className="h-1 bg-muted"><div className="h-full bg-primary transition-all duration-700" style={{ width: `${((active + 1) / messages.length) * 100}%` }} /></div>
        <CardContent className="p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
            <div><p className="text-xl font-semibold tracking-[-.025em]">Qaitar разбирает ситуацию</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Сверяем документы, факты и официальные источники по шагам.</p></div>
          </div>
          <div className="space-y-2.5" aria-live="polite">
            {messages.map((message, index) => (
              <div key={message} className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 ${index === active ? "border-primary/30 bg-primary/[.055] text-foreground shadow-[0_8px_22px_rgba(25,94,234,.07)]" : index < active ? "border-transparent bg-muted/60 text-foreground" : "border-transparent text-muted-foreground/60"}`}>
                <span className={`grid size-7 place-items-center rounded-full ${index < active ? "bg-emerald-100 text-emerald-700" : index === active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-muted text-muted-foreground"}`}>
                  {index < active ? <Check className="size-4" /> : <span className={`size-2 rounded-full bg-current ${index === active ? "animate-pulse" : ""}`} />}
                </span>
                <span className="text-sm font-medium sm:text-base">{message}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
