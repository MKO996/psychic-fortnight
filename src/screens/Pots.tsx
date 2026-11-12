import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { Modal } from '../ui';
import { shortDate } from '../dates';

type PotKey = 'bills' | 'debt' | 'savings' | 'spending';
const LABEL: Record<PotKey, string> = { bills: 'Bills & essentials', debt: 'Debt', savings: 'Savings', spending: 'Spending' };

export default function Pots() {
  const { summary: s, potsKey, settings } = useApp();
  const [open, setOpen] = useState<PotKey | null>(null);
  const [filled, setFilled] = useState(settings.reduceMotion);

  // Fill from empty each time a real action asks for it (plan confirmed, demo opened).
  useEffect(() => {
    if (settings.reduceMotion) { setFilled(true); return; }
    setFilled(false);
    const t = setTimeout(() => setFilled(true), 60);
    return () => clearTimeout(t);
  }, [potsKey, settings.reduceMotion]);

  const total = s.pots.bills + s.pots.debt + s.pots.savings + s.pots.spending;
  const keys: PotKey[] = ['bills', 'debt', 'savings', 'spending'];
  const max = Math.max(1, ...keys.map((k) => s.pots[k]));

  return (
    <section className="card" aria-labelledby="pots-h">
      <h2 id="pots-h">Your money, split into pots</h2>
      <p className="hint">Tap a pot to see what’s in it.</p>
      <div className="pots">
        {keys.map((k, i) => {
          const pct = Math.round((s.pots[k] / max) * 100);
          return (
            <button key={k} type="button" className={`pot pot-${k}`} onClick={() => setOpen(k)} aria-label={`${LABEL[k]}: ${money(s.pots[k])}. Show breakdown`}>
              <span className="pot-jar" aria-hidden="true">
                <span className="pot-fill" style={{ height: filled ? `${Math.max(pct, s.pots[k] > 0 ? 6 : 0)}%` : '0%', transitionDelay: `${i * 140}ms` }} />
              </span>
              <span className="pot-amount amount">{money(s.pots[k])}</span>
              <span className="pot-label">{LABEL[k]}</span>
            </button>
          );
        })}
      </div>
      <p className="hint">Total: {money(total)}{s.status === 'short' ? ` needed, but you have ${money(s.cash)}.` : ' of the money you have now.'}</p>
      {open && (
        <Modal title={LABEL[open]} onClose={() => setOpen(null)}>
          <PotBreakdown k={open} />
          <button type="button" className="btn primary" onClick={() => setOpen(null)}>Close</button>
        </Modal>
      )}
    </section>
  );
}

function PotBreakdown({ k }: { k: PotKey }) {
  const { summary: s } = useApp();
  let rows: [string, number, string?][] = [];
  if (k === 'bills') rows = s.required.filter((r) => r.kind !== 'debtMin').map((r) => [r.name, r.reserved, r.dueDate ? `due ${shortDate(r.dueDate)}` : r.kind === 'essential' ? 'left to spend' : r.note]);
  if (k === 'debt') rows = [...s.required.filter((r) => r.kind === 'debtMin').map((r) => [`${r.name}: payment due`, r.reserved, r.dueDate ? `due ${shortDate(r.dueDate)}` : ''] as [string, number, string]), ...s.extras.map((x) => [`${x.name}: extra payment`, x.allocated, 'optional'] as [string, number, string])];
  if (k === 'savings') rows = s.goals.map((g) => [g.name, g.allocated, 'from this pay']);
  if (k === 'spending') rows = [['Left until ' + (s.endKind === 'review' ? 'your review date' : 'payday'), s.left], ['Safe to spend today', s.daily]];
  if (!rows.length) return <p>Nothing in this pot right now.</p>;
  return (
    <table className="breakdown">
      <tbody>
        {rows.map(([name, p, note], i) => (
          <tr key={i}>
            <th scope="row">{name}{note && <small>{note}</small>}</th>
            <td className="amount">{money(p, { pennies: k === 'spending' && i === 1 })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
