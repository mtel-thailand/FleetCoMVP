import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { translateUiValue } from "./core";
import { LocalizedText } from "./LocalizedText";

export { Fragment };

const TRANSLATABLE_ATTRIBUTES = ["title", "placeholder", "alt", "aria-label"] as const;

function localizeChildren(value: unknown): unknown {
  if (typeof value === "string") return reactJsx(LocalizedText, { source: value });
  if (Array.isArray(value)) {
    return value.map((child, index) => typeof child === "string"
      ? reactJsx(LocalizedText, { source: child }, `i18n-${index}`)
      : child);
  }
  return value;
}

function localizeProps(type: Parameters<typeof reactJsx>[0], props: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!props) return props;
  let localized: Record<string, unknown> = props;
  if ("children" in props) {
    const children = localizeChildren(props.children);
    if (children !== props.children) localized = { ...localized, children };
  }
  if (typeof type === "string") {
    for (const attribute of TRANSLATABLE_ATTRIBUTES) {
      const original = props[attribute];
      if (typeof original === "string") {
        if (localized === props) localized = { ...localized };
        localized[attribute] = translateUiValue(original);
        localized[`data-i18n-${attribute}`] = original;
      }
    }
  }
  return localized;
}

export function jsx(type: Parameters<typeof reactJsx>[0], props: Parameters<typeof reactJsx>[1], key?: Parameters<typeof reactJsx>[2]) {
  return reactJsx(type, localizeProps(type, props as Record<string, unknown>) as Parameters<typeof reactJsx>[1], key);
}

export function jsxs(type: Parameters<typeof reactJsxs>[0], props: Parameters<typeof reactJsxs>[1], key?: Parameters<typeof reactJsxs>[2]) {
  return reactJsxs(type, localizeProps(type, props as Record<string, unknown>) as Parameters<typeof reactJsxs>[1], key);
}
