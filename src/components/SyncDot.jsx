import { useStore } from '../store.js';

export const SYNC_TEXT = {
  idle: 'Синхронизация ещё не запускалась.',
  syncing: 'Синхронизирую.',
  ok: 'Всё синхронизировано.',
  offline: 'Нет сети, правки сохранены на устройстве.',
  error: 'Сервер не ответил, повторю позже.',
  auth: 'Ключ не принят. Войди заново.',
};

export default function SyncDot() {
  const status = useStore((s) => (s.localOnly ? 'local' : s.sync.status));
  const pending = useStore((s) => Object.keys(s.dirty).length + Object.keys(s.itemsDirty).length);
  const label = status === 'local' ? 'Только на этом устройстве' : SYNC_TEXT[status];
  return (
    <span className="sync" data-status={status} title={label}>
      <span className="sync-dot" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      {pending > 0 && status !== 'local' && <span className="sync-pending">{pending}</span>}
    </span>
  );
}
