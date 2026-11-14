import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet. Closes on backdrop tap and Escape. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grip" />
        {children}
      </div>
    </>,
    document.body,
  );
}

export function Confirm({ open, title, body, confirm, danger, onConfirm, onClose }: {
  open: boolean; title: string; body?: ReactNode; confirm: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="stack" style={{ padding: "4px 4px 8px" }}>
        <h3 className="title-md">{title}</h3>
        {body && <div className="muted">{body}</div>}
        <button className={"btn btn-block " + (danger ? "btn-danger" : "btn-primary")} style={{ minHeight: 54, marginTop: 8 }} onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
