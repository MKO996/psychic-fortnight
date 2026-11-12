import Coin from './Coin';
import { reminderCopy, type Stage, type Tone } from '../reminders';

/** The in-app reminder. Opens Today; Snooze and Turn off are always available. */
export default function ReminderCard({ stage, tone, onCheck, onSnooze, onTurnOff, demo }: { stage: Stage; tone: Tone; onCheck: () => void; onSnooze: () => void; onTurnOff: () => void; demo?: boolean }) {
  const c = reminderCopy(stage, tone);
  return (
    <section className={`card reminder reminder-${c.mood}`} aria-labelledby={`rem-${stage}`} data-testid="reminder-card">
      <div className="reminder-row">
        <Coin mood={c.mood} label={c.moodLabel} size={96} />
        <div>
          <p className="reminder-day">{demo ? `Demo · day ${stage}` : `Day ${stage}`}</p>
          <h2 id={`rem-${stage}`}>{c.title}</h2>
          <p className="reminder-body">{c.body}</p>
          <p className="visually-hidden">{c.moodLabel}.</p>
        </div>
      </div>
      <button type="button" className="btn primary xl" onClick={onCheck}>Check my money</button>
      <div className="row-wrap">
        <button type="button" className="btn secondary grow" onClick={onSnooze}>Snooze</button>
        <button type="button" className="btn secondary grow" onClick={onTurnOff}>Turn off</button>
      </div>
    </section>
  );
}
