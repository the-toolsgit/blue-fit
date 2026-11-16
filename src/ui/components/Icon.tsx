// Line icons in the figure's stroke style (24 × 24, round caps).
const P: Record<string, string> = {
  today: "M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11",
  plan: "M9 3.5h6v3H9zM7 5H5v15.5h14V5h-2M8.5 11h7M8.5 15h5",
  history: "M4 6h16v14H4zM4 10h16M8 3.5v4M16 3.5v4M8 14h2M12 14h2M8 17h2",
  progress: "M4 19.5h16M5 15.5l4-5 4 3 6-7.5M15 6h4v4",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  close: "M6 6l12 12M18 6L6 18",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  swap: "M7 8h12l-3.5-3.5M17 16H5l3.5 3.5",
  back: "M15 5l-7 7 7 7",
  chevron: "M9 6l6 6-6 6",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  trash: "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13",
  note: "M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  info: "M12 11v6M12 7.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  timer: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2.5h4",
  play: "M8 5.5v13l10.5-6.5z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 14l5-5 5 5M5 4h14",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  bolt: "M13 3L5 13.5h6L10 21l9-11h-6z",
  flame: "M12 21c4 0 6.5-2.6 6.5-6.3 0-4.4-4.2-6.4-4.8-11.2-2.3 1.6-3.7 4.3-3.4 7.2-1.5-.6-2.4-2-2.6-3.4C5.9 9.2 5.5 11.4 5.5 14.7 5.5 18.4 8 21 12 21z",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3",
};
export function Icon({ name, size = 22, stroke = 1.9 }: { name: keyof typeof P | string; size?: number; stroke?: number }) {
  const d = P[name] ?? "";
  const dot = name === "more";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={dot ? 3.2 : stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "settings" && (<><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>)}
      <path d={d} />
    </svg>
  );
}
