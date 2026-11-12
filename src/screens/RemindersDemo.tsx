import { useState } from 'react';
import { useApp } from '../app-context';
import { reminderCopy, STAGES, type Stage, type Tone } from '../reminders';
import Coin from '../components/Coin';
import ReminderCard from '../components/ReminderCard';
import { Choice } from '../ui';

/** Try the demo → Reminders. Simulates the day 1, 3 and 7 reminders offline. Nothing is sent. */
export default function RemindersDemo() {
  const { go, simulateReminder, kind } = useApp();
  const [tone, setTone] = useState<Tone>('cheeky');
  const [stage, setStage] = useState<Stage | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const c = stage ? reminderCopy(stage, tone) : null;
  const open = () => {
    if (!stage) return;
    simulateReminder(stage, tone);
    go({ name: 'today' });
  };
  return (
    <div className="screen reminders-demo">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <h1 tabIndex={-1}>Reminders demo</h1>
      </div>
      <p className="lead">See what LEFT shows if you skip your money check-in. This is a simulation: nothing is sent and no figures leave the app.</p>
      {kind !== 'sample' && <p className="notice">The demo opens on the sample plan’s Today screen.</p>}

      <Choice legend="Reminder style" value={tone} onChange={(t) => setTone(t)} options={[{ value: 'gentle', label: 'Gentle' }, { value: 'cheeky', label: 'Cheeky', hint: 'A little playful guilt' }]} />

      <fieldset className="choices">
        <legend>Simulate a day after your last check-in</legend>
        <div className="segmented" role="group" aria-label="Simulate a day">
          {STAGES.map((d) => (
            <button key={d} type="button" aria-pressed={stage === d} onClick={() => { setStage(d); setNote(null); }}>Day {d}</button>
          ))}
        </div>
      </fieldset>

      {c && stage && (
        <>
          <h2 className="section-h">In the app</h2>
          <div data-testid="demo-inapp" aria-label={`In-app reminder, day ${stage}`} role="group">
            <ReminderCard stage={stage} tone={tone} demo onCheck={open} onSnooze={() => setNote('Snooze: in your own plan, this reminder comes back tomorrow at your reminder time.')} onTurnOff={() => setNote('Turn off: in your own plan, reminders stop until you turn them on again in Settings.')} />
          </div>
          {note && <p className="ok-line" role="status">{note}</p>}

          <h2 className="section-h">By email <span className="badge">Mock, not sent</span></h2>
          <section className="card email" aria-label={`Mock email, day ${stage}`} data-testid="demo-email">
            <dl className="email-head">
              <div><dt>From</dt><dd>LEFT</dd></div>
              <div><dt>Subject</dt><dd data-testid="email-subject">{c.subject}</dd></div>
            </dl>
            <div className="email-body">
              <Coin mood={c.mood} label={c.moodLabel} size={72} />
              <p>{c.emailBody}</p>
              <button type="button" className="btn primary" onClick={open}>Check my money</button>
              <p className="hint">For your privacy, LEFT emails never include your figures. Turn off reminders any time in Settings.</p>
            </div>
          </section>
          <p className="small-print">Real email reminders are not built yet. They would be a separate opt-in later, and this demo works fully offline.</p>
        </>
      )}
    </div>
  );
}
