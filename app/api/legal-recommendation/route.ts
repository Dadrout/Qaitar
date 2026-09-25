import { isDeepStrictEqual } from "node:util";

import { z } from "zod";

import { embedLegalQuery } from "../../../lib/ai/embeddings.ts";
import { createLegalSearchRequest, noReliableLegalBasis, reasonFromLegalChunks } from "../../../lib/ai/legal-reasoning.ts";
import { CaseAnalysisSchema } from "../../../lib/ai/schemas.ts";
import { getDemoCaseAnalysis, getDemoLegalRecommendation } from "../../../lib/demo/scenario.ts";
import { retrieveLegalChunks } from "../../../lib/legal/retrieve.ts";

export const runtime = "nodejs";

const requestSchema = z.object({
  analysis: CaseAnalysisSchema,
  demo: z.boolean().default(false),
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    if (input.demo && input.analysis.seller.name === getDemoCaseAnalysis(input.locale).seller.name) {
      const seeded = CaseAnalysisSchema.parse(getDemoCaseAnalysis(input.locale));
      if (isDeepStrictEqual(input.analysis, seeded)) {
        return Response.json({ recommendation: getDemoLegalRecommendation(input.locale), retrieved: 2, demo: true });
      }
      return Response.json({
        recommendation: noReliableLegalBasis(input.analysis.caseType, input.locale),
        retrieved: 0,
        demo: true,
      });
    }

    const search = await createLegalSearchRequest(input.analysis);
    const embedding = await embedLegalQuery([search.query, ...search.conceptsRu, ...search.conceptsKk].join("; "));
    const chunks = await retrieveLegalChunks(search.query, embedding);
    const recommendation = chunks.length
      ? await reasonFromLegalChunks(input.analysis, chunks, input.locale)
      : noReliableLegalBasis(input.analysis.caseType, input.locale);
    return Response.json({ recommendation, retrieved: chunks.length, demo: false });
  } catch {
    return Response.json({
      recommendation: noReliableLegalBasis("other"),
      retrieved: 0,
      demo: false,
    });
  }
}
