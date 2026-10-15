import { useStore, settingsOf } from '../../store.js';
import { capacity } from '../../lib/capacity.js';
import { autoplan } from '../../lib/autoplan.js';
import { addDays, formatShort, plural } from '../../lib/date.js';
import { haptic } from '../../lib/telegram.js';
import { Meter } from '../ui.jsx';
import { IconUndo, IconWand } from '../Icons.jsx';

export default function LoadPanel({ className = '', date, dayTasks }) {
  const items = useStore((s) => s.items);
  const lastAutoplan = useStore((s) => s.lastAutoplan);
  const { applyAutoplan, undoAutoplan, moveTasks, showToast } = useStore.getState();
  const settings = settingsOf(items);
  const c = capacity(dayTasks, settings);
  const openUntimed = dayTasks.filter((t) => !t.done && !t.time).length;

  const runAutoplan = () => {
    const { placements, unplaced } = autoplan(dayTasks, settings, date);
    const n = Object.keys(placements).length;
    if (!n) {
      showToast(unplaced.length ? 'Свободного времени не осталось. Перенеси что-нибудь на завтра.' : 'Все задачи уже стоят по времени.');
      return;
    }
    applyAutoplan(date, placements);
    haptic('success');
    const extra = unplaced.length ? ` Не влезло: ${unplaced.length}.` : '';
    showToast(`Расставил ${n} ${plural(n, 'задачу', 'задачи', 'задач')}.${extra}`, { label: 'Отменить', run: undoAutoplan });
  };

  const moveSuggested = () => {
    moveTasks(c.suggestions.map((t) => t.id), addDays(date, 1));
    haptic('light');
    showToast(`Перенёс на завтра: ${c.suggestions.length}.`);
  };

  return (
    <section className={`card load ${className}`} aria-label="Нагрузка дня">
      <div className="load-meters">
        <Meter label="Время" value={c.timeLoad} max={c.timeCap} text={`${formatShort(c.timeLoad)} из ${formatShort(c.timeCap)}`} />
        <Meter label="Голова" tone="deep" value={c.headLoad} max={c.headCap} text={`${formatShort(c.headLoad)} из ${formatShort(c.headCap)}`} />
      </div>
      {c.suggestions.length > 0 && (
        <div className="load-hint">
          <p>
            День не влезает. На завтра можно спокойно перенести: {c.suggestions.map((t) => `«${t.title}»`).join(', ')}.
          </p>
          <button type="button" className="secondary-btn" onClick={moveSuggested}>
            Перенести на завтра
          </button>
        </div>
      )}
      <div className="load-actions">
        <button type="button" className="primary-btn" onClick={runAutoplan} disabled={!openUntimed}>
          <IconWand />
          Расставить по времени
        </button>
        {lastAutoplan?.date === date && (
          <button type="button" className="text-btn" onClick={undoAutoplan}>
            <IconUndo width={16} height={16} />
            Отменить
          </button>
        )}
      </div>
      <p className="muted small">
        Главное и глубокая работа уходят в пик {settings.peakStart}–{settings.peakEnd}, мелочи после него, обед свободен.
      </p>
    </section>
  );
}
