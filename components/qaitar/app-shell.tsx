"use client";

import Image from "next/image";
import { FileSearch, FolderOpen, Languages, Plus } from "lucide-react";

import { Button } from "../ui/button";
import { useLanguage } from "./language-provider";
import { CaseTimeline } from "./case-timeline";

type View = "workflow" | "cases" | "document";

export function AppShell({
  children,
  view,
  state,
  onView,
  onNew,
}: {
  children: React.ReactNode;
  view: View;
  state: string | null;
  onView: (view: View) => void;
  onNew: () => void;
}) {
  const { locale, setLocale, messages } = useLanguage();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <button onClick={() => onView("workflow")} className="flex min-w-0 items-center gap-4 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Image
              src="/qaitar-logo.png"
              alt={messages.brand.name}
              width={544}
              height={231}
              priority
              className="h-auto w-[112px] shrink-0 sm:w-[132px]"
            />
            <span className="hidden border-l border-border pl-4 text-xs font-medium text-muted-foreground md:block">
              {messages.brand.promise}
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 text-sm focus-within:ring-2 focus-within:ring-primary/30"><Languages aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="sr-only">Language / Тіл / Язык</span><select aria-label="Language / Тіл / Язык" value={locale} onChange={(event) => setLocale(event.target.value as typeof locale)} className="h-9 w-[76px] cursor-pointer bg-transparent text-xs font-medium outline-none sm:w-[100px] sm:text-sm"><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></label>
            <Button variant="outline" size="sm" onClick={() => onView("cases")} className="rounded-xl"><FolderOpen /> <span className="hidden sm:inline">{messages.nav.cases}</span></Button>
          </div>
        </div>
      </header>
      {view === "workflow" && state && <CaseTimeline state={state} compact />}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] border-r border-border/80 bg-card px-4 py-6 lg:flex lg:flex-col">
          <nav className="space-y-1">
            <Button onClick={onNew} variant="ghost" className={`h-11 w-full justify-start rounded-xl px-3 ${view === "workflow" ? "bg-primary/[.07] text-primary shadow-[inset_0_0_0_1px_rgba(25,94,234,.12)] hover:bg-primary/10" : "text-muted-foreground"}`}><Plus /> {messages.nav.newCase}</Button>
            <Button onClick={() => onView("cases")} variant="ghost" className={`h-11 w-full justify-start rounded-xl px-3 ${view === "cases" ? "bg-primary/[.07] text-primary shadow-[inset_0_0_0_1px_rgba(25,94,234,.12)] hover:bg-primary/10" : "text-muted-foreground"}`}><FolderOpen /> {messages.nav.cases}</Button>
            <Button onClick={() => onView("document")} variant="ghost" className={`h-11 w-full justify-start rounded-xl px-3 ${view === "document" ? "bg-primary/[.07] text-primary shadow-[inset_0_0_0_1px_rgba(25,94,234,.12)] hover:bg-primary/10" : "text-muted-foreground"}`}><FileSearch /> {messages.nav.document}</Button>
          </nav>
          <div className="my-7 h-px bg-border" />
          {view === "workflow" && state && <CaseTimeline state={state} />}
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
