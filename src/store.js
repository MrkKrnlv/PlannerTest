import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, slotFromTime } from './lib/date.js';
import { nextOccurrence } from './lib/repeat.js';

export const uuid = () =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// updated_at строго растёт для конкретной записи, даже если часы устройства "прыгнули назад"
const bump = (prev) => Math.max(Date.now(), (prev?.updated_at ?? 0) + 1);

export const DEFAULT_SETTINGS = {
  dayStart: '09:00',
  dayEnd: '20:00',
  peakStart: '09:30',
  peakEnd: '12:30',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  breakMin: 10,
  timeShare: 0.65, // какую долю рабочего дня реально можно занять задачами
  headCapMin: 210, // сколько глубокой работы голова тянет за день
};

export const useStore = create(
  persist(
    (set, get) => ({
      // --- задачи (таблица tasks)
      tasks: {},
      dirty: {},
      rev: 0,
      // --- документы (таблица items): привычки, отметки, дни, сферы, цели, настройки
      items: {},
      itemsDirty: {},
      itemsRev: 0,
      // --- только на этом устройстве
      timers: [],
      lastAutoplan: null, // { date, before: {id: {time, slot}} } для отмены
      onboarded: false,
      theme: 'auto', // auto | light | dark

      // аккаунт
      token: null,
      user: null,
      localOnly: false,

      // интерфейс (не сохраняется)
      view: 'today', // today | plans | growth | more
      plansMode: 'week', // inbox | week | month
      growthMode: 'habits', // habits | areas | plan
      moreView: null,
      sheet: null, // add | plan | review | search
      addKind: 'task',
      date: todayISO(),
      editingId: null,
      toast: null,
      sync: { status: 'idle', at: null, error: null },

      // --- навигация
      setView: (view) => set({ view, moreView: null }),
      setPlansMode: (plansMode) => set({ view: 'plans', plansMode, moreView: null }),
      setGrowthMode: (growthMode) => set({ view: 'growth', growthMode, moreView: null }),
      openSheet: (sheet, addKind) => set({ sheet, ...(addKind ? { addKind } : {}) }),
      closeSheet: () => set({ sheet: null }),
      finishOnboarding: () => set({ onboarded: true }),
      setTheme: (theme) => set({ theme }),
      setMoreView: (moreView) => set({ view: 'more', moreView }),
      setDate: (date) => set({ date }),
      openTask: (id) => set({ editingId: id }),
      closeTask: () => set({ editingId: null }),
      showToast: (text, action) => {
        const id = Date.now();
        set({ toast: { id, text, action } });
        setTimeout(() => get().toast?.id === id && set({ toast: null }), 5000);
      },

      // --- задачи
      addTask: (input) => {
        const now = Date.now();
        const time = input.time || null;
        const duration = input.duration_min || 30;
        const id = uuid();
        const task = {
          id,
          title: input.title.trim(),
          date: 'date' in input ? input.date ?? null : get().date,
          time,
          slot: input.slot || slotFromTime(time),
          duration_min: duration,
          area: input.area || null,
          priority: input.priority || 2,
          note: input.note || null,
          deep: input.deep ?? duration >= 60,
          frog: !!input.frog,
          repeat: input.repeat ? { ...input.repeat, series: input.repeat.series || id } : null,
          checklist: input.checklist?.length ? input.checklist : null,
          done: false,
          deleted: false,
          source: 'app',
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ tasks: { ...s.tasks, [task.id]: task }, dirty: { ...s.dirty, [task.id]: true } }));
        if (task.frog) get().clearOtherFrogs(task.id, task.date);
        return task;
      },

      updateTask: (id, patch) =>
        set((s) => {
          const prev = s.tasks[id];
          if (!prev) return {};
          const next = { ...prev, ...patch, updated_at: bump(prev) };
          if ('time' in patch && !('slot' in patch)) next.slot = slotFromTime(next.time);
          return { tasks: { ...s.tasks, [id]: next }, dirty: { ...s.dirty, [id]: true } };
        }),

      // главная задача дня может быть только одна
      clearOtherFrogs: (keepId, date) => {
        for (const t of Object.values(get().tasks)) {
          if (t.id !== keepId && t.frog && t.date === date && !t.deleted) get().updateTask(t.id, { frog: false });
        }
      },

      toggleDone: (id) => {
        const t = get().tasks[id];
        if (!t) return;
        get().updateTask(id, { done: !t.done });
        // повторяющаяся задача: при выполнении создаём следующую, если её ещё нет
        if (!t.done && t.repeat && t.date) {
          const date = nextOccurrence(t.date, t.repeat);
          const series = t.repeat.series || t.id;
          const exists = Object.values(get().tasks).some((x) => !x.deleted && x.repeat?.series === series && x.date === date);
          if (date && !exists) {
            const { id: _id, created_at: _c, updated_at: _u, done: _d, ...rest } = t;
            get().addTask({
              ...rest,
              date,
              repeat: { ...t.repeat, series },
              checklist: t.checklist?.map((c) => ({ ...c, done: false })) || null,
            });
          }
        }
      },
      toggleChecklist: (id, itemId) => {
        const t = get().tasks[id];
        if (!t?.checklist) return;
        get().updateTask(id, { checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) });
      },
      deleteTask: (id) => get().updateTask(id, { deleted: true }),
      moveTasks: (ids, date) => ids.forEach((id) => get().updateTask(id, { date, time: null })),

      applyAutoplan: (date, placements) => {
        const before = {};
        for (const [id, time] of Object.entries(placements)) {
          const t = get().tasks[id];
          before[id] = { time: t.time, slot: t.slot };
          get().updateTask(id, { time });
        }
        set({ lastAutoplan: { date, before } });
      },
      undoAutoplan: () => {
        const last = get().lastAutoplan;
        if (!last) return;
        for (const [id, prev] of Object.entries(last.before)) get().updateTask(id, prev);
        set({ lastAutoplan: null });
      },

      // --- документы
      putItem: (id, kind, data) =>
        set((s) => {
          const prev = s.items[id];
          const now = Date.now();
          const item = { id, kind, data, deleted: false, created_at: prev?.created_at ?? now, updated_at: bump(prev) };
          return { items: { ...s.items, [id]: item }, itemsDirty: { ...s.itemsDirty, [id]: true } };
        }),
      patchItem: (id, kind, patch) => {
        const prev = get().items[id];
        get().putItem(id, kind, { ...(prev && !prev.deleted ? prev.data : {}), ...patch });
      },
      removeItem: (id) =>
        set((s) => {
          const prev = s.items[id];
          if (!prev) return {};
          return {
            items: { ...s.items, [id]: { ...prev, deleted: true, updated_at: bump(prev) } },
            itemsDirty: { ...s.itemsDirty, [id]: true },
          };
        }),
      toggleLog: (id, kind) => {
        const prev = get().items[id];
        if (prev && !prev.deleted) get().removeItem(id);
        else get().putItem(id, kind, { done: true });
      },

      // --- таймеры (локально)
      startTimer: ({ label, minutes, kind = 'side', taskId = null }) =>
        set((s) => ({
          timers: [
            ...s.timers.filter((t) => !(kind === 'focus' && t.kind === 'focus')),
            { id: uuid(), kind, label, minutes, taskId, endsAt: Date.now() + minutes * 60_000, pausedLeft: null, notified: false },
          ],
        })),
      pauseTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) => (t.id === id && t.endsAt ? { ...t, pausedLeft: Math.max(0, t.endsAt - Date.now()), endsAt: null } : t)),
        })),
      resumeTimer: (id) =>
        set((s) => ({
          timers: s.timers.map((t) => (t.id === id && t.pausedLeft != null ? { ...t, endsAt: Date.now() + t.pausedLeft, pausedLeft: null } : t)),
        })),
      markTimerNotified: (id) => set((s) => ({ timers: s.timers.map((t) => (t.id === id ? { ...t, notified: true } : t)) })),
      removeTimer: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) })),

      // --- синхронизация (lib/sync.js)
      markPushed: (snapshot) =>
        set((s) => {
          const dirty = { ...s.dirty };
          const tasks = { ...s.tasks };
          for (const t of snapshot) {
            if (s.tasks[t.id]?.updated_at !== t.updated_at) continue;
            delete dirty[t.id];
            if (t.deleted) delete tasks[t.id];
          }
          return { dirty, tasks };
        }),
      markItemsPushed: (snapshot) =>
        set((s) => {
          const itemsDirty = { ...s.itemsDirty };
          const items = { ...s.items };
          for (const it of snapshot) {
            if (s.items[it.id]?.updated_at !== it.updated_at) continue;
            delete itemsDirty[it.id];
            if (it.deleted) delete items[it.id];
          }
          return { itemsDirty, items };
        }),
      applyRemote: (incoming, rev) =>
        set((s) => {
          const tasks = { ...s.tasks };
          const dirty = { ...s.dirty };
          for (const r of incoming) {
            const local = tasks[r.id];
            if (local && dirty[r.id] && local.updated_at > r.updated_at) continue;
            delete dirty[r.id];
            if (r.deleted) delete tasks[r.id];
            else {
              const { rev: _rev, ...task } = r;
              tasks[r.id] = task;
            }
          }
          return { tasks, dirty, rev: Math.max(s.rev, rev) };
        }),
      applyRemoteItems: (incoming, rev) =>
        set((s) => {
          const items = { ...s.items };
          const itemsDirty = { ...s.itemsDirty };
          for (const r of incoming) {
            const local = items[r.id];
            if (local && itemsDirty[r.id] && local.updated_at > r.updated_at) continue;
            delete itemsDirty[r.id];
            if (r.deleted) delete items[r.id];
            else {
              const { rev: _rev, ...item } = r;
              items[r.id] = item;
            }
          }
          return { items, itemsDirty, itemsRev: Math.max(s.itemsRev, rev) };
        }),
      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),

      // --- аккаунт
      setAuth: ({ token, user }) => set({ token, user, localOnly: false }),
      enableLocalOnly: () => set({ localOnly: true }),
      logout: () =>
        set({
          token: null, user: null, localOnly: false,
          tasks: {}, dirty: {}, rev: 0, items: {}, itemsDirty: {}, itemsRev: 0,
          sync: { status: 'idle', at: null, error: null },
        }),
    }),
    {
      name: 'planner-v1',
      version: 3,
      // кто уже пользовался приложением — онбординг не показываем
      migrate: (state, v) => ({ items: {}, itemsDirty: {}, itemsRev: 0, timers: [], ...state, onboarded: v < 3 ? !!state.token || !!state.localOnly : !!state.onboarded }),
      partialize: (s) => ({
        tasks: s.tasks, dirty: s.dirty, rev: s.rev,
        items: s.items, itemsDirty: s.itemsDirty, itemsRev: s.itemsRev,
        timers: s.timers, lastAutoplan: s.lastAutoplan, onboarded: s.onboarded, theme: s.theme,
        token: s.token, user: s.user, localOnly: s.localOnly,
      }),
    }
  )
);

// --- селекторы
export const liveTasks = (tasks) => Object.values(tasks).filter((t) => !t.deleted);
export const liveItems = (items, kind) =>
  Object.values(items).filter((i) => !i.deleted && i.kind === kind);
export const hasLog = (items, id) => !!items[id] && !items[id].deleted;
export const settingsOf = (items) => ({ ...DEFAULT_SETTINGS, ...(items.settings && !items.settings.deleted ? items.settings.data : {}) });

const SLOT_ORDER = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
export const byOrder = (a, b) =>
  Number(a.done) - Number(b.done) ||
  (a.time || '99').localeCompare(b.time || '99') ||
  Number(b.frog) - Number(a.frog) ||
  a.priority - b.priority ||
  SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] ||
  a.created_at - b.created_at;
