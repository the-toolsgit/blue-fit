// Backup helpers shared by Settings, the backup reminder and the crash screen.
import type { AppData } from "../core/types";
import { localDate } from "../core/util";

export async function backupText(data: AppData): Promise<string> {
  const { buildBackup } = await import("../core/io/exportFormat");
  return JSON.stringify(buildBackup(data, new Date()), null, 1);
}

export function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const backupFilename = () => `blue-fit-backup-${localDate(new Date())}.json`;
export async function downloadBackup(data: AppData) { downloadText(await backupText(data), backupFilename()); }

/** Days since an ISO time, or null if never. */
export const daysSince = (iso: string | null | undefined, now = Date.now()) => (iso ? Math.floor((now - Date.parse(iso)) / 86_400_000) : null);
export const REMIND_AFTER_DAYS = 14;
