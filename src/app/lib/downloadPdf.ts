import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  return Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  })).then(() => undefined);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(root: HTMLElement): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(async (image) => {
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith("data:")) return;

    try {
      const response = await fetch(source);
      if (response.ok) image.src = await blobToDataUrl(await response.blob());
    } catch {
      // Keep the original source as a fallback; the capture can still render
      // the rest of the document if a non-critical image is unavailable.
    }
  }));
}

/**
 * Downloads the visible A4 document sheets as a PDF. Each sheet is cloned
 * at its true A4 size before capture so the preview's responsive `zoom` does
 * not reduce the exported resolution or alter its pagination.
 */
export async function downloadA4Document(root: HTMLElement, filename: string): Promise<void> {
  const sheets = Array.from(root.querySelectorAll<HTMLElement>(".a4-page-sheet"));
  if (sheets.length === 0) throw new Error("No document pages were found.");

  await document.fonts?.ready;

  const host = document.createElement("div");
  host.style.position = "fixed";
  // Keep the clone in the viewport. Native foreign-object capture can return
  // a blank canvas for content positioned far outside the viewport.
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = `${A4_WIDTH_MM}mm`;
  host.style.background = "#fff";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  document.body.appendChild(host);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

  try {
    for (const [index, sheet] of sheets.entries()) {
      const clone = sheet.cloneNode(true) as HTMLElement;
      clone.style.width = `${A4_WIDTH_MM}mm`;
      clone.style.height = `${A4_HEIGHT_MM}mm`;
      clone.style.zoom = "1";
      clone.style.margin = "0";
      clone.style.boxShadow = "none";
      host.replaceChildren(clone);

      await inlineImages(clone);
      await waitForImages(clone);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const canvas = await html2canvas(clone, {
        backgroundColor: "#ffffff",
        foreignObjectRendering: true,
        scale: 2,
        useCORS: true,
        logging: false,
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });

      if (index > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
    }

    const blob = pdf.output("blob");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    host.remove();
  }
}
