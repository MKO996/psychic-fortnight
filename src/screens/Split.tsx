import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { money, type Pence } from '../money';
import { proposeSplit } from '../plan';
import { MoneyField } from '../ui';

export default function Split() {
  const { summary: s, go, update } = useApp();
  const goals = [...s.derived.goals].sort((a, b) => a.priority - b.priority);
  // Money to split = what's left after required costs, ignoring current goal plans (we're re-deciding them).
  const pool = Math.max(0, s.available);
  const [keep, setKeep] = useState<Pence | null>(null);
  const toSplit = Math.max(0, pool - (keep ?? 0));
  const proposal = useMemo(() => proposeSplit(toSplit, goals.map((g) => ({ id: g.id, stillNeeded: g.target === null ? Number.MAX_SAFE_INTEGER : Math.max(0, g.target - g.saved) }))), [toSplit, goals.map((g) => g.id + g.saved).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const [edits, setEdits] = useState<Record<string, Pence | null>>({});
  const value = (id: string) => (id in edits ? edits[id] : proposal[id]) ?? 0;
  const total = goals.reduce((a, g) => a + value(g.id), 0);
  const over = total > toSplit;

  return (
    <div className="screen split">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'goals' })}>‹ Back</button>
        <h1 tabIndex={-1}>Help me split it</h1>
      </div>
      {s.status === 'short' ? (
        <p className="notice">You’re {money(s.shortfall)} short for bills and essentials, so there’s nothing to split right now.</p>
      ) : s.status !== 'ok' ? (
        <p className="notice">Finish your plan first so LEFT knows what’s available.</p>
      ) : goals.length === 0 ? (
        <p className="notice">Add a savings goal first.</p>
      ) : (
        <>
          <section className="card">
            <p>After bills, debt payments and essentials, you have</p>
            <p className="big-figure amount">{money(pool)}</p>
            <p className="hint">This pay, until {s.endKind === 'review' ? 'your review date' : 'payday'}.</p>
          </section>
          <MoneyField big label="How much do you want to keep for everyday spending?" hint={`${s.days} days to go. For example ${money(1000 * s.days)} is £10 a day.`} value={keep} onChange={(k) => { setKeep(k); setEdits({}); }} />
          {keep !== null && (
            <section className="card">
              <h2>Suggested split of {money(toSplit)}</h2>
              <p className="hint">Shared evenly, never more than a pot still needs. Change any amount.</p>
              {goals.map((g) => (
                <MoneyField key={g.id} label={`${g.name}${g.target !== null ? ` (still needs ${money(Math.max(0, g.target - g.saved))})` : ''}`} value={value(g.id)} onChange={(a) => setEdits((e) => ({ ...e, [g.id]: a }))} />
              ))}
              <p className={over ? 'error' : 'hint'} role={over ? 'alert' : undefined}>
                {over ? `That’s ${money(total - toSplit)} more than you have to split.` : `Total ${money(total)}. Extra debt payments come after your pots.`}
              </p>
              <button type="button" className="btn primary" disabled={over} onClick={() => {
                update((p) => ({ ...p, goals: p.goals.map((g) => ({ ...g, contribution: g.savedThisPeriod + value(g.id) })) }), 'Savings split updated.');
                go({ name: 'goals' });
              }}>Use this split</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
