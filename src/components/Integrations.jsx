import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../lib/api.js';
import { haptic } from '../lib/telegram.js';

const ago = (ts) => {
  if (!ts) return 'ещё не было';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'только что' : m < 60 ? `${m} мин назад` : new Date(ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** Telegram-бот живёт в этом же Worker: кнопка привязывает вебхук и меню бота */
export function BotCard() {
  const token = useStore((s) => s.token);
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = () =>
    api('/telegram/status', { token })
      .then(setSt)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return null;
  const connect = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api('/telegram/setup', { token, method: 'POST' });
      haptic('success');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Голосовой бот</h2>
      <p className="muted small">
        Надиктуй боту дела, и они появятся здесь. Расшифровка и разбор работают на Workers AI в этом же Cloudflare-проекте.
      </p>
      {st && (
        <p className="status-line" data-ok={st.connected || undefined}>
          {!st.configured
            ? 'В Cloudflare не задан секрет BOT_TOKEN.'
            : st.connected
              ? `Подключён${st.bot ? `: @${st.bot}` : ''}. ${st.pending ? `В очереди ${st.pending}.` : 'Очередь пустая.'}`
              : st.url
                ? 'Сообщения бота сейчас уходят в другое место (например, в n8n).'
                : 'Бот ещё не привязан к планеру.'}
          {st.lastError && ` Последняя ошибка Telegram: ${st.lastError}`}
          {st.configured && !st.ai && ' Нет привязки Workers AI (AI) у Worker.'}
        </p>
      )}
      {err && <p className="error">{err}</p>}
      <button type="button" className={st?.connected ? 'secondary-btn' : 'primary-btn'} onClick={connect} disabled={busy}>
        {busy ? 'Подключаю' : st?.connected ? 'Переподключить' : 'Подключить бота к планеру'}
      </button>
    </section>
  );
}

/** Notion: задачи с датой уходят в базу данных, которую показывает Notion Calendar */
export function NotionCard() {
  const token = useStore((s) => s.token);
  const [st, setSt] = useState(null);
  const [form, setForm] = useState({ token: '', page: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const load = () =>
    api('/notion/status', { token })
      .then(setSt)
      .catch((e) => setErr(e.message));
  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (!token) return null;

  const run = async (path, body) => {
    setBusy(true);
    setErr(null);
    try {
      await api(path, { token, method: 'POST', body });
      haptic('success');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Notion Calendar</h2>
      {st?.connected ? (
        <>
          <p className="status-line" data-ok={!st.error || undefined}>
            Подключено. Синк {ago(st.syncedAt)}
            {st.pending ? `, ждут отправки: ${st.pending}` : ''}. Изменения уходят раз в 5 минут.
            {st.error && ` Ошибка: ${st.error}`}
          </p>
          <p className="muted small">
            В Notion Calendar открой настройки календарей и включи базу «Планер», задачи появятся в календаре. Правь задачи здесь:
            синк односторонний.
          </p>
          <div className="btn-row">
            <button type="button" className="secondary-btn" onClick={() => run('/notion/sync')} disabled={busy}>
              {busy ? 'Синхронизирую' : 'Синхронизировать сейчас'}
            </button>
            <a className="text-btn" href={st.databaseUrl} target="_blank" rel="noreferrer">
              Открыть базу
            </a>
            <button type="button" className="text-btn danger" onClick={() => confirm('Отключить Notion? База в Notion останется.') && run('/notion/disconnect')}>
              Отключить
            </button>
          </div>
        </>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            run('/notion/connect', form);
          }}
        >
          <ol className="howto">
            <li>
              Открой <b>notion.so/profile/integrations</b>, создай внутреннюю интеграцию и скопируй её секрет.
            </li>
            <li>Создай в Notion пустую страницу «Планер», нажми «•••» → Connections и добавь свою интеграцию.</li>
            <li>Вставь секрет и ссылку на страницу. Внутри неё появится база с задачами.</li>
          </ol>
          <label className="field">
            <span>Секрет интеграции</span>
            <input value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="ntn_…" autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            <span>Ссылка на страницу</span>
            <input value={form.page} onChange={(e) => setForm({ ...form, page: e.target.value })} placeholder="https://www.notion.so/…" autoComplete="off" />
          </label>
          <button type="submit" className="primary-btn" disabled={busy || !form.token.trim() || !form.page.trim()}>
            {busy ? 'Подключаю' : 'Подключить Notion'}
          </button>
        </form>
      )}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
