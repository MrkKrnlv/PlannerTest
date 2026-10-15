import { useStore } from '../store.js';
import TimersView from './TimersView.jsx';
import NotesView from './NotesView.jsx';
import Settings from './Settings.jsx';
import ExportView from './ExportView.jsx';
import ImportView from './ImportView.jsx';
import { IconLeft, IconNote, IconSettings, IconTimer, IconRight, IconSpark, IconHelp, IconImport, IconSun, IconMoon } from './Icons.jsx';

const ENTRIES = [
  ['timers', 'Таймеры', 'Фокус на задаче и параллельные таймеры', IconTimer],
  ['notes', 'Заметки', 'Все заметки и итоги дней с поиском', IconNote],
  ['export', 'Экспорт для Claude', 'Выгрузить месяц и получить разбор', IconSpark],
  ['import', 'Импорт', 'Загрузить задачи и привычки из JSON', IconImport],
  ['settings', 'Настройки', 'Мои часы, синхронизация, ключ для браузера', IconSettings],
];

export default function MoreView() {
  const sub = useStore((s) => s.moreView);
  const setMoreView = useStore((s) => s.setMoreView);
  const timers = useStore((s) => s.timers.length);
  const user = useStore((s) => s.user);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const tgScheme = document.documentElement.dataset.tgScheme;
  const isDark = theme === 'auto' ? (tgScheme ? tgScheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches) : theme === 'dark';

  if (sub) {
    return (
      <div className="more-sub">
        <button type="button" className="back-btn" onClick={() => setMoreView(null)}>
          <IconLeft width={18} height={18} />
          Ещё
        </button>
        {sub === 'timers' && <TimersView />}
        {sub === 'notes' && <NotesView />}
        {sub === 'export' && <ExportView />}
        {sub === 'import' && <ImportView />}
        {sub === 'settings' && <Settings />}
      </div>
    );
  }

  return (
    <div className="page more">
      <header className="page-head">
        <div>
          <h1 className="page-title">Ещё</h1>
          {user?.name && <p className="muted small">{user.name}</p>}
        </div>
        <button
          type="button"
          className="glass-btn theme-btn"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
          title={theme === 'auto' ? 'Сейчас тема как в системе' : undefined}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
      </header>
      <ul className="menu glass">
        {ENTRIES.map(([id, title, subtitle, Icon]) => (
          <li key={id}>
            <button type="button" className="menu-item" onClick={() => setMoreView(id)}>
              <span className="menu-icon">
                <Icon />
              </span>
              <span>
                <b>{title}</b>
                <small className="muted">{id === 'timers' && timers ? `Запущено: ${timers}` : subtitle}</small>
              </span>
              <IconRight width={18} height={18} className="muted" />
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="menu-item" onClick={() => useStore.setState({ onboarded: false })}>
            <span className="menu-icon">
              <IconHelp />
            </span>
            <span>
              <b>Как пользоваться</b>
              <small className="muted">Короткое знакомство с разделами</small>
            </span>
            <IconRight width={18} height={18} className="muted" />
          </button>
        </li>
      </ul>
    </div>
  );
}
