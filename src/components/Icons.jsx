const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconDay = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const IconWeek = (p) => (
  <svg {...base} {...p}><path d="M4 6v12M9 6v12M14 6v12M19 6v12" /></svg>
);
export const IconSettings = (p) => (
  <svg {...base} {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
);
export const IconMic = (p) => (
  <svg {...base} width={14} height={14} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
);
export const IconLeft = (p) => (
  <svg {...base} {...p}><path d="M14.5 6l-6 6 6 6" /></svg>
);
export const IconRight = (p) => (
  <svg {...base} {...p}><path d="M9.5 6l6 6-6 6" /></svg>
);
export const IconPlus = (p) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = (p) => (
  <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconCheck = (p) => (
  <svg {...base} strokeWidth={2.6} width={14} height={14} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
