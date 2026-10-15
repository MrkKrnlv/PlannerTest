import { useState } from 'react';
import { useStore } from '../store.js';
import { api } from '../lib/api.js';

export default function Connect({ error: bootError }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState(bootError || null);
  const [busy, setBusy] = useState(false);
  const { setAuth, enableLocalOnly } = useStore.getState();

  const submit = async (e) => {
    e.preventDefault();
    const token = key.trim();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await api('/me', { token });
      setAuth({ token, user });
    } catch (err) {
      setError(err.status === 401 ? 'Ключ не подошёл. Скопируй его заново в Telegram: Настройки, «Ключ для браузера».' : `Сервер недоступен: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="connect">
      <div className="connect-card">
        <div className="brand brand-lg" aria-hidden="true">
          <span className="brand-strip" />
        </div>
        <h1 className="connect-title">Планер</h1>
        <p>
          Открой бота в Telegram, нажми кнопку «Планер», затем в настройках скопируй ключ для браузера. Вставь его сюда, и задачи
          будут одинаковыми на телефоне и компьютере.
        </p>
        <form onSubmit={submit} className="connect-form">
          <label className="field">
            <span>Ключ</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Вставь ключ" />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="primary-btn" disabled={busy || !key.trim()}>
            {busy ? 'Проверяю' : 'Войти'}
          </button>
        </form>
        <button type="button" className="text-btn" onClick={enableLocalOnly}>
          Пользоваться без синхронизации
        </button>
      </div>
    </main>
  );
}
