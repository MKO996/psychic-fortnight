import { useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { shortDate } from '../dates';
import type { View } from '../calc';
import ReminderCard from '../components/ReminderCard';
import CharacterSheet from '../components/CharacterSheet';
import Quests from '../components/Quests';
import Upcoming from '../components/Upcoming';
import QuickAdd from '../components/QuickAdd';

export default function Today() {
  const { summary: s, go, kind, pendingReminder: rem, openReminder, snoozeReminder, turnOffReminder } = useApp();
  return (
    <div className="screen today">
      <h1 tabIndex={-1} className="visually-hidden">Today</h1>
      {rem && !rem.opened && <ReminderCard stage={rem.stage} tone={rem.tone} demo={rem.demo} onCheck={openReminder} onSnooze={snoozeReminder} onTurnOff={turnOffReminder} />}

      <CharacterSheet />

      <div className="actions-main">
        <button type="button" className="btn primary xl" onClick={() => go({ name: 'talk' })}>
          <span aria-hidden="true" className="btn-icon">🎙</span> Talk or type
        </button>
        <button type="button" className="btn secondary xl" onClick={() => go({ name: 'plan' })}>View plan</button>
      </div>

      {s.status === 'incomplete' && (
        <section className="card attention" aria-labelledby="missing-h">
          <h2 id="missing-h">Still to add</h2>
          <ul className="missing">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          <button type="button" className="btn primary" onClick={() => go({ name: 'setup' })}>Finish my plan</button>
        </section>
      )}

      <Quests />

      {s.status !== 'incomplete' && (
        <button type="button" className="insights-btn" onClick={() => go({ name: 'insights' })}>
          <span className="insights-spark" aria-hidden="true">🔮</span>
          <span className="insights-text">Get your insights<small>Day, week or month: what to keep and what to change</small></span>
          <span className="insights-arrow" aria-hidden="true">→</span>
        </button>
      )}
      {s.status !== 'incomplete' && <Upcoming />}
      {s.status !== 'incomplete' && <QuickAdd />}
      {s.status === 'ok' && s.views.length > 0 && <Views views={s.views} />}

      {kind === 'sample' && <p className="small-print">Sample figures are fictional. Payments and transfers happen outside LEFT.</p>}
    </div>
  );
}

function Views({ views }: { views: View[] }) {
  const [k, setK] = useState<View['key']>('today');
  const v = views.find((x) => x.key === k)!;
  return (
    <section className="card" aria-labelledby="views-h">
      <h2 id="views-h">Spending guide</h2>
      <div className="segmented" role="group" aria-label="Choose a time span">
        {views.map((x) => (
          <button key={x.key} type="button" aria-pressed={x.key === k} onClick={() => setK(x.key)}>{x.label}</button>
        ))}
      </div>
      <p className="view-line" aria-live="polite">
        <strong className="amount big-figure">{money(v.amount, { pennies: v.key === 'today' || v.amount % 100 !== 0 })}</strong>
        <span>
          {v.key === 'today' ? 'for today' : `for ${v.coveredDays === 1 ? '1 day' : `${v.coveredDays} days`}`}
          {v.lastFunded && <>. Lasts until {shortDate(v.lastFunded)}.</>}
          {v.wholePeriod && v.key !== 'today' && <> That’s all of it until payday.</>}
        </span>
      </p>
    </section>
  );
}
