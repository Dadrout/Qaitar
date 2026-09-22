# Qaitar UI/UX Refinement Design

**Date:** 2026-09-22
**Status:** Approved for implementation planning

## Objective

Refine the existing Qaitar application into a polished, launch-ready AI LegalTech workflow without changing its business logic. A first-time user should understand within three seconds what evidence to upload, what Qaitar will do with it, and which concrete action will follow.

The visual story is:

> Evidence → confirmed facts → verified law → concrete action

The application continues to open directly into the product. No landing page, marketing content, fake statistics, or generic chat interface will be introduced.

## Scope and Constraints

The refinement covers the application shell and every existing workflow state:

- new case and evidence upload;
- problem selection;
- AI processing;
- extracted-fact review;
- legal result and verified sources;
- claim generation and document preview;
- seller-response analysis;
- case progress and next-action states;
- document analysis mode;
- desktop, tablet, and mobile layouts.

Existing Next.js routes, React state transitions, APIs, Gemini calls, Supabase integration, legal RAG, document handling, demo fallbacks, validation, and generated outputs remain unchanged. Small component rearrangements are allowed only when they make the visual hierarchy clearer. The implementation will use the existing Next.js, TypeScript, Tailwind CSS, shadcn/ui, and Lucide stack with no new UI framework.

## Recommended Approach

Use a workflow-first refinement rather than a cosmetic reskin or a component rewrite.

The current component boundaries remain recognizable. Each screen is restyled around one dominant action and the same progression model. Shared visual rules are expressed through the existing CSS variables and component class names; only repeated, meaningful patterns should become small shared components. This keeps the demo flow stable while materially improving perceived trust and product quality.

## Visual System

### Tone

The interface should feel calm, intelligent, premium, and trustworthy, with the restraint of a modern banking product. It must avoid government-portal density, generic dashboard chrome, heavy glass effects, large decorative gradients, and ornamental animation.

### Color and surfaces

- Use an off-white or very light blue-gray application background.
- Use dark navy for primary text and restrained blue for interactive emphasis.
- Preserve strong contrast for legal results and actions.
- Use white cards, 1 px cool-gray borders, soft shadows, and 16–24 px radii.
- Reserve faint blue gradients or tints for upload focus, selected states, and active AI processing.
- Use green only for completed or verified states and amber only for ambiguity or missing information.

### Typography and spacing

- Hero: 48–56 px desktop and no more than approximately 36 px at 390 px.
- Section headings: 28–32 px.
- Card headings: 18–20 px.
- Body: 15–16 px with comfortable line height.
- Metadata: 12–13 px.
- Follow an 8 px spacing rhythm, increase padding inside primary cards, and reduce oversized outer whitespace.

### Motion and interaction

- Use 150–250 ms transitions for hover, focus, selection, drag state, and newly revealed content.
- Active processing steps may pulse subtly; completed steps transition to checks.
- No animation may delay navigation or the demo.
- Respect `prefers-reduced-motion`.

## Application Shell

### Header

Use the supplied Qaitar wordmark as the primary brand element. The header contains:

- logo and the compact tagline “Доказательства → Закон → Действие” on larger screens;
- language control;
- “Мои дела”.

The header remains sticky, minimal, and high contrast. On narrow screens the tagline hides before the logo or actions become cramped.

### Sidebar

Reduce desktop width to approximately 232 px. Keep the three navigation entries:

- Новый случай;
- Мои дела;
- Разобрать документ.

Use a soft selected surface, precise icon alignment, and less enterprise-style visual weight. Below navigation, show the case workflow as a connected vertical stepper. The sidebar is hidden below the desktop breakpoint.

### Mobile navigation and progress

At mobile widths, retain the compact header and existing direct access to cases. Replace the vertical sidebar with a horizontal progress summary: current step, step count, and connected progress segments. No drawer is required because the existing header actions and primary workflow cover the available navigation.

## New Case Screen

### Hero hierarchy

Use:

- eyebrow: “НОВЫЙ СЛУЧАЙ”;
- headline: “Загрузите доказательства”;
- supporting copy: “Qaitar сам определит, что важно, проверит законодательство Казахстана и предложит следующий шаг.”

The copy sits close to the upload interaction and starts higher on the page. It should not become a marketing hero.

### Upload surface

The upload surface is the largest and most visually important component. It contains:

- upload icon;
- “Перетащите доказательства сюда”;
- accepted evidence examples;
- “Выбрать файлы” primary button;
- “Снять на камеру” secondary button;
- file formats and 10 MB limit;
- private-storage reassurance.

Hover and drag-over states increase border contrast and introduce a restrained blue tint. The drop zone remains fully operable through file inputs for keyboard and touch users.

Uploaded evidence appears inside the same primary surface as polished file cards. Each card shows an icon or thumbnail, truncated filename, detected type/status, and an accessible remove action. The section displays the number of attached files.

### Problem selector

Label the section “Что произошло?” and add “Выберите вариант или оставьте определение Qaitar”. Show five larger selectable scenario cards with concise descriptions. A selected card uses a blue border, soft blue surface, and check indicator. Cards use a two-column mobile layout where labels remain readable, two columns on tablet, and an appropriate multi-column desktop layout without forcing five narrow cards.

### Main action and trust

Place “Разобрать ситуацию” immediately after the problem selector, inside the same visual composition as upload and selection. It is full-width on mobile and prominent on desktop. The disabled state includes nearby helper text explaining that at least one evidence file is required.

Below the primary interaction, add a compact trust strip communicating:

- official Kazakhstan sources;
- citations to retrieved provisions;
- facts confirmed by the user.

