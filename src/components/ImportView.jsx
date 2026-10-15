import { useState } from 'react';
import { useStore } from '../store.js';
import { importData } from '../lib/importData.js';
import { haptic } from '../lib/telegram.js';

const EXAMPLE = `{
  "areas": "default",
  "habits": [{ "name": "Таблетки", "remind": "09:00" }],
  "tasks": [
    { "title": "Тренировка", "date": "2026-10-16", "time": "19:00", "duration_min": 90,
      "area": "здоровье", "repeat": { "freq": "weekly", "days": [1, 3, 5] } },
    { "title": "Смонтировать ролик", "date": "2026-10-17", "duration_min": 180, "deep": true }
  ]
}`;

export default function ImportView() {
  const showToast = useStore((s) => s.showToast);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = (raw) => {
    setError(null);
    setResult(null);
    try {
      const r = importData(raw);
      setResult(r);
      haptic('success');
      showToast(`Импортировано: задач ${r.tasks}, привычек ${r.habits + r.habitsUpdated}`);
    } catch (e) {
      setError(e instanceof SyntaxError ? `Это не JSON: ${e.message}` : e.message);
    }
  };

  return (
    <div className="page import">
      <header className="page-head">
        <div>
          <h1 className="page-title">Импорт</h1>
          <p className="muted small">Загрузи набор задач, привычек и сфер одним JSON. Повторный импорт того же файла ничего не задвоит.</p>
        </div>
      </header>
      <section className="card">
        <label className="field">
          <span>Файл .json</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) run(await f.text());
              e.target.value = '';
            }}
          />
        </label>
        <label className="field">
          <span>Или вставь JSON</span>
          <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} className="mono" />
        </label>
        <button type="button" className="primary-btn" disabled={!text.trim()} onClick={() => run(text)}>
          Импортировать
        </button>
        {error && <p className="error">{error}</p>}
        {result && (
          <p className="status-line" data-ok>
            Готово: задач {result.tasks}, новых привычек {result.habits}, обновлено привычек {result.habitsUpdated}, сфер {result.areas}
            {result.skipped ? `, пропущено совпадений ${result.skipped}` : ''}.
          </p>
        )}
      </section>
      <details className="card">
        <summary className="card-title">Формат</summary>
        <pre className="mono-block">{EXAMPLE}</pre>
        <p className="muted small">
          repeat.freq: daily, weekdays, weekly (с days: 0 — вс, 1 — пн … 6 — сб), monthly. Задача без date попадёт во входящие.
        </p>
      </details>
    </div>
  );
}
