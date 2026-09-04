import * as XLSX from "xlsx";
import { formatUiDate, translate } from "@/app/i18n";
import { demoToday } from "@/app/data/demoDates";

function localizeExportValue(value: string | number | Date | null | undefined): string | number {
  if (value instanceof Date) {
    const pad = (part: number) => String(part).padStart(2, "0");
    const localValue = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
    return formatUiDate(localValue, value.getHours() !== 0 || value.getMinutes() !== 0);
  }
  if (typeof value !== "string") return value ?? "";
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?$/.test(value)) return formatUiDate(value, true);
  return translate(value);
}

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
  const lines = [
    headers.map((value) => escape(String(localizeExportValue(value)))).join(","),
    ...rows.map((row) => row.map((value) => escape(String(localizeExportValue(value)))).join(",")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename);
}

export function exportXLSX(
  headers: string[],
  rows: (string | number | Date | null | undefined)[][],
  filename: string
) {
  const localizedHeaders = headers.map((value) => localizeExportValue(value));
  const localizedRows = rows.map((row) => row.map(localizeExportValue));
  const ws = XLSX.utils.aoa_to_sheet([localizedHeaders, ...localizedRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, translate("Data"));
  XLSX.writeFile(wb, filename);
}

export function parseExcelDate(str: string | null | undefined): Date | string {
  if (!str) return str ?? "";
  const d = new Date(str.replace(" ", "T"));
  return isNaN(d.getTime()) ? str : d;
}

export function exportDateTag(): string {
  return demoToday();
}
