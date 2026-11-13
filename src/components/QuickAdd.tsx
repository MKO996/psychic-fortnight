import { useState } from 'react';
import { useApp } from '../app-context';
import { money, pounds, type Pence } from '../money';
import { addEntry } from '../plan';
import { MoneyField, Modal } from '../ui';

const CHIPS = [3, 5, 10, 20, 50];

/** One-tap logging: choose what, tap an amount, done. */
export default function QuickAdd() {
  const { plan, update } = useApp();
  const [open, setOpen] = useState<{ label: string; category: string; note: string } | null>(null);
  const [amount, setAmount] = useState<Pence | null>(null);
  const extras = plan.profile?.spendsOn ?? [];
  const choices = [
    ...plan.essentials.map((e) => ({ label: e.name, category: e.id, note: '' })),
    ...extras.map((x) => ({ label: x, category: 'other', note: x.toLowerCase() })),
    { label: 'Something else', category: 'other', note: '' },
  ];
  const save = () => {
    if (!open || !amount) return;
    const what = open.category === 'other' ? (open.note ? ` on ${open.note}` : '') : ` on ${open.label.toLowerCase()}`;
    update((p) => addEntry(p, { kind: 'spend', amount, category: open.category, note: open.note }), `${money(amount)} spent${what}. Totals updated.`);
    setOpen(null);
  };
  return (
    <section className="card quick" aria-labelledby="qa-h">
      <h2 id="qa-h">Quick add spending</h2>
      <div className="quick-grid">
        {choices.map((c) => (
          <button key={c.label} type="button" className="quick-btn" onClick={() => { setOpen(c); setAmount(null); }}>
            <span aria-hidden="true" className="quick-plus">+</span> {c.label}
          </button>
        ))}
      </div>
      {open && (
        <Modal title={`Spent on ${open.label.toLowerCase()}`} onClose={() => setOpen(null)}>
          <div className="amount-chips" role="group" aria-label="Pick an amount">
            {CHIPS.map((c) => (
              <button key={c} type="button" className="chip big" aria-pressed={amount === pounds(c)} onClick={() => setAmount(pounds(c))}>£{c}</button>
            ))}
          </div>
          <MoneyField label="Or type the amount" value={amount} onChange={setAmount} />
          <div className="stack">
            <button type="button" className="btn primary" disabled={!amount} onClick={save}>{amount ? `Add ${money(amount)}` : 'Add'}</button>
            <button type="button" className="btn secondary" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
