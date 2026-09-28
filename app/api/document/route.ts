import { explainDocument } from "../../../lib/ai/explain-document.ts";
import { validateUpload } from "../../../lib/workflow.ts";
import { normalizeLocale } from "../../../lib/i18n/index.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Добавьте документ" }, { status: 400 });
    const validation = validateUpload(file);
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });
    const explanation = await explainDocument({ mimeType: file.type, base64: Buffer.from(await file.arrayBuffer()).toString("base64"), locale: normalizeLocale(formData.get("locale")) });
    return Response.json({ explanation });
  } catch {
    return Response.json({ error: "Не удалось прочитать документ. Попробуйте загрузить более чёткое фото." }, { status: 502 });
  }
}
