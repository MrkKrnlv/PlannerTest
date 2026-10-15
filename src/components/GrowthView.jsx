import { useStore } from '../store.js';
import { Segmented } from './ui.jsx';
import HabitsView from './HabitsView.jsx';
import { AreasView, PlanView } from './GoalsView.jsx';

/** Рост: всё, что про долгую дистанцию — привычки, сферы жизни, цикл 12 недель */
export default function GrowthView() {
  const mode = useStore((s) => s.growthMode);
  const setGrowthMode = useStore((s) => s.setGrowthMode);
  return (
    <div className="page growth">
      <Segmented
        label="Рост"
        value={mode}
        onChange={setGrowthMode}
        options={[
          ['habits', 'Привычки'],
          ['areas', 'Сферы'],
          ['plan', '12 недель'],
        ]}
      />
      {mode === 'habits' && <HabitsView embedded />}
      {mode === 'areas' && <AreasView />}
      {mode === 'plan' && <PlanView />}
    </div>
  );
}
