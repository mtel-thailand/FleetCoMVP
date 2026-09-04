import { useI18n } from "./context";

export function LanguageToggle({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <div
      className={`inline-flex items-center rounded-full border p-0.5 ${
        inverse ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-100"
      }`}
      role="group"
      aria-label={t("Language")}
    >
      {(["en", "th"] as const).map((option) => {
        const selected = language === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLanguage(option)}
            aria-pressed={selected}
            className={`${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1.5 text-xs"} rounded-full font-semibold transition-colors cursor-pointer ${
              selected
                ? "bg-white text-slate-900 shadow-sm"
                : inverse ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {option === "en" ? "EN" : "ไทย"}
          </button>
        );
      })}
    </div>
  );
}

