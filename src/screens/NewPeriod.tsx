import { useState } from 'react';
import { useApp } from '../app-context';
import { addDays, daysBetween, shortDate } from '../dates';
import { nextDateFor, startNewPeriod } from '../plan';
import { DateField, MoneyField } from '../ui';
import type { Pence } from '../money';

export default function NewPeriod() {
  const { plan, update, go, today, summary, fillPots } = useApp();
  const [cash, setCash] = useState<Pence | null>(null);
  const suggested = summary.endKind === 'payday' && summary.end ? nextDateFor(plan.frequency, summary.end) : null;
  const [payday, setPayday] = useState<string | null>(suggested && daysBetween(today, suggested) > 0 ? suggested : null);
  const [review, setReview] = useState<string | null>(addDays(today, 7));
  const unknown = plan.frequency === 'irregular' || !suggested;
  const end = unknown ? review : payday;
  const ok = cash !== null && !!end && daysBetween(today, end) > 0;
  return (
    <div className="screen">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <h1 tabIndex={-1}>Start your new pay period</h1>
      </div>
      <p className="lead">Check your bank, then tell LEFT what you have now. Bills you’ve paid move to next month. Your savings stay as they are.</p>
      <MoneyField big label="How much money do you have now?" hint="Including any pay that has arrived." value={cash} onChange={setCash} autoFocus />
      {unknown ? (
        <DateField label="When should we review your plan?" value={review} min={addDays(today, 1)} onChange={setReview} />
      ) : (
        <DateField label="Next payday" hint={suggested ? `Suggested: ${shortDate(suggested)}` : undefined} value={payday} min={addDays(today, 1)} onChange={setPayday} />
      )}
      <div className="row-wrap">
        <button type="button" className="btn secondary" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <button type="button" className="btn primary grow" disabled={!ok} onClick={() => {
          update((p) => startNewPeriod(p, today, cash!, unknown ? null : payday, unknown ? review : null), 'New pay period started.');
          fillPots();
          go({ name: 'today' });
        }}>Start new period</button>
      </div>
    </div>
  );
}
