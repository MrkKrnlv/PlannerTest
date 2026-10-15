import { useState } from 'react';
import { useStore, settingsOf } from '../store.js';
import { syncNow } from '../lib/sync.js';
import { getTelegram } from '../lib/telegram.js';
import { SYNC_TEXT } from './SyncDot.jsx';
import { Segmented } from './ui.jsx';
import { BotCard, NotionCard } from './Integrations.jsx';

const TIME_FIELDS = [
  ['dayStart', 'Начало дня'],
  ['dayEnd', 'Конец дня'],
  ['peakStart', 'Пик энергии с'],
  ['peakEnd', 'Пик энергии до'],
  ['lunchStart', 'Обед с'],
  ['lunchEnd', 'Обед до'],
];

export default function Settings() {
  const user = useStore((s) => s.user);
  const token = useStore((s) => s.token);
  const localOnly = useStore((s) => s.localOnly);
  const sync = useStore((s) => s.sync);
  const items = useStore((s) => s.items);
  const pending = useStore((s) => Object.keys(s.dirty).length + Object.keys(s.itemsDirty).length);
  const theme = useStore((s) => s.theme);
  const { patchItem, logout, setTheme } = useStore.getState();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const inTelegram = !!getTelegram();
  const st = settingsOf(items);
  const setS = (patch) => patchItem('settings', 'settings', patch);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShown(true);
    }
  };

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">Настройки</h1>
        </div>
      </header>

      <section className="card">
        <h2 className="card-title">Тема</h2>
        <Segmented
          label="Тема"
          value={theme}
          onChange={setTheme}
          options={[
            ['auto', inTelegram ? 'Как в Telegram' : 'Как в системе'],
            ['light', 'Светлая'],
            ['dark', 'Тёмная'],
          ]}
        />
      </section>

      <section className="card">
        <h2 className="card-title">Мой день</h2>
        <p className="muted small">По этим часам считается нагрузка и работает автоплан. Синхронизируется между устройствами.</p>
        <div className="time-grid">
          {TIME_FIELDS.map(([k, l]) => (
            <label key={k} className="field">
              <span>{l}</span>
              <input type="time" value={st[k]} onChange={(e) => e.target.value && setS({ [k]: e.target.value })} />
            </label>
          ))}
          <label className="field">
            <span>Глубокой работы в день, ч</span>
            <input type="number" min={1} max={8} step={0.5} value={st.headCapMin / 60} onChange={(e) => setS({ headCapMin: Math.round((Number(e.target.value) || 3.5) * 60) })} />
          </label>
          <label className="field">
            <span>Реально занятого времени, %</span>
            <input type="number" min={30} max={100} step={5} value={Math.round(st.timeShare * 100)} onChange={(e) => setS({ timeShare: Math.min(1, Math.max(0.3, (Number(e.target.value) || 65) / 100)) })} />
          </label>
          <label className="field">
            <span>Перерыв после блока, мин</span>
            <input type="number" min={0} max={60} step={5} value={st.breakMin} onChange={(e) => setS({ breakMin: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />
          </label>
        </div>
      </section>

      <BotCard />
      <NotionCard />

      <section className="card">
        <h2 className="card-title">Синхронизация</h2>
        {localOnly ? (
          <p>Данные хранятся только на этом устройстве. Чтобы синхронизировать с телефоном, выйди и войди по ключу.</p>
        ) : (
          <>
            <p>
              {user?.name ? `${user.name}. ` : ''}
              {SYNC_TEXT[sync.status]}
              {sync.at && ` Последний раз в ${new Date(sync.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.`}
              {pending > 0 && ` Ждут отправки: ${pending}.`}
            </p>
            {sync.error && sync.status !== 'ok' && <p className="muted small">Ошибка: {sync.error}</p>}
            <button type="button" className="secondary-btn" onClick={syncNow}>
              Синхронизировать сейчас
            </button>
          </>
        )}
      </section>

      {token && (
        <section className="card">
          <h2 className="card-title">Ключ для браузера</h2>
          <p>
            {inTelegram
              ? 'Скопируй ключ и вставь его в браузере на компьютере, чтобы видеть те же задачи.'
              : 'Этим ключом вход выполняется на других устройствах. Не показывай его другим.'}
          </p>
          <div className="key-row">
            <code className="key">{shown ? token : '•'.repeat(24)}</code>
            <button type="button" className="text-btn" onClick={() => setShown((v) => !v)}>
              {shown ? 'Скрыть' : 'Показать'}
            </button>
            <button type="button" className="secondary-btn" onClick={copy}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
          </div>
        </section>
      )}

      {!inTelegram && (
        <section className="card">
          <h2 className="card-title">Установка на телефон</h2>
          <p>
            iPhone: Safari, «Поделиться», «На экран Домой». Android: Chrome, меню, «Установить приложение». Планер откроется как отдельное
            приложение и будет работать без сети.
          </p>
        </section>
      )}

      {!inTelegram && (
        <section className="card">
          <h2 className="card-title">Выход</h2>
          <p>Удалит данные с этого устройства. На сервере они останутся.</p>
          <button
            type="button"
            className="text-btn danger"
            onClick={() => {
              if (pending && !confirm(`${pending} правок ещё не отправлены и пропадут. Выйти?`)) return;
              logout();
            }}
          >
            Выйти на этом устройстве
          </button>
        </section>
      )}
    </div>
  );
}
