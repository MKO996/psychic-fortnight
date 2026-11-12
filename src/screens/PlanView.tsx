import { useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { longDate, relativeDay, shortDate, daysBetween } from '../dates';
import { addEntry, markBillPaid, removeEntry, updateEntry } from '../plan';
import { MoneyField, Modal } from '../ui';
import { softGaps } from '../calc';
import type { Entry } from '../types';

export default function PlanView() {
  const { summary: s, plan, go, update, today } = useApp();
  const endWord = s.endKind === 'review' ? 'your review date' : 'payday';
  const bills = s.required.filter((r) => r.kind === 'bill');
  const essentials = s.required.filter((r) => r.kind === 'essential');
  const debtMins = s.required.filter((r) => r.kind === 'debtMin');
  const gaps = softGaps(s.derived);
  const [justPaid, setJustPaid] = useState<string | null>(null);
  const [receive, setReceive] = useState(false);

  return (
    <div className="screen plan">
      <h1 tabIndex={-1}>Your plan</h1>
      {s.end && (
        <p className="lead">
          This pay period runs until {endWord}, <strong>{longDate(s.end)}</strong> ({relativeDay(s.end, today)}).
        </p>
      )}

      {s.status === 'incomplete' && (
        <section className="card attention">
          <h2>Finish your plan to see what’s safe to spend</h2>
          <ul className="missing">{s.missing.map((m) => <li key={m}>{m}</li>)}</ul>
          <button type="button" className="btn primary" onClick={() => go({ name: 'setup' })}>Finish my plan</button>
        </section>
      )}

      <section className="card" aria-labelledby="how-h">
        <h2 id="how-h">How we worked it out</h2>
        <table className="sum">
          <tbody>
            <tr><th scope="row">Money you can use now</th><td className="amount" data-testid="cash">{money(s.cash)}</td></tr>
            <tr><th scope="row">Bills, debt payments and essentials due before {endWord}</th><td className="amount" data-testid="required">−{money(s.requiredTotal)}</td></tr>
            {s.status === 'short' ? (
              <tr className="total warn"><th scope="row">Short for bills and essentials</th><td className="amount" data-testid="shortfall">{money(s.shortfall)}</td></tr>
            ) : (
              <>
                <tr><th scope="row">Set aside for savings goals</th><td className="amount" data-testid="goals-total">−{money(s.goalTotal)}</td></tr>
                <tr><th scope="row">Extra debt payments</th><td className="amount" data-testid="extra-total">−{money(s.extraTotal)}</td></tr>
                <tr className="total"><th scope="row">Left until {endWord}</th><td className="amount">{money(s.left)}</td></tr>
              </>
            )}
            {s.status === 'ok' && s.days > 0 && (
              <tr className="total"><th scope="row">÷ {s.days} {s.days === 1 ? 'day' : 'days'} = safe to spend each day <small>(rounded down to the penny)</small></th><td className="amount">{money(s.daily, { pennies: true })}</td></tr>
            )}
          </tbody>
        </table>
        {s.status === 'short' && (
          <p className="notice">New savings and extra debt payments are paused until bills and essentials are covered.{s.nearestDue && ` Your ${s.nearestDue.name.toLowerCase()} is due first${s.nearestDue.dueDate ? `, on ${shortDate(s.nearestDue.dueDate)}` : ''}.`}</p>
        )}
        <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'cash', editOnly: true })}>Change money I have now</button>
      </section>

      <section className="card" aria-labelledby="bills-h">
        <h2 id="bills-h">Bills before {endWord}</h2>
        {bills.length === 0 && <p>No bills due before {endWord}.</p>}
        <ul className="items">
          {bills.map((b) => {
            const paid = b.reserved === 0 && b.full > 0;
            return (
              <li key={b.id} className={`item ${paid ? 'is-paid' : ''} ${b.overdue ? 'is-overdue' : ''}`}>
                <div className="item-main">
                  <span className="item-name">{b.name}</span>
                  <span className="amount item-amount">{money(b.full)}</span>
                </div>
                <div className="item-meta">
                  {b.dueDate ? <span>{b.overdue ? 'Overdue: was due ' : 'Due '}{shortDate(b.dueDate)}{!b.overdue && ` (${relativeDay(b.dueDate, today)})`}</span> : <span className="gap">Due date missing</span>}
                  {b.note && b.dueDate && <span>{b.note}</span>}
                  {paid ? (
                    <span className={`paid-badge ${justPaid === b.id ? 'pop' : ''}`}><svg viewBox="0 0 24 24" aria-hidden="true" className="tick"><path d="M4 12.5l5 5L20 6.5" /></svg> Paid</span>
                  ) : b.done > 0 ? <span>{money(b.done)} paid, {money(b.reserved)} to go</span> : <span>Not paid yet</span>}
                </div>
                {!paid && (
                  <button type="button" className="btn secondary" aria-label={`Mark ${b.name} paid, ${money(b.reserved)}`} onClick={() => { setJustPaid(b.id); update((p) => markBillPaid(p, b.id), `${b.name} marked paid. ${money(b.reserved)} taken from your cash and your bills.`); }}>
                    Mark paid
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {s.laterBills.length > 0 && (
          <>
            <h3>Due after {endWord}</h3>
            <ul className="items">
              {s.laterBills.map((b) => (
                <li key={b.id} className="item">
                  <div className="item-main"><span className="item-name">{b.name}</span><span className="amount item-amount">{money(b.amount ?? 0)}</span></div>
                  <div className="item-meta">
                    <span>Due {b.dueDate ? shortDate(b.dueDate) : '—'}</span>
                    <span>{b.heldSoFar > 0 && `${money(b.heldSoFar)} already put aside. `}{b.reserveNow ? `Putting aside ${money(b.reserveNow)} from this pay.` : 'Nothing put aside from this pay.'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'bills', editOnly: true })}>Edit bills</button>
      </section>

      <section className="card" aria-labelledby="ess-h">
        <h2 id="ess-h">Groceries and other essentials</h2>
        <ul className="items">
          {essentials.map((e) => (
            <li key={e.id} className="item">
              <div className="item-main"><span className="item-name">{e.name}</span><span className="amount item-amount">{money(e.reserved)} left</span></div>
              <div className="item-meta"><span>{money(e.done)} spent of {money(e.full)}</span>{e.done > e.full && <span className="warn">{money(e.done - e.full)} over: taken from spending money</span>}</div>
            </li>
          ))}
        </ul>
        <div className="row-wrap">
          <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'groceries', editOnly: true })}>Edit groceries</button>
          <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'transport', editOnly: true })}>Edit transport</button>
        </div>
      </section>

      <section className="card" aria-labelledby="debt-h">
        <h2 id="debt-h">Debt payments</h2>
        {s.derived.debts.length === 0 && <p>No debts added.</p>}
        <ul className="items">
          {s.derived.debts.map((t) => {
            const min = debtMins.find((r) => r.id === t.id);
            const extra = s.extras.find((x) => x.id === t.id);
            const minPaid = !!t.minimum && t.minimumPaid >= t.minimum;
            return (
              <li key={t.id} className="item">
                <div className="item-main"><span className="item-name">{t.name}</span></div>
                <dl className="figures">
                  <div><dt>Payment due</dt><dd className="amount">{t.minimum !== null ? money(t.minimum) : '—'}</dd></div>
                  <div><dt>Due</dt><dd>{t.dueDate ? shortDate(t.dueDate) : <span className="gap">Date missing</span>}</dd></div>
                  <div><dt>Status</dt><dd>{minPaid ? 'Paid' : min ? 'Not paid yet' : 'Due after payday'}</dd></div>
                  {extra && <div><dt>Extra from this pay</dt><dd className="amount">{money(extra.allocated)}</dd></div>}
                </dl>
                {extra && extra.reduced > 0 && <p className="hint">You asked for {money(extra.requested)} extra. {money(extra.reduced)} less because {extra.reason}.</p>}
                <div className="row-wrap">
                  {min && min.reserved > 0 && (
                    <button type="button" className="btn secondary" onClick={() => update((p) => addEntry(p, { kind: 'debtPaid', debtId: t.id, part: 'minimum', amount: min.reserved }), `${t.name} payment of ${money(min.reserved)} marked paid.`)}>Mark payment paid</button>
                  )}
                  {extra && extra.allocated > 0 && (
                    <button type="button" className="btn secondary" onClick={() => update((p) => addEntry(p, { kind: 'debtPaid', debtId: t.id, part: 'extra', amount: extra.allocated }), `Extra ${money(extra.allocated)} to ${t.name} recorded.`)}>Mark extra paid</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="row-wrap">
          <button type="button" className="btn secondary" onClick={() => go({ name: 'goals' })}>Balances and payoff</button>
          <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'debts', editOnly: true })}>Edit debts</button>
        </div>
      </section>

      <section className="card" aria-labelledby="inc-h">
        <h2 id="inc-h">Money coming in</h2>
        <p className="hint">Expected pay isn’t counted until you record it as received.</p>
        <ul className="items">
          {plan.incomes.map((i) => (
            <li key={i.id} className="item">
              <div className="item-main"><span className="item-name">{i.name}</span><span className="amount item-amount">{i.amount !== null ? money(i.amount) : '—'}</span></div>
              <div className="item-meta"><span>Expected {i.nextDate ? `${shortDate(i.nextDate)} (${relativeDay(i.nextDate, today)})` : 'date not set'}</span><span>{i.frequency}</span></div>
            </li>
          ))}
        </ul>
        <div className="row-wrap">
          <button type="button" className="btn secondary" onClick={() => setReceive(true)}>Record money received</button>
          <button type="button" className="btn secondary" onClick={() => go({ name: 'setup', step: 'income', editOnly: true })}>Edit pay</button>
        </div>
      </section>

      <Entries />

      {gaps.length > 0 && (
        <section className="card quiet" aria-labelledby="gaps-h">
          <h2 id="gaps-h">You can add these later</h2>
          <ul className="missing">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </section>
      )}

      {receive && <ReceiveModal onClose={() => setReceive(false)} />}
    </div>
  );
}

function ReceiveModal({ onClose }: { onClose: () => void }) {
  const { update } = useApp();
  const [amt, setAmt] = useState<number | null>(null);
  return (
    <Modal title="Record money received" onClose={onClose}>
      <MoneyField label="How much did you get?" value={amt} onChange={setAmt} autoFocus />
      <div className="stack">
        <button type="button" className="btn primary" disabled={!amt} onClick={() => { update((p) => addEntry(p, { kind: 'income', amount: amt!, note: 'Money received' }), `${money(amt!)} added to your cash.`); onClose(); }}>Add to my cash</button>
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function entryText(e: Entry, names: Record<string, string>): string {
  switch (e.kind) {
    case 'spend': return `Spent${names[e.category] ? ` on ${names[e.category].toLowerCase()}` : e.note ? ` on ${e.note}` : ''}`;
    case 'income': return `Received${e.note ? `: ${e.note}` : ''}`;
    case 'billPaid': return `Paid ${names[e.billId] ?? 'a bill'}`;
    case 'debtPaid': return `${e.part === 'extra' ? 'Extra payment to' : 'Payment to'} ${names[e.debtId] ?? 'a debt'}`;
    case 'goalSaved': return `Moved to ${names[e.goalId] ?? 'savings'}`;
  }
}

function Entries() {
  const { plan, update, today } = useApp();
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState<number | null>(null);
  const [cat, setCat] = useState('');
  const names: Record<string, string> = {};
  for (const x of [...plan.bills, ...plan.essentials, ...plan.debts, ...plan.goals]) names[x.id] = x.name;
  const list = [...plan.entries].reverse();
  return (
    <section className="card" aria-labelledby="log-h">
      <h2 id="log-h">What you’ve logged</h2>
      {list.length === 0 && <p>Nothing logged in this pay period yet.</p>}
      <ul className="items">
        {list.map((e) => (
          <li key={e.id} className="item">
            <div className="item-main">
              <span className="item-name">{entryText(e, names)}</span>
              <span className={`amount item-amount ${e.kind === 'income' ? 'pos' : ''}`}>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</span>
            </div>
            <div className="item-meta"><span>{e.at ? (daysBetween(e.at.slice(0, 10), today) === 0 ? 'Today' : shortDate(e.at.slice(0, 10))) : ''}</span></div>
            {editing === e.id ? (
              <div className="edit-entry">
                <MoneyField label="Correct amount" value={val} onChange={setVal} autoFocus />
                {e.kind === 'spend' && (
                  <div className="field">
                    <label htmlFor={`cat-${e.id}`}>Category</label>
                    <select id={`cat-${e.id}`} value={cat} onChange={(ev) => setCat(ev.target.value)}>
                      {plan.essentials.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      <option value="other">Something else</option>
                    </select>
                  </div>
                )}
                <div className="row-wrap">
                  <button type="button" className="btn primary" disabled={!val} onClick={() => { update((p) => updateEntry(p, e.id, e.kind === 'spend' ? { amount: val!, category: cat } as Partial<Entry> : { amount: val! }), 'Entry corrected. Totals updated.'); setEditing(null); }}>Save</button>
                  <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="row-wrap">
                <button type="button" className="btn secondary" aria-label={`Correct: ${entryText(e, names)} ${money(e.amount)}`} onClick={() => { setEditing(e.id); setVal(e.amount); setCat(e.kind === 'spend' ? e.category : ''); }}>Correct</button>
                <button type="button" className="btn secondary" aria-label={`Undo: ${entryText(e, names)} ${money(e.amount)}`} onClick={() => update((p) => removeEntry(p, e.id), 'Entry removed. Totals updated.')}>Undo</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
