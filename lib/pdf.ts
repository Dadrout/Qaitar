import { PDFDocument } from "pdf-lib";

export function paginateClaimText(text: string, maxLines: number) {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += maxLines) {
    pages.push(lines.slice(index, index + maxLines));
  }
  return pages.length ? pages : [[""]];
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (context.measureText(word).width > maxWidth) {
      if (current) lines.push(current);
      let fragment = "";
      for (const character of word) {
        const candidate = fragment + character;
        if (fragment && context.measureText(candidate).width > maxWidth) {
          lines.push(fragment);
          fragment = character;
        } else {
          fragment = candidate;
        }
      }
      current = fragment;
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function downloadTextPdf(text: string, { fileName, title }: { fileName: string; title: string }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1240;
  canvas.height = 1754;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF rendering is unavailable");

  const paddingX = 110;
  const paddingTop = 130;
  const lineHeight = 34;
  context.font = "26px Arial, sans-serif";
  const wrapped = text.split("\n").flatMap((line) => wrapText(context, line, canvas.width - paddingX * 2));
  const pages = paginateClaimText(wrapped.join("\n"), 43);
  const pdf = await PDFDocument.create();

  for (const lines of pages) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111827";
    context.font = "26px Arial, sans-serif";
    lines.forEach((line, index) => context.fillText(line, paddingX, paddingTop + index * lineHeight));
    context.fillStyle = "#64748b";
    context.font = "18px Arial, sans-serif";
    context.fillText("Подготовлено в Qaitar · qaitar.kz", paddingX, canvas.height - 70);

    const png = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage([595.28, 841.89]);
    page.drawImage(png, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }

  pdf.setTitle(title);
  pdf.setAuthor("Qaitar");
  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadClaimPdf(text: string, fileName = "qaitar-claim.pdf") {
  return downloadTextPdf(text, { fileName, title: "Претензия потребителя" });
}
