const base = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};
const I = (paths) => (p) => <svg {...base} {...p}>{paths}</svg>;

export const IconDay = I(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>);
export const IconCalendar = I(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>);
export const IconHabit = I(<><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></>);
export const IconGoal = I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>);
export const IconMore = I(<><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>);
export const IconTimer = I(<><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></>);
export const IconNote = I(<><path d="M6 3.5h9l3.5 3.5v13.5H6z" /><path d="M14.5 3.5V7.5h4M9 12h6M9 15.5h6" /></>);
export const IconSettings = I(<><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>);
export const IconMic = (p) => <svg {...base} width={14} height={14} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>;
export const IconLeft = I(<path d="M14.5 6l-6 6 6 6" />);
export const IconRight = I(<path d="M9.5 6l6 6-6 6" />);
export const IconPlus = I(<path d="M12 5v14M5 12h14" />);
export const IconClose = I(<path d="M6 6l12 12M18 6L6 18" />);
export const IconCheck = (p) => <svg {...base} strokeWidth={2.6} width={14} height={14} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconWand = I(<><path d="M4 20L15 9M13 7l2-2 4 4-2 2z" /><path d="M6 3v3M4.5 4.5h3M19 14v3M17.5 15.5h3" /></>);
export const IconUndo = I(<><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>);
export const IconPlay = (p) => <svg {...base} {...p}><path d="M7 5v14l12-7z" fill="currentColor" stroke="none" /></svg>;
export const IconPause = (p) => <svg {...base} {...p}><path d="M8 5v14M16 5v14" strokeWidth={3} /></svg>;
export const IconFlag = (p) => <svg {...base} width={14} height={14} {...p}><path d="M5 21V4h11l-2 4 2 4H5" fill="currentColor" fillOpacity=".25" /></svg>;
export const IconBolt = (p) => <svg {...base} width={14} height={14} {...p}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></svg>;
export const IconBell = I(<><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>);
export const IconSearch = I(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></>);
export const IconTrash = I(<><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" /></>);
export const IconRepeat = (p) => <svg {...base} width={14} height={14} {...p}><path d="M4 11V9a4 4 0 0 1 4-4h11l-3-3M20 13v2a4 4 0 0 1-4 4H5l3 3" /></svg>;
export const IconList = (p) => <svg {...base} width={14} height={14} {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></svg>;
export const IconInbox = I(<><path d="M3.5 13.5l2.5-8h12l2.5 8v5h-17z" /><path d="M3.5 13.5h5l1 2h5l1-2h5" /></>);
export const IconSpark = I(<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>);
export const IconExport = I(<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v6h14v-6" /></>);
export const IconHelp = I(<><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 16.8v.2" /></>);
export const IconGrowth = I(<><path d="M4 19h16" /><path d="M6 15l4-4 3 3 5-6" /><path d="M15 8h3v3" /></>);
export const IconToday = I(<><rect x="4" y="4.5" width="16" height="15.5" rx="4" /><path d="M8 3v3M16 3v3M4 9.5h16" /><circle cx="12" cy="14.5" r="2" fill="currentColor" stroke="none" /></>);
export const IconImport = I(<><path d="M12 15V3M7 10l5 5 5-5" /><path d="M5 14v6h14v-6" /></>);
export const IconSun = I(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>);
export const IconMoon = I(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />);
