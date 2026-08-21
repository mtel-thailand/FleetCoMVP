import { useEffect } from 'react';

export function useBodyScrollLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const { documentElement, body } = document;
    const prevHtml = documentElement.style.overflow;
    const prevBody = body.style.overflow;
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      documentElement.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [enabled]);
}
