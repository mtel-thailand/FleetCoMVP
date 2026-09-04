import { Fragment, jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { translateUiValue } from "./core";
import { LocalizedText } from "./LocalizedText";

export { Fragment };

const TRANSLATABLE_ATTRIBUTES = ["title", "placeholder", "alt", "aria-label"] as const;

function localizeChildren(value: unknown): unknown {
  if (typeof value === "string") return reactJsxDEV(LocalizedText, { source: value }, undefined, false, undefined, undefined);
  if (Array.isArray(value)) {
    return value.map((child, index) => typeof child === "string"
      ? reactJsxDEV(LocalizedText, { source: child }, `i18n-${index}`, false, undefined, undefined)
      : child);
  }
  return value;
}

function localizeProps(type: Parameters<typeof reactJsxDEV>[0], props: Record<string, unknown>): Record<string, unknown> {
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

export function jsxDEV(
  type: Parameters<typeof reactJsxDEV>[0],
  props: Parameters<typeof reactJsxDEV>[1],
  key: Parameters<typeof reactJsxDEV>[2],
  isStaticChildren: Parameters<typeof reactJsxDEV>[3],
  source: Parameters<typeof reactJsxDEV>[4],
  self: Parameters<typeof reactJsxDEV>[5],
) {
  return reactJsxDEV(type, localizeProps(type, props as Record<string, unknown>) as Parameters<typeof reactJsxDEV>[1], key, isStaticChildren, source, self);
}
