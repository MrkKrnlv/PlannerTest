import { useState } from 'react';
import { useStore } from '../store.js';
import { syncNow } from '../lib/sync.js';
import { getTelegram } from '../lib/telegram.js';
import { formatDuration } from '../lib/date.js';
import { SYNC_TEXT } from './SyncDot.jsx';

const CAPACITIES = [240, 360, 480, 600];

export default function Settings() {
  const { user, token, localOnly, sync, capacityMin, dirty } = useStore();
  const { setCapacity, logout } = useStore.getState();
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const inTelegram = !!getTelegram();
  const pending = Object.keys(dirty).length;

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
    <div className="settings">
      <h1 className="page-title">Настройки</h1>

      <section className="panel">
        <h2 className="section-title">Синхронизация</h2>
        {localOnly ? (
          <p>Задачи хранятся только на этом устройстве. Чтобы синхронизировать с телефоном, войди по ключу.</p>
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
        <section className="panel">
          <h2 className="section-title">Ключ для браузера</h2>
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

      <section className="panel">
        <h2 className="section-title">Норма на день</h2>
        <p>Сколько времени задач в день ты реально успеваешь. Полоса дня покажет перебор.</p>
        <div className="seg-control">
          {CAPACITIES.map((m) => (
            <button key={m} type="button" aria-pressed={capacityMin === m} onClick={() => setCapacity(m)}>
              {formatDuration(m)}
            </button>
          ))}
        </div>
      </section>

      {!inTelegram && (
        <section className="panel">
          <h2 className="section-title">Установка на телефон</h2>
          <p>
            iPhone: Safari, «Поделиться», «На экран Домой». Android: Chrome, меню, «Установить приложение». После установки
            планер открывается как отдельное приложение и работает без сети.
          </p>
        </section>
      )}

      {!inTelegram && (
        <section className="panel">
          <h2 className="section-title">Выход</h2>
          <p>Удалит задачи с этого устройства. На сервере они останутся.</p>
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
