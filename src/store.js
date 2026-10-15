import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { todayISO, slotFromTime } from './lib/date.js';

const uuid = () =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// updated_at строго растёт для конкретной задачи, даже если часы устройства "прыгнули назад"
const bump = (prev) => Math.max(Date.now(), (prev?.updated_at ?? 0) + 1);

export const useStore = create(
  persist(
    (set, get) => ({
      // данные
      tasks: {}, // id -> task (включая локальные надгробия deleted=true до отправки)
      dirty: {}, // id -> true: есть неотправленные правки
      rev: 0, // последняя серверная ревизия, которую мы видели

      // аккаунт
      token: null,
      user: null,
      localOnly: false,
      capacityMin: 480, // сколько минут задач в день считаем нормой

      // интерфейс (не сохраняется)
      view: 'day',
      date: todayISO(),
      editingId: null,
      sync: { status: 'idle', at: null, error: null },

      // --- навигация
      setView: (view) => set({ view }),
      setDate: (date) => set({ date }),
      openTask: (id) => set({ editingId: id }),
      closeTask: () => set({ editingId: null }),

      // --- задачи
      addTask: (input) => {
        const now = Date.now();
        const time = input.time || null;
        const task = {
          id: uuid(),
          title: input.title.trim(),
          date: input.date ?? get().date,
          time,
          slot: input.slot || slotFromTime(time),
          duration_min: input.duration_min || 30,
          area: input.area || null,
          priority: input.priority || 2,
          note: input.note || null,
          done: false,
          deleted: false,
          source: 'app',
          created_at: now,
          updated_at: now,
        };
        set((s) => ({ tasks: { ...s.tasks, [task.id]: task }, dirty: { ...s.dirty, [task.id]: true } }));
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

      toggleDone: (id) => get().updateTask(id, { done: !get().tasks[id]?.done }),
      deleteTask: (id) => get().updateTask(id, { deleted: true }),

      moveTasks: (ids, date) => ids.forEach((id) => get().updateTask(id, { date })),

      // --- синхронизация (вызывается из lib/sync.js)
      markPushed: (snapshot) =>
        set((s) => {
          const dirty = { ...s.dirty };
          const tasks = { ...s.tasks };
          for (const t of snapshot) {
            // если пока шёл запрос задачу снова правили — оставляем грязной
            if (s.tasks[t.id]?.updated_at !== t.updated_at) continue;
            delete dirty[t.id];
            if (t.deleted) delete tasks[t.id];
          }
          return { dirty, tasks };
        }),

      applyRemote: (incoming, rev) =>
        set((s) => {
          const tasks = { ...s.tasks };
          const dirty = { ...s.dirty };
          for (const r of incoming) {
            const local = tasks[r.id];
            if (local && dirty[r.id] && local.updated_at > r.updated_at) continue; // наша правка новее
            delete dirty[r.id];
            if (r.deleted) delete tasks[r.id];
            else {
              const { rev: _rev, ...task } = r;
              tasks[r.id] = task;
            }
          }
          return { tasks, dirty, rev: Math.max(s.rev, rev) };
        }),

      setSync: (patch) => set((s) => ({ sync: { ...s.sync, ...patch } })),

      // --- аккаунт
      setAuth: ({ token, user }) => set({ token, user, localOnly: false }),
      enableLocalOnly: () => set({ localOnly: true }),
      setCapacity: (capacityMin) => set({ capacityMin }),
      logout: () =>
        set({ token: null, user: null, localOnly: false, tasks: {}, dirty: {}, rev: 0, sync: { status: 'idle', at: null, error: null } }),
    }),
    {
      name: 'planner-v1',
      version: 1,
      partialize: (s) => ({
        tasks: s.tasks,
        dirty: s.dirty,
        rev: s.rev,
        token: s.token,
        user: s.user,
        localOnly: s.localOnly,
        capacityMin: s.capacityMin,
      }),
    }
  )
);

// --- селекторы
export const liveTasks = (tasks) => Object.values(tasks).filter((t) => !t.deleted);

const SLOT_ORDER = { morning: 0, afternoon: 1, evening: 2, anytime: 3 };
export const byOrder = (a, b) =>
  Number(a.done) - Number(b.done) ||
  (a.time || '99').localeCompare(b.time || '99') ||
  a.priority - b.priority ||
  SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] ||
  a.created_at - b.created_at;
