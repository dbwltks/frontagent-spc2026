import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

// 파일 확장자/MIME 타입으로 소스 타입을 판별하고, 각 포맷에서 순수 텍스트를 뽑아낸다.
export function detectSourceType(fileName: string, mimeType: string): "pdf" | "excel" | "csv" | "text" {
  const name = fileName.toLowerCase();
  const type = mimeType.toLowerCase();
  if (name.endsWith(".pdf") || type.includes("pdf")) return "pdf";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || type.includes("sheet") || type.includes("excel")) return "excel";
  if (name.endsWith(".csv") || type.includes("csv")) return "csv";
  return "text";
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return typeof text === "string" ? text : (text as string[]).join("\n\n");
}

function extractExcelText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) sections.push(`[시트: ${sheetName}]\n${csv.trim()}`);
  }
  return sections.join("\n\n");
}

export async function extractFileText(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const type = detectSourceType(fileName, mimeType);
  if (type === "pdf") return extractPdfText(buffer);
  if (type === "excel") return extractExcelText(buffer);
  // csv/text 모두 UTF-8 평문으로 처리한다.
  return buffer.toString("utf8");
}

// 가벼운 HTML → 텍스트 변환(cheerio 등 새 의존성 없이). script/style을 먼저
// 제거하고 태그를 벗겨낸 뒤 개행을 정리한다 — readability 수준의 본문 추출은
// 아니지만 RAG 청킹 입력으로는 충분하다.
export function htmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withBreaks = withoutScripts
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return withBreaks
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
