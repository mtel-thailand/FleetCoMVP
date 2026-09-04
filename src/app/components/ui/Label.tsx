import { cn } from "@/app/components/ui/utils";

// 46 of the 55 hand-written <label> elements in this app used exactly these
// five classes (differing only in the order they were written). This is the
// least ambiguous primitive in the set — there was never a second opinion
// about what a field label looks like, only a missing name for it.
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-xs font-medium text-slate-600", className)}
      {...props}
    />
  );
}
