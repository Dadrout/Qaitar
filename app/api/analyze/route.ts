import { randomUUID } from "node:crypto";

import { z } from "zod";

import { analyzeDocument } from "../../../lib/ai/analyze-document.ts";
import { buildCase } from "../../../lib/ai/build-case.ts";
import { getAIUserMessage } from "../../../lib/ai/gemini.ts";
import type { CaseAnalysisOutput } from "../../../lib/ai/schemas.ts";
import { getDemoCaseAnalysis, isSeededDemo } from "../../../lib/demo/scenario.ts";
import { normalizeLocale } from "../../../lib/i18n/index.ts";
import { getServerSupabase } from "../../../lib/supabase/server.ts";
import { uploadEvidence } from "../../../lib/supabase/storage.ts";
import { MAX_FILES, validateUpload } from "../../../lib/workflow.ts";

export const runtime = "nodejs";

function elapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

const storedRequestSchema = z.object({
  caseId: z.string().uuid(),
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
  problemType: z.string().max(80).optional(),
  problemDescription: z.string().trim().max(2_000).default(""),
  files: z.array(z.object({
    name: z.string().min(1).max(255),
    type: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().positive().max(10 * 1024 * 1024),
    path: z.string().min(1),
  })).min(1).max(MAX_FILES),
});

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const input = storedRequestSchema.parse(await request.json());
      if (input.files.some((file) => !file.path.startsWith(`${input.caseId}/`))) {
        return Response.json({ error: "Некорректный путь загрузки" }, { status: 400 });
      }
      const supabase = getServerSupabase();
      const documents = await Promise.all(input.files.map(async (file) => {
        const { data, error } = await supabase.storage.from("case-documents").download(file.path);
        if (error) throw error;
        const analysis = await analyzeDocument({
          name: file.name,
          mimeType: file.type,
          base64: Buffer.from(await data.arrayBuffer()).toString("base64"),
        });
        return { fileName: file.name, storagePath: file.path, ...analysis };
      }));
      const documentsReadyAt = performance.now();
      const analysis = await buildCase(documents, {
        problemType: input.problemType as CaseAnalysisOutput["caseType"] | undefined,
        problemDescription: input.problemDescription,
        locale: input.locale,
      });
      console.info("Document analysis completed", {
        fileCount: documents.length,
        documentAnalysisMs: Math.round(documentsReadyAt - requestStartedAt),
        caseAssemblyMs: elapsedMs(documentsReadyAt),
        totalMs: elapsedMs(requestStartedAt),
      });
      return Response.json({ caseId: input.caseId, demo: false, documents, analysis });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const demo = formData.get("demo") === "true";
    const locale = normalizeLocale(formData.get("locale"));
    const problemType = String(formData.get("problemType") ?? "");
    const problemDescription = storedRequestSchema.shape.problemDescription.parse(formData.get("problemDescription") ?? "");
    const caseId = String(formData.get("caseId") ?? randomUUID());

    if (files.length === 0) return Response.json({ error: "Добавьте хотя бы один файл" }, { status: 400 });
    if (files.length > MAX_FILES) return Response.json({ error: "Можно добавить не более 6 файлов" }, { status: 400 });

    for (const file of files) {
      const validation = validateUpload(file);
      if (!validation.ok) return Response.json({ error: `${file.name}: ${validation.error}` }, { status: 400 });
    }

    const fileNames = files.map((file) => file.name);
    if (isSeededDemo({ demo, fileNames })) {
      const seededAnalysis = getDemoCaseAnalysis(locale);
      const analysis = problemDescription ? {
        ...seededAnalysis,
        issue: problemDescription,
        facts: seededAnalysis.facts.map((fact) => fact.key === "issue"
          ? { ...fact, value: problemDescription, source: "user" as const }
          : fact),
      } : seededAnalysis;
      return Response.json({
        caseId,
        demo: true,
        documents: files.map((file, index) => ({
          fileName: file.name,
          documentType: index === 0 ? "receipt" : "seller_conversation",
          confidence: 0.98,
        })),
        analysis,
      });
    }

    const documents = await Promise.all(files.map(async (file) => {
      const [analysis] = await Promise.all([
        analyzeDocument({
          name: file.name,
          mimeType: file.type,
          base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        }),
        uploadEvidence(caseId, file),
      ]);
      return { fileName: file.name, ...analysis };
    }));
    const documentsReadyAt = performance.now();
    const analysis = await buildCase(documents, {
      problemType: problemType as CaseAnalysisOutput["caseType"],
      problemDescription,
      locale,
    });
    console.info("Document analysis completed", {
      fileCount: documents.length,
      documentAnalysisMs: Math.round(documentsReadyAt - requestStartedAt),
      caseAssemblyMs: elapsedMs(documentsReadyAt),
      totalMs: elapsedMs(requestStartedAt),
    });
    return Response.json({ caseId, demo: false, documents, analysis });
  } catch (error) {
    console.error("Document analysis failed", error);
    return Response.json(
      { error: getAIUserMessage(error) },
      { status: 502 },
    );
  }
}
