"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  /** Called when the dialog closes, including when Escape is pressed. The parent then stops rendering it. */
  onClose: () => void;
};

// A modal dialog on the native <dialog> element: showModal() gives focus trapping, the Escape key and an
// inert page behind it. Render it only while it should be open. Mark the primary button with
// `data-autofocus` and focus starts there. This is the only file allowed to use a blur (the backdrop).
// There is no open or close animation, so nothing needs a reduced-motion override.
export function Modal({ title, children, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Guard: React Strict Mode runs this effect twice in development.
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-full max-w-modal bg-transparent p-4 text-ink backdrop:bg-ink/50 backdrop:backdrop-blur-modal"
    >
      <div className="flex flex-col gap-6 border-heavy border-ink bg-background p-6">
        <h2 id={titleId} className="text-label uppercase">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
