import * as React from "react";
import { cn } from "./utils";

interface InlineInputProps extends React.ComponentProps<"input"> {
  label: string;
  suffix?: React.ReactNode;
}

export function InlineInput({ label, suffix, className, ...props }: InlineInputProps) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100 transition group">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <label className="block text-sm text-slate-700 font-medium leading-none mb-1.5">
            {label}
          </label>
          <input
            className={cn(
              "w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none",
              className
            )}
            {...props}
          />
        </div>
        {suffix && (
          <div className="ml-3 shrink-0">{suffix}</div>
        )}
      </div>
    </div>
  );
}
