import { useRef, useState } from "react";
import { Upload, X, FileImage, FileText } from "lucide-react";

// InvoiceDetail's own Mark-as-Paid flow — one call site (documentActions.ts's
// markInvoicePaid), pulled out for the same "keep the form and its trigger
// button separable" reason ReasonForm/MarkPaidForm's siblings all are.
//
// Filenames only, not real file bytes — this demo has no file storage
// (matches ClientAccount.contractFileName's own "just the name" approach).
// Required, not optional, and multiple files supported — a bank transfer
// slip is sometimes two screenshots (app confirmation + bank statement
// line), and FleetCo has nothing to verify a claim against without at
// least one.

// PDF vs image, purely from the filename's own extension (no real file
// bytes to sniff) — just enough to make the attached-file list scannable
// at a glance instead of every row wearing the same generic clip icon.
function fileIcon(name: string) {
  return name.toLowerCase().endsWith(".pdf") ? FileText : FileImage;
}

export function MarkPaidForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (date: string, reference: string, slipFiles: string[]) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [slipFiles, setSlipFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const names = Array.from(fileList).map((f) => f.name);
    // Append, not replace — a second "Attach" pass (having realized one
    // screenshot wasn't enough) adds to what's already picked rather than
    // silently dropping it.
    setSlipFiles((prev) => [...prev, ...names]);
  }

  function removeFile(idx: number) {
    setSlipFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Payment Date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Payment Reference / Transaction No.</label>
        <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. bank transfer reference"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Payment Slip</label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
        {/* A real dropzone, not just a slim "attach" button — this is the
            one thing that makes Submit go from disabled to enabled, so it
            earns more visual weight than a single-line control would give
            it. Drag-and-drop is additive on top of the same click-to-browse
            path, not a replacement for it. */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`w-full flex flex-col items-center justify-center gap-1 text-center rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors ${
            dragOver
              ? "border-[var(--portal-accent)] bg-[var(--portal-accent-light)]"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <Upload size={18} className={dragOver ? "text-[var(--portal-accent)]" : "text-slate-400"} />
          <span className="text-xs font-medium text-slate-600">
            {slipFiles.length === 0 ? "Drop files here or click to browse" : "Drop more files or click to browse"}
          </span>
          <span className="text-[11px] text-slate-400">JPG, PNG, or PDF</span>
        </button>
        {slipFiles.length > 0 && (
          <div className="mt-2 space-y-1">
            {slipFiles.map((name, i) => {
              const Icon = fileIcon(name);
              return (
                <div key={`${name}-${i}`} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Icon size={13} className="text-slate-400 shrink-0" />
                  <span className="text-[11px] text-slate-600 truncate flex-1">{name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-300 hover:text-rose-500 cursor-pointer shrink-0">
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed">
        This records your payment as submitted. FleetCo finance will verify it and release the tax invoice at the same time.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white cursor-pointer">
          Cancel
        </button>
        <button
          disabled={!reference.trim() || !date || slipFiles.length === 0}
          onClick={() => onConfirm(date, reference.trim(), slipFiles)}
          className="flex-1 py-2 bg-[var(--portal-accent)] text-white rounded-lg text-xs font-medium hover:bg-[var(--portal-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Submit Payment
        </button>
      </div>
    </div>
  );
}
