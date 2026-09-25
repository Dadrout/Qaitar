# Qaitar Workflow Reliability Design

## Product outcome

Qaitar must guide a Kazakhstan consumer through one uninterrupted flow: describe the problem, upload evidence, verify extracted facts, prepare a claim, record the seller's response or silence, and receive a detailed official next step grounded in verified sources.

The change keeps the current visual system and focuses on workflow correctness, useful detail, recoverability, and clear actions. It also turns “Мои дела” into a real local case history without adding authentication.

## User journey

### 1. Describe the problem and add evidence

The first screen keeps the existing problem-category cards and adds a multiline “Опишите, что произошло своими словами” field.

- A category and description are stored separately as `problemType` and `problemDescription`.
- The description is optional for the four predefined categories and required when `problemType === "other"`.
- The user may upload evidence before or after entering the description.
- The Analyze action requires at least one valid file and a valid problem selection. “Other” additionally requires a non-empty description.
- The exact user description becomes the `issue` fact with `source=user`; a category label is only a fallback when the description is empty.
- The description is included in document analysis, legal search, claim generation, persistence, and case restoration.

### 2. Review and prepare the claim

Document extraction remains separate from user-provided facts. The review screen shows the user's exact issue text and allows it to be edited. Editing updates both the case analysis and saved problem description.

The legal recommendation continues to cite only retrieved official sources. If evidence is insufficient, the UI explains what is missing and does not offer an unsupported claim or appeal.

The generated claim remains editable, copyable, and downloadable as PDF. After the claim is prepared, the user explicitly moves to the waiting-for-response stage.

### 3. Record the seller response

The seller-response stage offers three mutually exclusive inputs:

1. Upload one PDF, JPG, PNG, or WEBP file.
2. Paste or type the seller's response.
3. Mark “Продавец не ответил”.

File selection immediately shows the chosen file, validation result, replacement/removal controls, and the enabled Analyze action. Files with an empty browser MIME type are normalized from their extension before validation and AI submission.

Text input is validated for a useful non-empty value and sent as text, without fabricating a file. The no-response option records the date the original claim was sent; the app determines whether the verified statutory waiting period has elapsed. If the send date is missing, it requests the date instead of guessing.

Submission passes through `SELLER_RESPONSE_UPLOADED` before classification. On failure, the selected file or entered text remains intact and the user receives a specific retryable error. The action is disabled while a request is active to prevent duplicate submissions.

Seller-response analysis uses the low-latency model configuration already used for document extraction, a bounded output schema, timeout, and model fallback. It must distinguish accepted, rejected, additional-information-requested, unclear, and no-response paths.

### 4. Show the official next step

After a rejection or elapsed no-response deadline, Qaitar produces an `OfficialActionPlan` grounded only in retrieved official Kazakhstan sources:

- destination authority and why it is appropriate;
- submission channels, prioritizing eOtinish and including another verified channel only when supported;
- relevant deadline or waiting period with a source;
- required attachments derived from the case and official requirements;
- ordered checklist;
- source-backed explanation and official links;
- editable draft appeal.

The UI presents the plan as a full workflow section, not a short card. The primary actions are “Скопировать обращение”, “Скачать PDF”, and “Открыть eOtinish”. External submission remains user-controlled; Qaitar does not submit on the user's behalf.

If the source corpus cannot verify the authority, deadline, or route, those fields are shown as requiring manual verification and no definitive legal claim is made. An accepted seller response instead shows an execution checklist. Requests for more information show only the requested-document workflow. Unclear responses ask the user to obtain clarification.

## Data model and interfaces

`QaitarCase` gains:

- `problemDescription: string`;
- `claimSentAt: string | null`;
- `sellerResponseInput`, containing mode (`file`, `text`, or `no_response`), display metadata, and submitted date;
- `officialActionPlan: OfficialActionPlan | null`.

