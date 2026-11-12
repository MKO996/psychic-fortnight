import { useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { daysBetween, longDate, relativeDay, shortDate } from '../dates';
import Pots from './Pots';
import { Progress } from '../ui';
import type { View } from '../calc';
import ReminderCard from '../components/ReminderCard';
import Coin from '../components/Coin';
import { reminderCopy } from '../reminders';

export default function Today() {
  const { summary: s, go, today, kind, pendingReminder: rem, openReminder, snoozeReminder, turnOffReminder, reminders } = useApp();
  const endWord = s.endKind === 'review' ? 'your review date' : 'payday';
  const groceries = s.required.find((r) => r.kind === 'essential' && r.id === 'groceries');

  return (
    <div className="screen today">
      <h1 tabIndex={-1} className="visually-hidden">Today</h1>
      {rem && !rem.opened && <ReminderCard stage={rem.stage} tone={rem.tone} demo={rem.demo} onCheck={openReminder} onSnooze={snoozeReminder} onTurnOff={turnOffReminder} />}
      <section className="hero" aria-labelledby="safe-h">
        <h2 id="safe-h" className="hero-label">Safe to spend today</h2>
        {s.status === 'incomplete' ? (
          <>
            <p className="hero-figure muted" aria-hidden="true">£ –</p>
            <p className="hero-line">Finish your plan to see what’s safe to spend.</p>
          </>
        ) : s.status === 'payday' ? (
          <>
            <p className="hero-figure muted" aria-hidden="true">£ –</p>
            <p className="hero-line">It’s {endWord}. Update your plan to see what’s safe to spend.</p>
            <button type="button" className="btn primary" onClick={() => go({ name: 'newPeriod' })}>Update my plan</button>
          </>
        ) : (
          <>
            <p className="hero-figure amount" data-testid="safe-today">{money(s.daily, { pennies: true })}</p>
            {s.status === 'short' ? (
              <p className="hero-line warn" role="status">
                You’re {money(s.shortfall)} short for bills and essentials.
                {s.nearestDue && <> Your {s.nearestDue.name.toLowerCase()} is due first.</>}
              </p>
            ) : (
              <p className="hero-line">You have {money(s.daily, { pennies: s.daily % 100 !== 0 })} to spend today after the money you’ve set aside.</p>
            )}
          </>
        )}
        {s.end && s.status !== 'incomplete' && (
          <dl className="hero-sub">
            <div>
              <dt>Left until {endWord}</dt>
              <dd className="amount" data-testid="left-total">{money(s.left)}</dd>
            </div>
            <div>
              <dt>{s.endKind === 'review' ? 'Review date' : 'Next payday'}</dt>
              <dd><span aria-label={longDate(s.end)}>{shortDate(s.end)}</span> <small>({relativeDay(s.end, today)})</small></dd>
            </div>
          </dl>
        )}
      </section>

      <div className="actions-main">
        <button type="button" className="btn primary xl" onClick={() => go({ name: 'talk' })}>
          <span aria-hidden="true" className="btn-icon">🎙</span> Talk or type
        </button>
        <button type="button" className="btn secondary xl" onClick={() => go({ name: 'plan' })}>View plan</button>
      </div>

      {(kind === 'sample' || reminders.enabled) && <CheckIn />}

      {s.status === 'incomplete' && (
        <section className="card attention" aria-labelledby="missing-h">
          <h2 id="missing-h">Still to add</h2>
          <ul className="missing">
            {s.missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <button type="button" className="btn primary" onClick={() => go({ name: 'setup' })}>Finish my plan</button>
        </section>
      )}

      {groceries && (
        <section className="card groceries" aria-labelledby="gro-h">
          <div className="row-between">
            <h2 id="gro-h">Groceries left</h2>
            <p className="big-figure amount" data-testid="groceries-left">{money(groceries.reserved)}</p>
          </div>
          <Progress value={groceries.reserved} max={groceries.full} label={`Groceries left: ${money(groceries.reserved)} of ${money(groceries.full)}`} />
          <p className="hint">{money(groceries.done)} spent of {money(groceries.full)} this pay.{groceries.done > groceries.full && ` You’ve gone ${money(groceries.done - groceries.full)} over, which comes out of your spending money.`}</p>
        </section>
      )}

      {s.nearestDue && s.status !== 'incomplete' && (
        <section className="card next-step" aria-labelledby="next-h">
          <h2 id="next-h">Next step</h2>
          <p>
            Check your {s.nearestDue.name.toLowerCase()}: <strong className="amount">{money(s.nearestDue.reserved)}</strong>{' '}
            {s.nearestDue.dueDate ? (daysBetween(today, s.nearestDue.dueDate) < 0 ? `was due ${shortDate(s.nearestDue.dueDate)}.` : `due ${shortDate(s.nearestDue.dueDate)} (${relativeDay(s.nearestDue.dueDate, today)}).`) : 'due date not set.'}
          </p>
          <button type="button" className="btn secondary" onClick={() => go({ name: 'plan' })}>Go to bills</button>
        </section>
      )}

      {s.status === 'ok' && s.views.length > 0 && <Views views={s.views} />}

      {s.status !== 'incomplete' && <Pots />}

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

function CheckIn() {
  const { checkedInToday, checkInNow, pendingReminder: rem } = useApp();
  const waiting = rem && rem.opened ? reminderCopy(rem.stage, rem.tone) : null;
  return (
    <section className="card checkin" aria-labelledby="checkin-h" data-testid="checkin">
      <div className="reminder-row">
        {checkedInToday ? (
          <Coin mood="celebrate" label="The coin is happy" size={72} />
        ) : waiting ? (
          <Coin mood={waiting.mood} label={`${waiting.moodLabel}, still waiting`} size={72} />
        ) : (
          <Coin mood="idle" label="The coin is waiting" size={72} />
        )}
        <div>
          <h2 id="checkin-h">{checkedInToday ? 'Checked in today' : 'Daily money check-in'}</h2>
          <p className="hint">{checkedInToday ? 'Nice. The coin can relax until tomorrow.' : waiting ? 'You’re here. Look at your numbers above, then tell the coin.' : 'Had a look at your numbers? Tell the coin.'}</p>
        </div>
      </div>
      {!checkedInToday && <button type="button" className="btn primary" onClick={checkInNow}>Checked today</button>}
    </section>
  );
}
