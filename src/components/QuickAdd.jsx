import { forwardRef, useMemo, useState } from 'react';
import { useStore } from '../store.js';
import { parseQuickAdd } from '../lib/parse.js';
import { dayMonth, formatDuration, relativeLabel } from '../lib/date.js';
import { haptic } from '../lib/telegram.js';
import { IconPlus } from './Icons.jsx';

const SLOT_LABEL = { morning: 'утро', afternoon: 'день', evening: 'вечер' };

const QuickAdd = forwardRef(function QuickAdd({ defaultDate }, ref) {
  const [value, setValue] = useState('');
  const addTask = useStore((s) => s.addTask);
  const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value) : null), [value]);

  const submit = (e) => {
    e.preventDefault();
    if (!parsed?.title) return;
    addTask({ ...parsed, date: parsed.date || defaultDate });
    setValue('');
    haptic('light');
  };

  const chips = [];
  if (parsed) {
    if (parsed.date && parsed.date !== defaultDate) chips.push(relativeLabel(parsed.date) || dayMonth(parsed.date));
    if (parsed.time) chips.push(parsed.time);
    else if (parsed.slot) chips.push(SLOT_LABEL[parsed.slot]);
    if (parsed.duration_min) chips.push(formatDuration(parsed.duration_min));
    if (parsed.area) chips.push(`#${parsed.area}`);
    if (parsed.frog) chips.push('главное на день');
    else if (parsed.priority === 1) chips.push('важно');
    if (parsed.priority === 3) chips.push('не срочно');
  }

  return (
    <form className="quick" onSubmit={submit}>
      <label className="quick-field">
        <span className="sr-only">Новая задача</span>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Созвон в 16:00 1ч #работа"
          aria-describedby="quick-hint"
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="quick-add" disabled={!parsed?.title} aria-label="Добавить задачу">
          <IconPlus />
        </button>
      </label>
      {chips.length === 0 && (
        <p id="quick-hint" className="quick-hint">
          Пиши как думаешь: «завтра в 10», «1.5ч», «#сфера», «!» важно, «!!» главное на день
        </p>
      )}
      {chips.length > 0 && (
        <div className="quick-chips" aria-live="polite">
          {chips.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      )}
    </form>
  );
});

export default QuickAdd;