`OfficialActionPlan` contains status, title, authority, submission channels, deadline guidance, ordered steps, required attachments, legal basis, editable appeal text, confidence, and missing information. Every authoritative deadline or procedure must be traceable to a `LegalBasis.sourceUrl` from the retrieval result.

The analyze-document request accepts `problemDescription` in both multipart and signed-upload JSON modes. The seller-response endpoint accepts a discriminated request: multipart for a file, JSON for pasted text or no response. Both return a common response analysis plus an optional official action plan.

The local persistence key advances from `qaitar.current-case.v1` to a versioned case collection. On first load, the existing single case is migrated into the collection. Files themselves are not serialized; stored evidence retains metadata and storage paths when available. The case list supports open, continue, and delete. Starting a new case never silently deletes an older saved case.

## Workflow states

Application code remains the sole owner of transitions. The normal paths are:

`NEW_CASE → FILES_UPLOADED → DOCUMENTS_ANALYZED → CASE_CONFIRMED → LEGAL_SEARCH_COMPLETED → LEGAL_BASIS_FOUND → CLAIM_READY → CLAIM_GENERATED → WAITING_FOR_RESPONSE`

Then:

- response supplied: `WAITING_FOR_RESPONSE → SELLER_RESPONSE_UPLOADED → SELLER_ACCEPTED | SELLER_REJECTED | WAITING_FOR_RESPONSE`;
- no response and deadline elapsed: `WAITING_FOR_RESPONSE → SELLER_RESPONSE_UPLOADED → SELLER_REJECTED` with a no-response reason;
- escalation: `SELLER_REJECTED → ESCALATION_READY` only when a source-backed action plan exists;
- successful resolution: `SELLER_ACCEPTED → RESOLVED`;
- retryable failures do not advance state.

The timeline derives its current/completed status from these transitions and uses localized labels from the active locale.

## Error and trust behavior

- Upload errors identify the affected file and preserve the rest of the form.
- Provider overload, timeout, malformed AI output, unsupported file, missing context, and missing legal basis have distinct user-facing messages.
- Retryable actions preserve input and expose a Retry button.
- Raw document content, pasted seller responses, and personal data are never logged.
- Timing logs contain only phase, duration, file count, model, and outcome.
- AI extraction never invents dates, deadlines, authorities, or legal provisions.
- Russian, Kazakh, and English follow the same data and state logic; all new UI copy is localized.

## Local case history

“Мои дела” lists locally saved cases ordered by `updatedAt`, showing product or user description, current stage, and last update. Users can continue or delete a case. Deletion requires confirmation and removes only the selected local record; private uploaded objects are not automatically deleted unless a future authenticated storage lifecycle is added.

The current cycle does not add authentication, cross-device synchronization, automatic government submission, or server-side multi-user case ownership.

## Verification and acceptance criteria

- Predefined category with no description remains valid; “Other” without description is blocked with a clear message.
- The exact problem description survives analysis, review edits, refresh, case switching, claim generation, and legal analysis.
- Seller-response file upload works with normal and empty browser MIME types and preserves the selected file after a failed request.
- Pasted response and no-response paths work without creating fake files.
- Duplicate Analyze clicks produce one request.
- Every successful response submission visibly passes through the uploaded state and ends in the correct classified state.
- Rejection and eligible no-response paths produce a detailed, source-backed official action plan and editable appeal; unsupported paths use a safe fallback.
- The official plan includes verified attachments and submission guidance, with direct official-source links.
- Existing `v1` local data migrates once and remains usable; multiple new cases can be created, opened, and deleted independently.
- Timeline and restored screen always agree with case state.
- Unit tests cover validation, state transitions, migration, input modes, action-plan schema, source allowlisting, and error mapping.
- Browser tests cover the full desktop and mobile journey for file response, pasted response, no response, retry, refresh, and case switching.
- `npm test`, typecheck, lint, production build, and real low-risk provider smoke tests pass before completion.