The trust strip is informative, not a guarantee of legal outcomes.

## Workflow Progress

Use six user-facing stages:

1. Документы
2. Ситуация
3. Закон
4. Претензия
5. Ответ продавца
6. Следующий шаг

Completed stages use check indicators and a connected blue line. The current stage uses a filled blue indicator and stronger label. Upcoming stages use muted outline indicators. State names remain controlled by application logic; this is only a presentation mapping.

## AI Processing State

Replace spinner-led emphasis with a premium processing card titled “Qaitar разбирает ситуацию”. Retain sequential progress but present it as meaningful work:

- Читаем документы;
- Извлекаем факты;
- Проверяем законодательство;
- Готовим следующий шаг.

Only the active step pulses. Completed steps immediately become checks. Existing timings and API behavior stay intact.

## Fact Review

Present “Вот как Qaitar понял ситуацию” with the subtitle “Проверьте факты перед юридическим анализом.”

Use a calm review panel containing editable inline fields for seller, product, amount, purchase date, problem, and seller response. Retain source labels, including “Из документа”, “Со слов пользователя”, and “Вывод Qaitar”, without percentage-based confidence claims. Editing remains explicit and keyboard accessible.

The primary action becomes “Подтвердить и проверить закон”. It remains visually connected to the review panel.

## Legal Result and Next Action

Structure the screen into three clearly separated sections:

1. Что произошло
2. Что говорит закон
3. Что делать дальше

Legal basis cards show the verified status, law title, article, concise explanation or excerpt, and official-source link. They do not dump full legislation. If additional content exists, it may be exposed through an accessible “Показать подробнее” disclosure without changing the legal data model.

The next-action card is the dominant visual element. For the standard demo outcome it says “Направить письменную претензию продавцу”, explains that the draft uses confirmed facts and retrieved legal context, and presents “Подготовить претензию” as the primary action.

Ambiguous and insufficient-basis states retain the existing cautious language and must never resemble a success state.

## Claim Screen

Display the generated complaint as a professional A4-like sheet with realistic proportions, subtle paper shadow, and readable document typography. Place Edit, Copy, and Download PDF actions in a compact toolbar that remains reachable on mobile. Preserve the current editable content and PDF generation behavior. Legal references stay visible but visually subordinate to the requested remedy.

## Seller Response and Escalation

After upload, introduce the state with “Ответ продавца получен”. Present the structured result as one of accepted, rejected, additional information requested, or unclear. For refusals, make the new action card dominant: “Qaitar проверил отказ и нашёл следующий официальный шаг.”

The second legal search and state transitions remain unchanged. The UI must clearly separate the seller’s statement, Qaitar’s explanation, retrieved legal basis, and next action.

## Document Analysis Mode

Keep “Разобрать документ” as a secondary mode using the same surface, typography, and trust conventions. Its result retains the three sections “Что это?”, “Что важно?”, and “Что делать?”, followed by “Добавить в дело” when supported by existing behavior. Do not expand the mode’s feature scope.

## Responsive Behavior

Verify at 390, 768, 1024, and 1440 px.

At 390 px:

- no horizontal overflow;
- compact logo/header controls;
- hero no larger than approximately 36 px;
- upload buttons stack and remain at least 44 px tall;
- problem cards use one or two readable columns based on available width;
- progress collapses into the compact stepper;
- primary actions are full-width;
- A4 preview and toolbars scale without clipped controls.

At desktop widths, cap the overall content near 1280 px, use the 232 px sidebar, and keep the main interaction dense enough to fit naturally on a laptop viewport.

## Accessibility

- Preserve semantic buttons, labels, and inputs.
- Provide visible focus rings for all interactive elements.
- Maintain sufficient contrast in default, selected, disabled, success, and warning states.
- Keep drag-and-drop optional; file selection remains an equivalent path.
- Use descriptive labels for file removal and document actions.
- Do not communicate status using color alone.

## Implementation Boundaries

Expected changes are concentrated in:

- `app/globals.css`;
- `components/qaitar/app-shell.tsx`;
- `components/qaitar/new-case.tsx`;
- `components/qaitar/case-timeline.tsx`;
- `components/qaitar/analysis-progress.tsx`;
- `components/qaitar/case-review.tsx`;
- `components/qaitar/legal-result.tsx`;
- `components/qaitar/claim-editor.tsx`;
- `components/qaitar/seller-response.tsx`;
- `components/qaitar/document-workspace.tsx`;
- centralized Russian UI strings where copy changes require it.

No API contract, database schema, Gemini prompt, retrieval function, workflow state name, upload validation rule, or persistence behavior should change for this design.

## Verification

After implementation:

1. run `npm test`;
2. run `npm run typecheck`;
3. run `npm run lint`;
4. run `npm run build`;
5. exercise the seeded demo from upload through seller response;
6. verify desktop at 1440 px and mobile at 390 px;
7. spot-check 768 px and 1024 px layouts;
8. confirm no horizontal overflow, console errors, raw AI errors, inactive buttons, or regressions in Gemini/Supabase/RAG behavior.

## Acceptance Criteria

- The first screen communicates upload purpose, supported evidence, and the next outcome within three seconds.
- Upload is visually dominant and the primary CTA is directly connected to evidence and scenario selection.
- Progress is obvious on desktop and mobile.
- Facts, retrieved law, Qaitar explanation, and next action are visually distinct.
- The next action is the strongest visual moment after legal verification.
- All existing functional flows remain operational.
- The interface remains polished and usable at 390 px.
- The application presents no guarantee, fake probability, or unverified legal authority.
