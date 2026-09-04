import { useEffect, useRef, useState } from "react";
import { Eraser, Type, PenLine, Upload } from "lucide-react";
import { loadPersisted, savePersisted } from "@/app/lib/persistence";

type Mode = "type" | "draw" | "upload";
type Persisted = { mode: "type"; text: string } | { mode: "draw" | "upload"; dataUrl: string };

function fontAt(px: number) {
  return `600 ${px}px "Dancing Script", "Segoe Script", "Snell Roundhand", cursive`;
}
function storageKeyFor(rememberAs: string) {
  return `signature:${rememberAs}`;
}
function drawContainFit(ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasW: number, canvasH: number) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const scale = Math.min(canvasW / img.width, canvasH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (canvasW - w) / 2, (canvasH - h) / 2, w, h);
}

// Type-to-sign, draw-to-sign, and upload-a-PNG, all captured as the same
// kind of output — a PNG data URL — so the rest of the app (A4Document's
// draft preview, QuotationDetail, InvoiceDetail) never needs to know or
// care which mode produced it.
//
// Type is the default: FleetCo Ops is a desktop/mouse-first tool (brief's
// own framing), and a mouse-drawn signature is unreliable and usually
// illegible without a trackpad, touchscreen, or stylus. Typing a name and
// rendering it in a signature-style script font is the more realistic
// "e-signature" for that context — most real-world e-sign products
// (DocuSign etc.) default to exactly this for the same reason. Draw stays
// available for anyone with a pointing device that makes it practical, and
// Upload covers the case of an actual scanned/exported signature image.
//
// `rememberAs`, when given a stable key (this app uses the admin role,
// since that's the only identity concept that exists here — see
// getAdminRole), persists the signature across documents in localStorage
// so staff don't have to redo it every single time. Omit it to keep the
// pad session-only.
export function SignaturePad({
  value, onChange, width = 460, height = 120, rememberAs,
}: {
  value: string | null; onChange: (dataUrl: string | null) => void; width?: number; height?: number; rememberAs?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const hasStroke = useRef(false);

  const [mode, setMode] = useState<Mode>(() => {
    if (!rememberAs) return "type";
    return loadPersisted<Persisted | null>(storageKeyFor(rememberAs), null)?.mode ?? "type";
  });
  const [typedName, setTypedName] = useState<string>(() => {
    if (!rememberAs) return "";
    const p = loadPersisted<Persisted | null>(storageKeyFor(rememberAs), null);
    return p?.mode === "type" ? p.text : "";
  });
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Restore a remembered *raster* signature (drawn or uploaded) once on
  // mount — the type-mode equivalent doesn't need this, since seeding
  // `typedName` above already makes the effect below rasterize it on first
  // render.
  useEffect(() => {
    if (!rememberAs) return;
    const persisted = loadPersisted<Persisted | null>(storageKeyFor(rememberAs), null);
    if (!persisted || persisted.mode === "type") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d")!;
      drawContainFit(ctx, img, width, height);
      hasStroke.current = true;
      onChange(persisted.dataUrl);
    };
    img.src = persisted.dataUrl;
    // Mount-only restore — a role's remembered signature doesn't change
    // mid-edit, so this deliberately isn't reactive to later prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Type mode: re-rasterize onto the canvas on every keystroke, so `value`
  // stays a real PNG no matter which mode is active — draw mode's own
  // toDataURL() capture (in end(), below) and upload's (in handleFile) are
  // the other two onChange sources.
  useEffect(() => {
    if (mode !== "type") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const name = typedName.trim();
    if (!name) {
      ctx.clearRect(0, 0, width, height);
      onChange(null);
      return;
    }
    let cancelled = false;
    // Canvas text paints with whatever font is already loaded at draw time
    // — unlike DOM text, it won't retroactively repaint once a lazily-
    // fetched @font-face resolves, so the face is loaded explicitly first
    // rather than trusting font-display: swap to catch up in time.
    const loadFont = document.fonts?.load ? document.fonts.load(fontAt(44)) : Promise.resolve();
    loadFont.catch(() => {}).finally(() => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#1e293b";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      let fontSize = 44;
      ctx.font = fontAt(fontSize);
      while (ctx.measureText(name).width > width - 32 && fontSize > 18) {
        fontSize -= 2;
        ctx.font = fontAt(fontSize);
      }
      ctx.fillText(name, width / 2, height / 2 + 4);
      const dataUrl = canvas.toDataURL("image/png");
      onChange(dataUrl);
      if (rememberAs) savePersisted(storageKeyFor(rememberAs), { mode: "type", text: name } satisfies Persisted);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, typedName]);

  // Screen coordinates (from the pointer event) land in CSS pixels, sized
  // against the canvas's *rendered* box (`rect`) — but the canvas is
  // CSS-stretched to fill its column (`w-full`) while its actual drawing
  // buffer stays fixed at width×height, so those two sizes usually differ.
  // Without correcting for that gap, the drawn stroke lands wherever the
  // pointer would be if the canvas really were rect-sized, which drifts
  // further from the real cursor position the more the two sizes diverge
  // — exactly the "cursor and pen don't match" bug this scales away.
  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    hasStroke.current = true;
  }
  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (!hasStroke.current) { onChange(null); return; }
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    onChange(dataUrl);
    if (rememberAs) savePersisted(storageKeyFor(rememberAs), { mode: "draw", dataUrl } satisfies Persisted);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.type !== "image/png") {
      setUploadError("Please choose a PNG file.");
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onerror = () => setUploadError("Couldn't read that file — try again.");
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => setUploadError("Couldn't load that image — try a different file.");
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        drawContainFit(canvas.getContext("2d")!, img, width, height);
        hasStroke.current = true;
        const dataUrl = canvas.toDataURL("image/png");
        onChange(dataUrl);
        if (rememberAs) savePersisted(storageKeyFor(rememberAs), { mode: "upload", dataUrl } satisfies Persisted);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    if (mode === "type") {
      setTypedName("");
    } else {
      canvasRef.current?.getContext("2d")!.clearRect(0, 0, width, height);
      hasStroke.current = false;
      onChange(null);
    }
    // Deliberately doesn't touch the remembered copy in storage — clearing
    // mid-edit is "let me redo this one," not "forget my signature."
  }
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setUploadError(null);
    canvasRef.current?.getContext("2d")!.clearRect(0, 0, width, height);
    hasStroke.current = false;
    onChange(null);
    // typedName itself is left alone — switching back to Type shouldn't
    // make you retype a name you already entered this session.
  }

  const hint = value
    ? "Signed"
    : mode === "type" ? "Type your name above"
    : mode === "draw" ? "Draw your signature above"
    : "Upload a PNG above";

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => switchMode("type")}
          aria-pressed={mode === "type"}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${mode === "type" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          <Type size={11} /> Type
        </button>
        <button
          type="button"
          onClick={() => switchMode("draw")}
          aria-pressed={mode === "draw"}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${mode === "draw" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          <PenLine size={11} /> Draw
        </button>
        <button
          type="button"
          onClick={() => switchMode("upload")}
          aria-pressed={mode === "upload"}
          className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${mode === "upload" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
        >
          <Upload size={11} /> Upload
        </button>
      </div>

      {mode === "type" && (
        <input
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          aria-label="Signature name"
          placeholder="Type your full name"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[var(--portal-accent)]"
          style={{ fontFamily: `"Dancing Script", cursive` }}
        />
      )}

      {mode === "upload" && (
        <div className="mb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-lg text-[11px] text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <Upload size={11} /> {value ? "Choose a different PNG" : "Choose a PNG file"}
          </button>
          {uploadError && <p className="text-[11px] text-rose-500 mt-1">{uploadError}</p>}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={mode === "draw" ? start : undefined}
        onPointerMove={mode === "draw" ? move : undefined}
        onPointerUp={mode === "draw" ? end : undefined}
        onPointerLeave={mode === "draw" ? end : undefined}
        role="img"
        aria-label="Signature drawing area. Use Type mode to enter your full name."
        className={`border border-slate-200 rounded-lg bg-white block w-full ${mode === "draw" ? "touch-none cursor-crosshair" : ""}`}
        style={{ aspectRatio: `${width} / ${height}` }}
      />

      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-slate-400">{hint}</p>
        {value && (
          <button type="button" onClick={clear} className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-500 cursor-pointer">
            <Eraser size={11} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
