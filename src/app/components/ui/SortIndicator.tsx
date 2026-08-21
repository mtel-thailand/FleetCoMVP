import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { cn } from "./utils";

type SortIndicatorProps = {
  active?: boolean;
  direction?: "asc" | "desc";
  className?: string;
};

function SortIndicator({
  active = false,
  direction = "asc",
  className,
}: SortIndicatorProps) {
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <span className="inline-flex w-4 shrink-0 justify-center">
      <Icon
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          active ? "text-[var(--portal-accent)]" : "text-slate-300",
          className,
        )}
        strokeWidth={2}
      />
    </span>
  );
}

export { SortIndicator };
