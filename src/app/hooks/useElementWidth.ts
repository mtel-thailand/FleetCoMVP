import { useEffect, useState, type RefObject } from "react";

// Generic ResizeObserver-backed width reading — pulled out of A4Document.tsx
// since "how wide is my container right now" is a plain, reusable question,
// not something specific to documents. Returns undefined until the first
// measurement lands (there's nothing to observe before the ref is attached).
export function useElementWidth(ref: RefObject<HTMLElement | null>): number | undefined {
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function measure() {
      setWidth(el!.offsetWidth);
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
