import { randomUUID } from "node:crypto";

import { z } from "zod";

import { getServerSupabase } from "../../../../lib/supabase/server.ts";
import { sanitizeFileName, validateUpload } from "../../../../lib/workflow.ts";

export const runtime = "nodejs";

const schema = z.object({
  caseId: z.string().uuid(),
  files: z.array(z.object({
    name: z.string().min(1).max(255),
    type: z.string().min(1),
    size: z.number().int().positive(),
  })).min(1).max(6),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const supabase = getServerSupabase();
    const uploads = await Promise.all(input.files.map(async (file) => {
      const validation = validateUpload(file);
      if (!validation.ok) throw new Error(validation.error);
      const path = `${input.caseId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
      const { data, error } = await supabase.storage.from("case-documents").createSignedUploadUrl(path);
      if (error) throw error;
      return { name: file.name, type: file.type, size: file.size, path, token: data.token };
    }));
    return Response.json({ uploads });
  } catch {
    return Response.json({ error: "Не удалось подготовить безопасную загрузку" }, { status: 400 });
  }
}
