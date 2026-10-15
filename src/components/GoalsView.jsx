import { useMemo, useState } from 'react';
import { useStore, liveItems, liveTasks, hasLog, uuid } from '../store.js';
import { dayMonth, formatShort, plural, todayISO, weekStart } from '../lib/date.js';
import { AREA_COLORS, DEFAULT_AREAS, areaStats, quietHints } from '../lib/areas.js';
import { DEFAULT_PLAN, cycleScore, tacticActive, tacticLogId, weekDates, weekOf, weekScore } from '../lib/plan12.js';
import { haptic } from '../lib/telegram.js';
import { Segmented, Sheet, Dot, Meter } from './ui.jsx';
import { IconCheck, IconPlus, IconTrash } from './Icons.jsx';

/* ---------------- Сферы ---------------- */

function AreaForm({ area, onClose }) {
  const { putItem, patchItem, removeItem } = useStore.getState();
  const [f, setF] = useState(area ? { ...area.data } : { name: '', goal: '', weeklyMin: 180, color: 'cobalt' });
  const save = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    const data = { ...f, name: f.name.trim().toLowerCase().replace(/^#/, '') };
    if (area) patchItem(area.id, 'area', data);
    else putItem(`area-${uuid()}`, 'area', { ...data, order: Date.now() });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={area ? 'Сфера' : 'Новая сфера'}
      footer={
        <>
          {area ? (
            <button type="button" className="text-btn danger" onClick={() => (removeItem(area.id), onClose())}>
              Удалить
            </button>
          ) : (
            <span />
          )}
          <button type="submit" form="area-form" className="primary-btn">
            Сохранить
          </button>
        </>
      }
    >
      <form id="area-form" className="form" onSubmit={save}>
        <label className="field">
          <span>Название (это же тег задачи: #название)</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={30} autoFocus={!area} />
        </label>
        <label className="field">
          <span>Цель</span>
          <input value={f.goal || ''} onChange={(e) => setF({ ...f, goal: e.target.value })} maxLength={120} placeholder="Чего хочешь в этой сфере" />
        </label>
        <label className="field">
          <span>Часов в неделю</span>
          <input type="number" min={0} max={80} step={0.5} value={f.weeklyMin / 60} onChange={(e) => setF({ ...f, weeklyMin: Math.round((Number(e.target.value) || 0) * 60) })} />
        </label>
        <fieldset className="field">
          <legend>Цвет</legend>
          <div className="seg-control">
            {AREA_COLORS.map((c) => (
              <button key={c} type="button" className="color-btn" aria-pressed={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })}>
                <Dot color={c} />
              </button>
            ))}
          </div>
        </fieldset>
      </form>
    </Sheet>
  );
}

