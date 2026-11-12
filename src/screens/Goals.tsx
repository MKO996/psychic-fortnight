import { useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { addEntry } from '../plan';
import { monthsToClear } from '../calc';
import { MoneyField, Modal, Progress } from '../ui';
import { shortDate } from '../dates';
import type { Pence } from '../money';

export default function Goals() {
  const { summary: s, go, update, celebrate } = useApp();
  const [saving, setSaving] = useState<{ id: string; name: string; amount: Pence | null } | null>(null);
  const goals = [...s.derived.goals].sort((a, b) => a.priority - b.priority);

  return (
    <div className="screen goals">
      <h1 tabIndex={-1}>Your goals</h1>
      <p className="lead">Savings come after bills and essentials. You move the money yourself, then mark it saved here.</p>
      <div className="row-wrap">
        <button type="button" className="btn primary grow" onClick={() => go({ name: 'split' })}>Help me split it</button>
        <button type="button" className="btn secondary grow" onClick={() => go({ name: 'setup', step: 'goals', editOnly: true })}>Add or edit goals</button>
      </div>
      {s.status === 'short' && <p className="notice">New savings are paused: you’re {money(s.shortfall)} short for bills and essentials. Money you’ve already saved stays safe.</p>}

      {goals.length === 0 && <p className="card">No savings goals yet.</p>}
      <ul className="goal-list">
        {goals.map((g) => {
          const line = s.goals.find((x) => x.id === g.id)!;
          const stillNeeded = g.target === null ? null : Math.max(0, g.target - g.saved - line.allocated);
          return (
            <li key={g.id} className="card goal" data-testid={`goal-${g.id}`}>
              <div className="row-between">
                <h2>{g.name}</h2>
                <span className="badge">Priority {g.priority}</span>
              </div>
              {g.target !== null && <Progress value={g.saved} max={g.target} label={`${g.name}: ${money(g.saved)} saved of ${money(g.target)}`} />}
              <dl className="figures">
                <div><dt>Saved</dt><dd className="amount" data-testid="saved">{money(g.saved)}</dd></div>
                <div><dt>Set aside from this pay</dt><dd className="amount" data-testid="set-aside">{money(line.allocated)}</dd></div>
                <div><dt>Still needed</dt><dd className="amount">{stillNeeded === null ? 'No target' : money(stillNeeded)}</dd></div>
                {g.target !== null && <div><dt>Target</dt><dd className="amount">{money(g.target)}</dd></div>}
                {g.deadline && <div><dt>By</dt><dd>{shortDate(g.deadline)}</dd></div>}
              </dl>
              {g.savedThisPeriod > 0 && <p className="ok-line">✓ {money(g.savedThisPeriod)} moved from this pay.</p>}
              {line.reduced > 0 && <p className="hint">You wanted {money(line.requested)} from this pay. {money(line.reduced)} less because {line.reason}.</p>}
              {line.allocated > 0 && (
                <button type="button" className="btn secondary" onClick={() => setSaving({ id: g.id, name: g.name, amount: line.allocated })}>
                  I’ve moved {money(line.allocated)}: mark saved
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="section-h">Debts</h2>
      {s.derived.debts.length === 0 && <p className="card">No debts added.</p>}
      <ul className="goal-list">
        {s.derived.debts.map((t) => <DebtCard key={t.id} id={t.id} />)}
      </ul>

      {saving && (
        <Modal title={`Mark money saved to ${saving.name}`} onClose={() => setSaving(null)}>
          <p>Only do this after you’ve moved the money yourself, for example to a savings account.</p>
          <MoneyField label="Amount moved" value={saving.amount} onChange={(a) => setSaving({ ...saving, amount: a })} autoFocus />
          <div className="stack">
            <button type="button" className="btn primary" disabled={!saving.amount} onClick={() => {
              const g = s.derived.goals.find((x) => x.id === saving.id)!;
              update((p) => addEntry(p, { kind: 'goalSaved', goalId: saving.id, amount: saving.amount! }));
              celebrate(`Saved. ${saving.name} is now ${money(g.saved + saving.amount!)}.`);
              setSaving(null);
            }}>Mark saved</button>
            <button type="button" className="btn secondary" onClick={() => setSaving(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DebtCard({ id }: { id: string }) {
  const { summary: s } = useApp();
  const t = s.derived.debts.find((x) => x.id === id)!;
  const extra = s.extras.find((x) => x.id === id);
  const min = s.required.find((r) => r.kind === 'debtMin' && r.id === id);
  const [a, setA] = useState<Pence | null>(t.minimum);
  const [b, setB] = useState<Pence | null>((t.minimum ?? 0) + t.extraRequested || null);
  const canEstimate = t.interest === 'none' && t.fees === 'none' && t.balance !== null;
  return (
    <li className="card goal">
      <h3>{t.name}{t.kind === 'mortgage' && ' (mortgage)'}</h3>
      <dl className="figures">
        <div><dt>Balance</dt><dd className="amount">{t.balance !== null ? money(t.balance) : '—'}</dd></div>
        <div><dt>Payment due</dt><dd className="amount">{t.minimum !== null ? money(t.minimum) : '—'}</dd></div>
        <div><dt>Due date</dt><dd>{t.dueDate ? shortDate(t.dueDate) : '—'}</dd></div>
        <div><dt>{t.kind === 'mortgage' ? 'Overpayment' : 'Extra'} you can afford</dt><dd className="amount">{money(extra?.allocated ?? 0)}</dd></div>
      </dl>
      <p className="hint">From this pay: {money(min?.reserved ?? 0)} payment{extra ? ` + ${money(extra.allocated)} extra` : ''}. {t.interest === 'none' ? '0% interest' : t.interest === 'charged' ? 'Interest charged' : 'Interest not known'}, {t.fees === 'none' ? 'no fees' : t.fees === 'charged' ? 'fees charged' : 'fees not known'}.</p>
      {canEstimate ? (
        <div className="compare-box">
          <h4>Compare monthly payments</h4>
          <div className="two-col">
            <div>
              <MoneyField label="Pay each month" value={a} onChange={setA} />
              <p className="big-line" data-testid="months-a">{a ? `${monthsToClear(t.balance!, a, t.interest, t.fees)} monthly payments` : '—'}</p>
            </div>
            <div>
              <MoneyField label="Or pay each month" value={b} onChange={setB} />
              <p className="big-line" data-testid="months-b">{b ? `${monthsToClear(t.balance!, b, t.interest, t.fees)} monthly payments` : '—'}</p>
            </div>
          </div>
          <p className="hint">Estimate only: assumes you pay the same amount every month, at 0% with no fees.</p>
        </div>
      ) : (
        <p className="hint">Because interest or fees apply or aren’t known, LEFT doesn’t guess a payoff date.</p>
      )}
    </li>
  );
}
