import { useMemo, useState } from 'react';
import { useStore } from '../store.js';
import { addMonths, monthStart, monthTitle, todayISO } from '../lib/date.js';
import { buildMonthExport, exportText } from '../lib/export.js';
import { haptic } from '../lib/telegram.js';
import { IconLeft, IconRight, IconExport, IconSpark } from './Icons.jsx';

export default function ExportView() {
  const tasks = useStore((s) => s.tasks);
  const items = useStore((s) => s.items);
  const showToast = useStore((s) => s.showToast);
  const [month, setMonth] = useState(() => monthStart(todayISO()));
  const [copied, setCopied] = useState(false);
  const data = useMemo(() => buildMonthExport({ tasks, items }, month), [tasks, items, month]);
  const text = useMemo(() => exportText(data), [data]);
  const s = data.summary;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      haptic('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Браузер не дал скопировать. Скачай файл и приложи его в чат с Claude.');
    }
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planner-${data.month}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="page export">
      <header className="page-head">
        <div>
          <h1 className="page-title">Экспорт для Claude</h1>
          <p className="muted small">Месяц целиком одним блоком: задачи, привычки, настроение, заметки, сферы и 12 недель. Вставь в чат с Claude и получи разбор.</p>
        </div>
      </header>

      <section className="glass export-card">
        <div className="export-month">
          <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Предыдущий месяц">
            <IconLeft />
          </button>
          <b>{monthTitle(month)}</b>
          <button type="button" className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Следующий месяц" disabled={month >= monthStart(todayISO())}>
            <IconRight />
          </button>
        </div>
        <dl className="export-stats">
          <div>
            <dt>Задач</dt>
            <dd>
              {s.tasks_done}
              <small>/{s.tasks_planned}</small>
            </dd>
          </div>
          <div>
            <dt>Сделано часов</dt>
            <dd>{Math.round(s.minutes_done / 6) / 10}</dd>
          </div>
          <div>
            <dt>Главных задач</dt>
            <dd>
              {s.frogs_done}
              <small>/{s.frogs_planned}</small>
            </dd>
          </div>
          <div>
            <dt>Очков</dt>
            <dd>{s.points}</dd>
          </div>
        </dl>
        <div className="export-actions">
          <button type="button" className="primary-btn" onClick={copy} disabled={!s.tasks_planned && !data.habits.length}>
            <IconSpark width={18} height={18} />
            {copied ? 'Скопировано' : 'Скопировать для Claude'}
          </button>
          <button type="button" className="secondary-btn" onClick={download}>
            <IconExport width={18} height={18} />
            Скачать JSON
          </button>
        </div>
        <p className="muted small">
          В буфер уходит готовый запрос («найди паттерны, где я переоцениваю себя, связь настроения с нагрузкой, три изменения на следующий
          месяц») и данные. Объём: {Math.round(text.length / 1000)} тыс. символов.
        </p>
      </section>

      <details className="glass export-preview">
        <summary>Что именно уйдёт</summary>
        <pre>{text.slice(0, 4000)}{text.length > 4000 ? '\n…' : ''}</pre>
      </details>
    </div>
  );
}
