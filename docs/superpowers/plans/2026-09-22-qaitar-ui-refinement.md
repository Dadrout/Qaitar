# Qaitar UI/UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Qaitar workflow into a polished, responsive LegalTech product whose evidence-to-action progression is immediately understandable without changing application logic.

**Architecture:** Preserve the existing React component and state-machine boundaries, refine the shared visual tokens, then update each workflow screen around a consistent hierarchy of context, verified information, and next action. Add source-level UI contract tests for critical copy, accessibility, and responsive classes, while keeping browser verification as the final authority for layout and interaction.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Lucide, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-22-qaitar-ui-refinement-design.md`

## Global Constraints

- Keep all existing routes, workflow state names, API contracts, Gemini calls, Supabase integration, RAG, upload validation, PDF generation, persistence, and demo fallbacks unchanged.
- Do not add a landing page, marketing content, fake probabilities, legal guarantees, stock photography, charts, another UI framework, or new runtime dependencies.
- Use the supplied `/public/qaitar-logo.png` wordmark.
- Keep the root route as the working product.
- Use only restrained blue accents, soft shadows, 1 px borders, 16–24 px surfaces, and 150–250 ms interaction transitions.
- Keep Russian as the polished demo language and centralize changed product copy in `lib/i18n/ru.ts` where the existing component already consumes centralized strings.
- Preserve keyboard navigation, visible focus, semantic controls, non-color status cues, and `prefers-reduced-motion` behavior.
- Verify at 390, 768, 1024, and 1440 px; 390 px must have no horizontal overflow.

## Review Focus

- A 390 px viewport must keep the logo, case button, upload controls, scenario cards, action buttons, and claim toolbar visible without horizontal overflow; Task 7 verifies all four target widths.
- A user with no files must see a disabled analysis button and an explicit nearby reason, while keyboard file selection remains available; Task 3 adds and verifies this contract.
- Drag enter/leave/drop must not interfere with file-picker and camera inputs, and invalid files must continue through existing validation; Task 3 preserves handlers and runs workflow tests.
- Legal outcomes without verified provisions must retain warning styling and must not expose a claim-generation CTA; Task 5 adds a source contract test and exercises the fallback state.
- Reduced-motion users must not receive long transitions or pulsing loaders; Task 1 verifies the global media rule and Task 7 checks computed behavior manually.

---

### Task 1: Visual Tokens and UI Contract Test Harness

**Files:**
- Modify: `app/globals.css`
- Create: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: existing CSS variables and Node test runner command `node --experimental-strip-types --test tests/*.test.ts`
- Produces: stable visual tokens and a reusable `readSource(relativePath: string): string` helper for source-level UI contracts

- [ ] **Step 1: Write the failing visual-token contract tests**

Create `tests/ui-contract.test.ts` with:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, `file://${root}`), "utf8");

test("uses the refined LegalTech visual tokens and reduced-motion guard", () => {
  const css = readSource("app/globals.css");
  assert.match(css, /--background:\s*#f6f8fc/);
  assert.match(css, /--foreground:\s*#142038/);
  assert.match(css, /--primary:\s*#195eea/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /transition-duration:\s*\.01ms/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL because the current token values do not match the refined palette.

- [ ] **Step 3: Refine the global tokens and base rendering**

Update `app/globals.css` so the root palette begins with these exact values while preserving the existing Tailwind mappings:

```css
:root {
  --background: #f6f8fc;
  --foreground: #142038;
  --card: #ffffff;
  --card-foreground: #142038;
  --primary: #195eea;
  --primary-foreground: #ffffff;
  --secondary: #edf3ff;
  --secondary-foreground: #164fc6;
  --muted: #eef2f7;
  --muted-foreground: #68758b;
  --border: #dce3ee;
  --input: #dce3ee;
  --ring: #195eea;
}
```

Keep destructive, popover, sidebar, and theme variables defined. Add font smoothing to `body`, preserve `text-rendering: optimizeLegibility`, and keep the existing reduced-motion rule.

- [ ] **Step 4: Run the focused and full tests**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the tokens and contract harness**

```bash
git add app/globals.css tests/ui-contract.test.ts
git commit -m "style: refine Qaitar visual tokens"
```

### Task 2: Compact Application Shell and Active Workflow Stepper

**Files:**
- Modify: `components/qaitar/app-shell.tsx`
- Modify: `components/qaitar/case-timeline.tsx`
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `AppShell` props unchanged; `getTimelineSteps(state)` returning `{ label, status }[]`
- Produces: 232 px desktop sidebar, wordmark/tagline header, vertical connected stepper, and compact mobile progress

- [ ] **Step 1: Add failing shell and progress contracts**

Append tests that assert:

```ts
test("renders the compact shell and evidence-to-action tagline", () => {
  const shell = readSource("components/qaitar/app-shell.tsx");
  assert.match(shell, /Доказательства → Закон → Действие/);
  assert.match(shell, /lg:grid-cols-\[232px_minmax\(0,1fr\)\]/);
  assert.match(shell, /qaitar-logo\.png/);
});

test("renders distinct completed, current, and upcoming timeline states", () => {
  const timeline = readSource("components/qaitar/case-timeline.tsx");
  assert.match(timeline, /aria-current/);
  assert.match(timeline, /step\.status === "complete"/);
  assert.match(timeline, /step\.status === "current"/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL on the tagline, 232 px grid, and `aria-current` assertions.

- [ ] **Step 3: Refine `AppShell` without changing navigation behavior**

Keep all callbacks and view-state logic unchanged. Adjust the maximum shell width to approximately `1280px`, use `lg:grid-cols-[232px_minmax(0,1fr)]`, reduce aside padding, and render this next to the logo on `sm` and larger screens:

```tsx
<span className="hidden border-l border-border pl-4 text-xs font-medium text-muted-foreground sm:block">
  Доказательства → Закон → Действие
</span>
```

Retain language and cases actions. Give the active navigation item a blue-tinted surface and a subtle inset border without changing `Button` semantics.

- [ ] **Step 4: Refine desktop and mobile timeline presentation**

Keep `getTimelineSteps(state)` as the only source of progress. Add `aria-current={step.status === "current" ? "step" : undefined}` to the active item, make the current indicator filled blue, completed indicators checked, upcoming indicators outlined, and keep a visible connecting line. On mobile show current label, `N/6`, and six progress segments with at least one text status cue.

- [ ] **Step 5: Run tests, typecheck, and lint**

Run: `npm test && npm run typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit shell and progress**

```bash
git add components/qaitar/app-shell.tsx components/qaitar/case-timeline.tsx tests/ui-contract.test.ts
git commit -m "style: strengthen Qaitar workflow shell"
```

### Task 3: Evidence-First New Case Experience

**Files:**
- Modify: `components/qaitar/new-case.tsx`
- Modify: `lib/i18n/ru.ts`
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: existing `NewCase` props and `validateUpload(file)` behavior unchanged
- Produces: dominant evidence surface, explicit file count, scenario selector, connected primary CTA, and trust strip

- [ ] **Step 1: Add failing first-screen contracts**

Append:

```ts
test("makes the first screen evidence-first and explains the disabled action", () => {
  const screen = readSource("components/qaitar/new-case.tsx");
  assert.match(screen, /Загрузите доказательства/);
  assert.match(screen, /Что произошло\?/);
  assert.match(screen, /files\.length === 0.*Добавьте хотя бы один файл/s);
  assert.match(screen, /Проверяем по официальным источникам Казахстана/);
  assert.match(screen, /aria-pressed=\{selected\}/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL because the new hierarchy, trust copy, helper, and `aria-pressed` state are absent.

- [ ] **Step 3: Update centralized Russian copy**

Set the primary copy in `lib/i18n/ru.ts` to:

```ts
eyebrow: "Новый случай",
title: "Загрузите доказательства",
subtitle: "Qaitar сам определит, что важно, проверит законодательство Казахстана и предложит следующий шаг.",
dropTitle: "Перетащите доказательства сюда",
dropHint: "Чек, переписка, PDF, фото товара или ответ продавца",
```

Keep all keys consumed elsewhere and keep the five existing problem IDs unchanged.

- [ ] **Step 4: Recompose the upload and evidence surface**

In `NewCase`, preserve the two hidden inputs, capture behavior, drag handlers, six-file cap, and `validateUpload`. Make the card visually dominant, add a file-count label such as `${evidence.length} из 6`, render evidence cards inside the surface, and keep remove buttons labelled with the filename. Use `duration-200` transitions and a stronger drag state without decorative delay.

- [ ] **Step 5: Improve problem selection and action hierarchy**

Render “Что произошло?” and “Выберите вариант или оставьте определение Qaitar”. Add `aria-pressed={selected}` to each scenario button and show a check indicator in its selected state. Use readable responsive columns rather than five narrow desktop cards. Place the primary action immediately after the selector and render this helper when no file exists:

```tsx
{files.length === 0 && (
  <p className="text-sm text-muted-foreground">Добавьте хотя бы один файл, чтобы начать разбор.</p>
)}
```

- [ ] **Step 6: Add the compact trust strip**

Add three non-guarantee items below the action:

```tsx
[
  "Проверяем по официальным источникам Казахстана",
  "Показываем ссылки на нормы",
  "Просим подтвердить извлечённые факты",
]
```

Use restrained icons and stack the strip on mobile.

- [ ] **Step 7: Run workflow and UI tests**

Run: `npm test && npm run typecheck && npm run lint`

Expected: upload-validation, state-machine, and UI contract tests all PASS.

- [ ] **Step 8: Commit the new-case refinement**

```bash
git add components/qaitar/new-case.tsx lib/i18n/ru.ts tests/ui-contract.test.ts
git commit -m "style: make evidence upload the primary Qaitar action"
```

### Task 4: Premium Processing and Confirmed-Fact Review

**Files:**
- Modify: `components/qaitar/analysis-progress.tsx`
- Modify: `components/qaitar/case-review.tsx`
- Modify: `lib/i18n/ru.ts`
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `AnalysisProgress` phase union and `CaseReview` callback signatures unchanged
- Produces: meaningful animated progress and a source-aware editable fact panel with a connected confirmation action

- [ ] **Step 1: Add failing processing and review contracts**

Append:

```ts
test("labels AI work and fact confirmation as explicit workflow stages", () => {
  const progress = readSource("components/qaitar/analysis-progress.tsx");
  const review = readSource("components/qaitar/case-review.tsx");
  assert.match(progress, /Qaitar разбирает ситуацию/);
  assert.match(progress, /aria-live="polite"/);
  assert.match(review, /Проверьте факты перед юридическим анализом/);
  assert.match(review, /Подтвердить и проверить закон/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL on the revised title, live region, subtitle, and CTA.

- [ ] **Step 3: Refine `AnalysisProgress`**

Keep interval timing and phase message arrays unchanged. Change the title to “Qaitar разбирает ситуацию”, add `aria-live="polite"` to the progress list, replace the active spinner emphasis with a subtle pulse/dot treatment, retain checks for completed work, and use the existing progress bar as a secondary cue.

- [ ] **Step 4: Refine `CaseReview`**

Keep `analysis.facts`, editing state, date handling, missing-information rendering, and callbacks unchanged. Recompose the summary and fields into one polished review surface, keep visible source labels, and use the subtitle “Проверьте факты перед юридическим анализом.” Change only the user-facing CTA text to “Подтвердить и проверить закон”.

- [ ] **Step 5: Run tests, typecheck, and lint**

Run: `npm test && npm run typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 6: Commit processing and review**

```bash
git add components/qaitar/analysis-progress.tsx components/qaitar/case-review.tsx lib/i18n/ru.ts tests/ui-contract.test.ts
git commit -m "style: clarify AI analysis and fact confirmation"
```

### Task 5: Verified Legal Result and Dominant Next Action

**Files:**
- Modify: `components/qaitar/legal-result.tsx`
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `LegalRecommendation` and `onPrepare()` unchanged
- Produces: three-part legal-result hierarchy and a dominant next-action card that appears only for `legal_basis_found`

- [ ] **Step 1: Add failing legal-result contracts**

Append:

```ts
test("separates facts, law, and next action without offering unsupported claims", () => {
  const result = readSource("components/qaitar/legal-result.tsx");
  assert.match(result, /Что произошло/);
  assert.match(result, /Что говорит закон/);
  assert.match(result, /Что делать дальше/);
  assert.match(result, /found &&.*onPrepare/s);
  assert.match(result, /Официальный источник/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL on the three section labels and official-source copy.

- [ ] **Step 3: Recompose `LegalResult`**

Keep `found` derived only from `recommendation.status === "legal_basis_found"`. Render concise sections labelled “Что произошло”, “Что говорит закон”, and “Что делать дальше”. Put legal basis before the action on narrow screens and use a dominant blue-tinted action card with “Направить письменную претензию продавцу” for the found state. Keep the fallback amber, keep its no-reliable-basis copy, and never render `onPrepare` when `found` is false.

- [ ] **Step 4: Polish official-source cards**

Keep each `basis.sourceUrl`, law name, article, and explanation unchanged. Add a verified-source icon and visible “Официальный источник” link text. Do not manufacture excerpts or alter the legal payload.

- [ ] **Step 5: Run legal safety and UI tests**

Run: `npm test && npm run typecheck && npm run lint`

Expected: source-validation, no-reliable-basis, and UI contract tests PASS.

- [ ] **Step 6: Commit the result hierarchy**

```bash
git add components/qaitar/legal-result.tsx tests/ui-contract.test.ts
git commit -m "style: foreground verified law and next action"
```

### Task 6: Document Preview, Seller Response, and Büro Consistency

**Files:**
- Modify: `components/qaitar/claim-editor.tsx`
- Modify: `components/qaitar/seller-response.tsx`
- Modify: `components/qaitar/document-workspace.tsx`
- Modify: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: all existing props, form state, clipboard call, `downloadClaimPdf`, seller-response analysis, and document-analysis callbacks unchanged
- Produces: A4-like claim preview, explicit seller-response state, and consistent secondary document-analysis surfaces

- [ ] **Step 1: Add failing document-flow contracts**

Append:

```ts
test("presents generated and incoming documents as actionable workflow artifacts", () => {
  const claim = readSource("components/qaitar/claim-editor.tsx");
  const response = readSource("components/qaitar/seller-response.tsx");
  const bureau = readSource("components/qaitar/document-workspace.tsx");
  assert.match(claim, /aspect-\[1\/1\.414\]/);
  assert.match(claim, /aria-label="Действия с претензией"/);
  assert.match(response, /Ответ продавца получен/);
  assert.match(response, /следующий официальный шаг/i);
  assert.match(bureau, /Что это\?/);
  assert.match(bureau, /Что важно\?/);
  assert.match(bureau, /Что делать\?/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --experimental-strip-types --test tests/ui-contract.test.ts`

Expected: FAIL on the A4 ratio, toolbar label, and seller-response framing.

- [ ] **Step 3: Build the A4-like claim presentation**

Keep the consumer form and generation behavior unchanged. For a generated claim, place the textarea inside a centered white paper surface using `aspect-[1/1.414]` on desktop, a suitable mobile minimum height, restrained shadow, and document typography. Wrap edit/copy/download controls in a toolbar with `aria-label="Действия с претензией"`; retain the add-response action and make all mobile buttons full-width or wrapping without clipping.

- [ ] **Step 4: Refine seller-response hierarchy**

Keep response-type handling and callbacks unchanged. Lead analyzed responses with “Ответ продавца получен”, retain accepted/rejected visual distinctions, label seller reason separately from Qaitar explanation, and make the legal follow-up card say “Qaitar проверил отказ и нашёл следующий официальный шаг.” only when a recommendation exists.

- [ ] **Step 5: Align document-analysis mode**

Keep file input, accepted formats, analysis call, error behavior, and result data unchanged. Apply the same upload surface, section typography, card radii, and action hierarchy as the primary workflow. Preserve the three output labels exactly: “Что это?”, “Что важно?”, and “Что делать?”.

- [ ] **Step 6: Run tests, typecheck, and lint**

Run: `npm test && npm run typecheck && npm run lint`

Expected: all commands exit 0.

- [ ] **Step 7: Commit document-flow polish**

```bash
git add components/qaitar/claim-editor.tsx components/qaitar/seller-response.tsx components/qaitar/document-workspace.tsx tests/ui-contract.test.ts
git commit -m "style: polish Qaitar document workflows"
```

### Task 7: Responsive Browser Verification and Production Gate

**Files:**
- Modify only if verification identifies a concrete defect: files changed in Tasks 1–6
- Modify: `tests/ui-contract.test.ts` only when a discovered regression requires a permanent contract

**Interfaces:**
- Consumes: completed UI and existing seeded demo flow
- Produces: verified 390/768/1024/1440 layouts, passing production build, and documented defect fixes

- [ ] **Step 1: Run the automated quality gate**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0; the build includes `/` and existing API routes without new warnings attributable to the UI work.

- [ ] **Step 2: Start the production-equivalent local server**

Run: `npm run dev`

Expected: Next.js reports a local URL and the root route opens directly into “Новый случай”. Keep the terminal session alive for browser verification.

- [ ] **Step 3: Verify the first screen at four widths**

At 390, 768, 1024, and 1440 px, check:

```text
- no horizontal overflow
- wordmark is legible and header actions do not collide
- upload is the dominant surface above the fold
- file-picker and camera controls are visible and tappable
- scenario cards remain readable
- disabled CTA explains why it is disabled
- mobile progress is visible below the header
- desktop sidebar is approximately 232 px and its active step is obvious
```

Expected: all checks pass. For each defect, first add a source contract when practical, reproduce it, then make the smallest responsive-class correction.

- [ ] **Step 4: Exercise the complete seeded demo**

Run the in-app demo through:

```text
New case → demo evidence → processing → fact confirmation → legal result
→ claim form → generated claim → seller response → response analysis → next action
```

Expected: every existing button works, no raw server error appears, legal sources remain clickable, claim copy/PDF actions remain available, and progress advances with application state.

- [ ] **Step 5: Check accessibility and motion**

Using keyboard navigation and reduced-motion emulation, verify:

```text
- every navigation, scenario, upload, remove, edit, source, and primary-action control receives visible focus
- selected scenarios expose pressed state
- active timeline item exposes aria-current=step
- processing updates are announced through aria-live=polite
- reduced motion collapses transitions and animation duration
```

Expected: no keyboard trap, focus loss, color-only state, or persistent motion.

- [ ] **Step 6: Inspect runtime health**

Check the browser console and network panel during the demo.

Expected: no React hydration errors, uncaught exceptions, failed local asset requests, or new API requests caused by purely visual components.

- [ ] **Step 7: Re-run the production gate after any fixes**

Run: `npm test && npm run typecheck && npm run lint && npm run build`

Expected: every command exits 0.

- [ ] **Step 8: Commit final responsive fixes**

```bash
git add app/globals.css components/qaitar lib/i18n/ru.ts tests/ui-contract.test.ts
git commit -m "fix: complete responsive Qaitar UI verification"
```
