import { z } from "zod";

import { generateClaim } from "../../../lib/ai/generate-claim.ts";
import { CaseAnalysisSchema, LegalRecommendationSchema } from "../../../lib/ai/schemas.ts";

export const runtime = "nodejs";

const schema = z.object({
  locale: z.enum(["ru", "kk", "en"]).default("ru"),
  analysis: CaseAnalysisSchema,
  recommendation: LegalRecommendationSchema,
  consumer: z.object({
    name: z.string().min(2),
    address: z.string().min(2),
    phone: z.string().min(5),
    email: z.string().email(),
  }),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    return Response.json({ claim: generateClaim(input.analysis, input.recommendation, input.consumer, input.locale) });
  } catch {
    return Response.json({ error: "Не хватает данных для подготовки претензии" }, { status: 400 });
  }
}
