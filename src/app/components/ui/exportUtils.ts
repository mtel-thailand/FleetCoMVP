import * as XLSX from "xlsx";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n") || v.includes("\r")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function exportXLSX(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][],
  filename: string
) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, filename);
}

export function parseExcelDate(str: string | null | undefined): Date | string {
  if (!str) return str ?? "";
  const d = new Date(str.replace(" ", "T"));
  return isNaN(d.getTime()) ? str : d;
}

export function exportDateTag(): string {
  return new Date().toISOString().slice(0, 10);
}
