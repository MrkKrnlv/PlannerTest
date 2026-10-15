import { useState } from 'react';
import { useStore } from '../store.js';
import { IconToday, IconPlus, IconGrowth, IconMic } from './Icons.jsx';

const SLIDES = [
  {
    icon: IconToday,
    title: 'Сегодня — твой главный экран',
    text: 'Сверху то, что делать прямо сейчас. Ниже план по времени и задачи без времени. Кнопка «Спланировать» сама расставит день, вечером «Завершить день» подведёт итог.',
  },
  {
    icon: IconPlus,
    title: 'Всё добавляется через «+»',
    text: 'Задача, привычка, заметка или таймер. В тексте задачи можно писать как думаешь: «завтра в 10 созвон 1ч #работа !!» — дата, время, длительность и важность разберутся сами.',
  },
  {
    icon: IconMic,
    title: 'Можно голосом',
    text: 'Надиктуй боту в Telegram список дел. ИИ расшифрует, разложит по дням с учётом загрузки и добавит сюда. Такие задачи помечены «голосом».',
  },
  {
    icon: IconGrowth,
    title: 'Рост — про долгую дистанцию',
    text: 'Привычки с сериями, сферы жизни с недельными целями и цикл 12 недель. Раз в месяц выгрузи всё в Claude из раздела «Ещё» и получи разбор.',
  },
];

export default function Onboarding() {
  const finish = useStore((s) => s.finishOnboarding);
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const Icon = s.icon;
  const last = i === SLIDES.length - 1;
  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Знакомство с планером">
      <div className="glass onb-card">
        <div className="onb-icon">
          <Icon width={30} height={30} />
        </div>
        <h2 className="onb-title">{s.title}</h2>
        <p className="onb-text">{s.text}</p>
        <div className="onb-dots" aria-hidden="true">
          {SLIDES.map((_, k) => (
            <span key={k} data-on={k === i || undefined} />
          ))}
        </div>
        <div className="onb-actions">
          <button type="button" className="text-btn" onClick={finish}>
            Пропустить
          </button>
          <button type="button" className="primary-btn" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? 'Начать' : 'Дальше'}
          </button>
        </div>
      </div>
    </div>
  );
}
