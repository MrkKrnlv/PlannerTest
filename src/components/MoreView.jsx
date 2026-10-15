import { useStore } from '../store.js';
import TimersView from './TimersView.jsx';
import NotesView from './NotesView.jsx';
import Settings from './Settings.jsx';
import { IconLeft, IconNote, IconSettings, IconTimer, IconRight } from './Icons.jsx';

const ENTRIES = [
  ['timers', 'Таймеры', 'Фокус на задаче и параллельные таймеры', IconTimer],
  ['notes', 'Заметки', 'Все заметки и итоги дней с поиском', IconNote],
  ['settings', 'Настройки', 'Мой день, синхронизация, ключ для браузера', IconSettings],
];

export default function MoreView() {
  const sub = useStore((s) => s.moreView);
  const setMoreView = useStore((s) => s.setMoreView);
  const timers = useStore((s) => s.timers.length);

  if (sub) {
    return (
      <div className="more-sub">
        <button type="button" className="back-btn" onClick={() => setMoreView(null)}>
          <IconLeft width={18} height={18} />
          Ещё
        </button>
        {sub === 'timers' && <TimersView />}
        {sub === 'notes' && <NotesView />}
        {sub === 'settings' && <Settings />}
      </div>
    );
  }

  return (
    <div className="page more">
      <header className="page-head">
        <h1 className="page-title">Ещё</h1>
      </header>
      <ul className="menu">
        {ENTRIES.map(([id, title, sub, Icon]) => (
          <li key={id}>
            <button type="button" className="card menu-item" onClick={() => setMoreView(id)}>
              <Icon />
              <span>
                <b>{title}</b>
                <small className="muted">{id === 'timers' && timers ? `Запущено: ${timers}` : sub}</small>
              </span>
              <IconRight width={18} height={18} className="muted" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
