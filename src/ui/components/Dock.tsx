import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Bottom action area above the tab bar. Portaled to <body> so page animations can't capture the fixed position. */
export const Dock = ({ children }: { children: ReactNode }) => createPortal(<div className="dock">{children}</div>, document.body);
