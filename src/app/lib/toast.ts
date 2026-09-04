import { toast } from "sonner";
import { translate } from "@/app/i18n";

type ToastValues = Record<string, string | number>;

/**
 * Product feedback for completed operations. Keep these calls at the UI
 * boundary after a mutation succeeds; navigation, filters, and opening a
 * dialog intentionally remain silent.
 */
export function toastSuccess(message: string, values?: ToastValues): void {
  toast.success(translate(message, values));
}

/** Use after a failed operation when the on-screen state alone is insufficient. */
export function toastError(message: string, values?: ToastValues): void {
  toast.error(translate(message, values));
}
