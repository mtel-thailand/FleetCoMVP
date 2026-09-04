import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";

// The behavioural shell behind every modal in this app — layer 1, nothing else.
//
// This exists because the app had 18 hand-rolled `fixed inset-0` overlays and
// they do NOT share a look: widths run sm:max-w-sm through sm:max-w-4xl, radii
// are rounded-xl or rounded-2xl or a rounded-t-2xl bottom-sheet, some own their
// header and footer while others are bare wrappers around ReasonForm /
// MarkPaidForm, and LoginPage's carries a data-portal attribute that drives its
// own theming. Forcing them all through ActionModal would have meant redesigning
// them, which is not what this pass is for.
//
// So Modal owns only what none of them had and all of them need — focus trap,
// focus return, Escape, role=dialog, labelling, background aria-hidden,
// scroll lock — and takes the presentation as className strings the caller
// still controls. Every migrated overlay keeps its exact original classes and
// renders identically.
//
// Accessibility contract: Radix requires a Title and Description. Callers that
// show a visible heading should render <ModalTitle> around it (ActionModal
// does). Callers whose content provides its own markup pass `title` instead and
// get a screen-reader-only one.

export const ModalTitle = Dialog.Title;
export const ModalDescription = Dialog.Description;
export const ModalClose = Dialog.Close;

export function Modal({
  onClose,
  overlayClassName,
  contentClassName,
  overlayProps,
  title,
  description,
  dismissOnOutsideClick = true,
  children,
}: {
  onClose: () => void;
  /** The original overlay classes, preserved verbatim per call site. */
  overlayClassName: string;
  /** The original card classes, preserved verbatim per call site. */
  contentClassName: string;
  /** Extra attributes for the overlay — LoginPage needs data-portal here. */
  overlayProps?: React.HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
  /**
   * Screen-reader-only name, for modals whose content has NO visible heading
   * (the ReasonForm / MarkPaidForm wrappers). When the content *does* show a
   * heading, wrap that heading in <ModalTitle asChild> instead and leave this
   * unset — passing both makes assistive tech announce the same words twice.
   */
  title?: string;
  description?: string;
  /**
   * Whether clicking the backdrop dismisses. Defaults to true because most of
   * this app's overlays had `onClick={onClose}` on the backdrop. The two form
   * modals that deliberately did NOT (Vehicles' and DriverRoster's add/edit
   * forms — a stray click should not discard a half-filled form) pass false, so
   * migrating them to Radix does not silently add a way to lose work.
   * Escape still closes in both cases: that is explicit user intent, and none
   * of these modals had it before.
   */
  dismissOnOutsideClick?: boolean;
  children: React.ReactNode;
}) {
  // Captured in the useRef initialiser — during render, deliberately not in an
  // effect. Radix moves focus into the dialog in its own mount effect, so an
  // effect here would race it and capture the dialog's own first control
  // instead of whatever opened the modal. Restoring on unmount is needed
  // because every call site mounts modals conditionally
  // (`{showX && <Modal/>}`) rather than toggling `open`, which tears down
  // Dialog.Root in the same tick Radix would otherwise restore focus.
  const triggerRef = useRef<HTMLElement | null>(
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  useEffect(() => () => {
    const el = triggerRef.current;
    // The trigger can legitimately be gone (the action that closed this modal
    // may have re-rendered the row it lived in), so only restore if it is still
    // in the document.
    if (el && el.isConnected) el.focus();
  }, []);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        {/* Content nested inside Overlay, not as its sibling: it preserves the
            original flex centering (bottom sheet on mobile, centered card from
            sm: up) instead of switching to transform-based positioning, and it
            keeps click-outside-to-close working the way it always did. */}
        <Dialog.Overlay className={overlayClassName} {...overlayProps}>
          <Dialog.Content
            className={contentClassName}
            // Radix warns when a dialog has no Description, and its documented
            // opt-out is an explicit aria-describedby={undefined}. These modals
            // are short and self-evident — the title carries the meaning — so
            // opt out rather than inventing filler a screen reader would read
            // out on every open. Spread so the attribute is genuinely absent
            // when a description IS supplied, letting Radix wire it up itself.
            {...(description ? {} : { "aria-describedby": undefined })}
            onClick={(e) => e.stopPropagation()}
            onPointerDownOutside={dismissOnOutsideClick ? undefined : (e) => e.preventDefault()}
            onInteractOutside={dismissOnOutsideClick ? undefined : (e) => e.preventDefault()}
          >
            {title ? <Dialog.Title className="sr-only">{title}</Dialog.Title> : null}
            {description ? <Dialog.Description className="sr-only">{description}</Dialog.Description> : null}
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
