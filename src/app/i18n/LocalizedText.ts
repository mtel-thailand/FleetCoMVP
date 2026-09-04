import { useSyncExternalStore } from "react";
import { getLanguage, subscribeLanguage, translate } from "./core";

export function LocalizedText({ source }: { source: string }) {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return translate(source, undefined, language);
}
