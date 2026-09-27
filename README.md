# Qaitar

Qaitar is an action-oriented consumer-rights assistant for Kazakhstan. A user uploads evidence, confirms extracted facts, receives a recommendation grounded in verified official sources, generates a complaint, and tracks the seller response through a deterministic case workflow.

The root route is the application itself. There is no marketing landing page.

## Stack

- Next.js 16, React 19, TypeScript, App Router
- Tailwind CSS, shadcn/ui, Lucide icons
- Google Gen AI SDK with Gemini multimodal models and structured JSON output
- Supabase PostgreSQL, private Storage, pgvector, and hybrid vector/full-text retrieval
- Zod validation and `pdf-lib` complaint export

## Local setup

Requirements: Node.js 22.13 or newer and a Supabase project.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes for real analysis | Server-only Gemini API key |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.8-flash` |
| `GEMINI_ANALYSIS_MODEL` | No | Low-latency document and seller-response analysis; defaults to `gemini-2.5-flash-lite` |
| `GEMINI_ANALYSIS_FALLBACK_MODEL` | No | Used after a timeout or temporary provider failure; defaults to `gemini-3.5-flash` |
| `GEMINI_EMBEDDING_MODEL` | No | Defaults to `gemini-embedding-2` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for browser uploads | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes for signed browser uploads | Public key; reaches only what grants and RLS permit |
| `SUPABASE_URL` | Yes for persistence/RAG | Server-side Supabase project URL |
| `SUPABASE_SECRET_KEY` | Yes for server operations | Server-only key for private storage and legal retrieval |
| `SUPABASE_JWKS_URL` | Optional until Auth is enabled | Server-side URL for JWT verification |

Never expose `GEMINI_API_KEY` or `SUPABASE_SECRET_KEY` in browser code or client logs. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` remain supported for older projects.

## Gemini setup

1. Create a Gemini API key in Google AI Studio.
2. Add it to `GEMINI_API_KEY` in `.env.local`.
3. Keep Gemini calls in `lib/ai/` or server routes. The browser never calls Gemini directly.

All workflow-critical model responses use JSON schemas and are validated with Zod. When Qaitar cannot retrieve a reliable legal basis, it returns the safe fallback instead of answering from model memory.

Document and seller-response file analysis use minimal thinking and a 20-second request timeout per model. If the primary model times out or is temporarily unavailable, Qaitar tries the configured analysis fallback once and then shows a retryable error. Keep both model names available to your Gemini account.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run:

   `supabase/migrations/202609210001_qaitar.sql`

3. Add the project URL, anon key, and service-role key to `.env.local`.

The migration creates the case, document, event, legal corpus, and generated-document tables; enables pgvector; adds vector/full-text indexes; creates a private `case-documents` bucket; enables RLS; and exposes the hybrid search function only to the service role.

Uploads are validated in the browser and on the server. With Supabase configured, files are uploaded directly to a private bucket using short-lived signed tokens, which keeps large documents out of the Vercel Function request body. Files are never public by default.

## Legal corpus and pgvector

The starter corpus in `data/legal/consumer-rights.ru.json` intentionally covers a narrow, manually verified MVP slice of Kazakhstan consumer law. It includes Articles 42-4 and 42-5 on the seller claim and official appeal, plus government guidance naming the regional consumer-protection department and eOtinish. Review each text, official link, and effective date before a production rollout.

After the migration and environment setup, create embeddings and ingest the corpus:

```bash
npm run legal:ingest
```

Retrieval uses a 768-dimensional Gemini embedding plus PostgreSQL Russian full-text search. Only chunks whose source URL is on an official Kazakhstan government domain are passed into legal reasoning.

To add a source:

1. Verify it on `adilet.zan.kz` or `gov.kz`.
2. Add a focused article or section to the JSON corpus with its official URL and effective date.
3. Re-run `npm run legal:ingest`.

The ingestion command is required after every corpus change; editing the JSON alone does not update Supabase retrieval. Qaitar prepares an appeal and links to eOtinish when the procedure is supported, but the user must submit it manually and save the submission confirmation.

## Demo mode

Click **«Добавить демо-документы»** on the first screen, then **«Разобрать ситуацию»**. Demo mode uses a deterministic cached scenario, legal basis, complaint data, and seller rejection so the complete two-minute presentation still works without Gemini or Supabase.

The fallback activates only when the explicit demo flag is set and the exact demo file names are present. Ordinary uploads never receive demo results silently.

For the full demo, leave the seeded case facts unchanged, confirm them, generate the claim, mark it sent, and choose the demo seller rejection. The demo's official action plan draws only on the bundled curated Article 42-4/42-5 and eOtinish sources. If a demo fact is edited, Qaitar requires a fresh legal check rather than reusing the preset recommendation.

## Seller response and saved cases

After sending a claim, choose one of three seller-response modes: upload a PDF or image of the reply, paste the reply text, or record that there was no response. For no response, record when the claim was sent and the confirmed date the seller received it. The ten-calendar-day reply period starts the following day and runs through the end of day ten in Kazakhstan time; without a verified receipt date, Qaitar asks for manual verification rather than presenting a ready appeal.

Cases are saved in the browser under `qaitar.cases.v2`. On first load, Qaitar migrates a usable `qaitar.current-case.v1` case into the v2 collection, then supports switching between saved cases. This history is local to that browser and is not an account backup; keep copies of important documents and submissions separately. Deleting a case asks for confirmation.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Deploy to Vercel

1. Import the repository into Vercel.
2. Add the environment variables listed above to Preview and Production.
3. Deploy with the standard Next.js build command: `npm run build`.
4. Apply the Supabase migration and ingest the legal corpus before enabling real legal analysis.

No additional Vercel configuration is required for the MVP. Large file uploads use signed Supabase Storage URLs; API routes receive only paths and structured metadata.

## Security notes

- Uploaded evidence is stored in a private bucket.
- Server routes validate type, count, size, and request shape.
- Service-role and Gemini keys are server-only.
- RLS is enabled on every exposed table, with client access denied for the anonymous MVP.
- Qaitar does not log full uploaded documents.
- The legal recommendation UI separates document facts, retrieved law, Qaitar's explanation, and the next action.

Qaitar is an informational service based on official sources and is not a substitute for professional legal advice.