function AreasView() {
  const items = useStore((s) => s.items);
  const tasksMap = useStore((s) => s.tasks);
  const putItem = useStore((s) => s.putItem);
  const [editing, setEditing] = useState(null);
  const areas = useMemo(() => liveItems(items, 'area').sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0)), [items]);
  const tasks = useMemo(() => liveTasks(tasksMap), [tasksMap]);
  const hints = quietHints(areas, tasks);

  const seed = () => {
    DEFAULT_AREAS.forEach(({ id, ...data }, i) => putItem(id, 'area', { ...data, order: i }));
    haptic('success');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Сферы жизни</h1>
          <p className="muted small">Прогресс за эту неделю по сделанным задачам с тегом сферы</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setEditing('new')}>
          <IconPlus />
          Сфера
        </button>
      </header>

      {areas.length === 0 && (
        <div className="card empty-card">
          <p>Сфер пока нет. Можно начать со стандартного набора: работа, учёба, здоровье, люди, дом, творчество.</p>
          <button type="button" className="secondary-btn" onClick={seed}>
            Добавить стандартные сферы
          </button>
        </div>
      )}

      {hints.length > 0 && areas.length > 0 && (
        <ul className="hints">
          {hints.map((h) => (
            <li key={h.area.id} className="hint">
              <Dot color={h.area.data.color} />
              <span>
                {h.idleDays == null
                  ? `В сфере «${h.area.data.name}» ещё не было сделанных задач.`
                  : `«${h.area.data.name}»: ${h.idleDays} ${plural(h.idleDays, 'день', 'дня', 'дней')} без сделанных задач.`}{' '}
                <span className="muted">Может, запланировать что-то небольшое?</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="area-list">
        {areas.map((a) => {
          const st = areaStats(a, tasks);
          return (
            <li key={a.id}>
              <button type="button" className="card area" data-color={a.data.color} onClick={() => setEditing(a)}>
                <span className="area-name">
                  <Dot color={a.data.color} />
                  {a.data.name}
                </span>
                {a.data.goal && <span className="area-goal">{a.data.goal}</span>}
                <Meter
                  label="Неделя"
                  tone={a.data.color}
                  value={st.weekDone}
                  max={a.data.weeklyMin || 1}
                  text={`${formatShort(st.weekDone)} из ${formatShort(a.data.weeklyMin || 0)}`}
                />
                <span className="muted small">
                  В плане на неделю {formatShort(st.weekPlanned)}
                  {st.lastDate ? `, последняя задача ${dayMonth(st.lastDate)}` : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {editing && <AreaForm area={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ---------------- 12 недель ---------------- */

function PlanStart() {
  const putItem = useStore((s) => s.putItem);
  const [start, setStart] = useState(DEFAULT_PLAN.start);
  return (
    <section className="card plan-start">
      <h2 className="card-title">Цикл 12 недель</h2>
      <p>
        Вместо года — 12 недель. Ставишь 1–3 цели, к каждой пару еженедельных шагов и каждую неделю отмечаешь выполнение. Цель —
        85% шагов. Тринадцатая неделя уходит на обзор.
      </p>
      <label className="field">
        <span>Начало цикла (понедельник)</span>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value ? weekStart(e.target.value) : DEFAULT_PLAN.start)} />
      </label>
      <button type="button" className="primary-btn" onClick={() => putItem('plan', 'plan', { ...DEFAULT_PLAN, start })}>
        Начать цикл
      </button>
    </section>
  );
}

function Goal({ goal, tactics, week, items, areas }) {
  const { putItem, removeItem, toggleLog } = useStore.getState();
  const [text, setText] = useState('');
  const mine = tactics.filter((t) => t.data.goal === goal.id);
  const area = areas.find((a) => a.data.name === goal.data.area);
  const inCycle = week >= 1 && week <= 12;

  return (
    <li className="card goal">
      <div className="goal-head">
        <h3 className="goal-title">
          {area && <Dot color={area.data.color} />}
          {goal.data.title}
        </h3>
        <button type="button" className="icon-btn" aria-label="Удалить цель" onClick={() => removeItem(goal.id)}>
          <IconTrash width={18} height={18} />
        </button>
      </div>
      <ul className="tactics">
        {mine.map((t) => {
          const id = tacticLogId(t.id, week);
          const done = hasLog(items, id);
          return (
            <li key={t.id} className="tactic" data-done={done || undefined}>
              <button
                type="button"
                className="check"
                aria-pressed={done}
                disabled={!inCycle || !tacticActive(t, week)}
                aria-label={`${t.data.title}: ${done ? 'сделано на этой неделе' : 'отметить'}`}
                onClick={() => {
                  toggleLog(id, 'tactic_log');
                  haptic(done ? 'light' : 'success');
                }}
              >
                <IconCheck />
              </button>
              <span className="tactic-title">{t.data.title}</span>
              <button type="button" className="icon-btn icon-btn-s" aria-label="Удалить шаг" onClick={() => removeItem(t.id)}>
                <IconTrash width={16} height={16} />
              </button>
            </li>
          );
        })}
      </ul>
      <form
        className="inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          putItem(`tactic-${uuid()}`, 'tactic', { goal: goal.id, title: text.trim(), weeks: 'all' });
          setText('');
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Еженедельный шаг: 3 тренировки, 2 ролика" maxLength={120} />
        <button type="submit" className="icon-btn" aria-label="Добавить шаг" disabled={!text.trim()}>
          <IconPlus />
        </button>
      </form>
    </li>
  );
}

function PlanView() {
  const items = useStore((s) => s.items);
  const { putItem, patchItem, removeItem } = useStore.getState();
  const [goalText, setGoalText] = useState('');
  const [goalArea, setGoalArea] = useState('');
  const planItem = items.plan && !items.plan.deleted ? items.plan : null;
  const areas = useMemo(() => liveItems(items, 'area'), [items]);
  const goals = useMemo(() => liveItems(items, 'goal').sort((a, b) => a.created_at - b.created_at), [items]);
  const tactics = useMemo(() => {
    const goalIds = new Set(goals.map((g) => g.id));
    return liveItems(items, 'tactic').filter((t) => goalIds.has(t.data.goal)).sort((a, b) => a.created_at - b.created_at);
  }, [items, goals]);

  if (!planItem) return <PlanStart />;
  const plan = { ...DEFAULT_PLAN, ...planItem.data };
  const week = weekOf(plan, todayISO());
  const shownWeek = Math.min(Math.max(week, 1), 12);
  const current = weekScore(tactics, items, shownWeek);
  const overall = cycleScore(tactics, items, week);
  const [ws, we] = weekDates(plan, shownWeek);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {week === 0 ? 'Цикл скоро начнётся' : week <= 12 ? `Неделя ${week} из 12` : week === 13 ? 'Неделя обзора' : 'Цикл завершён'}
          </h1>
          <p className="muted small">
            {dayMonth(ws)} – {dayMonth(we)}, цель {plan.target}% шагов
          </p>
        </div>
      </header>

      <section className="card plan-score">
        <div className="plan-nums">
          <div>
            <span className="stat-big" data-ok={current != null && current >= plan.target ? '' : undefined}>
              {current ?? '—'}
              {current != null && <small>%</small>}
            </span>
            <span className="muted small">эта неделя</span>
          </div>
          <div>
            <span className="stat-big">
              {overall ?? '—'}
              {overall != null && <small>%</small>}
            </span>
            <span className="muted small">за цикл</span>
          </div>
        </div>
        <ol className="plan-weeks" style={{ '--target': `${plan.target}%` }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((w) => {
            const sc = w <= week ? weekScore(tactics, items, w) : null;
            return (
              <li key={w} data-current={w === week || undefined} data-ok={sc != null && sc >= plan.target ? '' : undefined} title={`Неделя ${w}: ${sc ?? 'нет данных'}`}>
                <span className="pw-bar">
                  <span style={{ height: `${sc ?? 0}%` }} />
                </span>
                <span className="pw-num">{w}</span>
              </li>
            );
          })}
        </ol>
        {week === 13 && (
          <p>
            Неделя обзора: посмотри, какие шаги давались легко, какие нет, и реши, что берёшь в следующий цикл. Новый цикл можно начать в
            настройках цикла ниже.
          </p>
        )}
      </section>

      <ul className="goal-list">
        {goals.map((g) => (
          <Goal key={g.id} goal={g} tactics={tactics} week={shownWeek} items={items} areas={areas} />
        ))}
      </ul>

      {goals.length < 5 && (
        <form
          className="card goal-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!goalText.trim()) return;
            putItem(`goal-${uuid()}`, 'goal', { title: goalText.trim(), area: goalArea || null });
            setGoalText('');
          }}
        >
          <label className="field">
            <span>{goals.length ? 'Ещё цель' : 'Первая цель цикла'}</span>
            <input value={goalText} onChange={(e) => setGoalText(e.target.value)} placeholder="Например: 1000 подписчиков на канале" maxLength={120} />
          </label>
          {areas.length > 0 && (
            <div className="seg-control">
              <button type="button" aria-pressed={!goalArea} onClick={() => setGoalArea('')}>
                Без сферы
              </button>
              {areas.map((a) => (
                <button key={a.id} type="button" aria-pressed={goalArea === a.data.name} onClick={() => setGoalArea(a.data.name)}>
                  <Dot color={a.data.color} />
                  {a.data.name}
                </button>
              ))}
            </div>
          )}
          <button type="submit" className="secondary-btn" disabled={!goalText.trim()}>
            Добавить цель
          </button>
        </form>
      )}

      <details className="card plan-settings">
        <summary>Настройки цикла</summary>
        <div className="form">
          <label className="field">
            <span>Начало (понедельник)</span>
            <input type="date" value={plan.start} onChange={(e) => e.target.value && patchItem('plan', 'plan', { start: weekStart(e.target.value) })} />
          </label>
          <label className="field">
            <span>Цель выполнения, %</span>
            <input type="number" min={50} max={100} value={plan.target} onChange={(e) => patchItem('plan', 'plan', { target: Math.min(100, Math.max(50, Number(e.target.value) || 85)) })} />
          </label>
          <button
            type="button"
            className="text-btn danger"
            onClick={() => {
              if (!confirm('Закончить цикл? Цели и шаги удалятся.')) return;
              [...goals, ...tactics].forEach((x) => removeItem(x.id));
              removeItem('plan');
            }}
          >
            Закончить цикл и начать заново
          </button>
        </div>
      </details>
    </>
  );
}

export default function GoalsView() {
  const mode = useStore((s) => s.goalsMode);
  const setGoalsMode = useStore((s) => s.setGoalsMode);
  return (
    <div className="page goals">
      <Segmented
        label="Цели"
        value={mode}
        onChange={setGoalsMode}
        options={[
          ['areas', 'Сферы'],
          ['plan', '12 недель'],
        ]}
      />
      {mode === 'areas' ? <AreasView /> : <PlanView />}
    </div>
  );
}
