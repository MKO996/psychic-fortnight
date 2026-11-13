import { useApp } from '../app-context';
import { money } from '../money';
import { daysBetween, relativeDay } from '../dates';
import { addEntry, markBillPaid } from '../plan';

const dayNum = (iso: string) => String(Number(iso.slice(8, 10)));
const weekday = (iso: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const month = (iso: string) => new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** Next bills and debt payments, with one-tap Paid, plus money expected in. */
export default function Upcoming() {
  const { summary: s, plan, today, update, go } = useApp();
  type Row = { key: string; name: string; amount: number; date: string | null; kind: 'bill' | 'debtMin' | 'later' | 'income'; id: string; overdue?: boolean };
  const rows: Row[] = [
    ...s.required.filter((r) => r.kind !== 'essential' && r.reserved > 0 && !r.note.startsWith('Putting aside')).map((r) => ({ key: `${r.kind}-${r.id}`, name: r.name, amount: r.reserved, date: r.dueDate, kind: r.kind as Row['kind'], id: r.id, overdue: r.overdue })),
    ...s.laterBills.filter((b) => b.dueDate && daysBetween(today, b.dueDate) <= 14).map((b) => ({ key: `later-${b.id}`, name: b.name, amount: (b.amount ?? 0) - b.paid, date: b.dueDate, kind: 'later' as const, id: b.id })),
    ...plan.incomes.filter((i) => i.nextDate && i.amount && daysBetween(today, i.nextDate) >= 0 && daysBetween(today, i.nextDate) <= 14).map((i) => ({ key: `inc-${i.id}`, name: i.name, amount: i.amount!, date: i.nextDate, kind: 'income' as const, id: i.id })),
  ]
    .sort((a, b) => (a.date ?? '0000').localeCompare(b.date ?? '0000'))
    .slice(0, 6);

  return (
    <section className="card upcoming" aria-labelledby="up-h">
      <div className="row-between">
        <h2 id="up-h">Upcoming payments</h2>
        <button type="button" className="btn tertiary" onClick={() => go({ name: 'plan' })}>See all</button>
      </div>
      {rows.length === 0 && <p>Nothing due in the next two weeks.</p>}
      <ul className="up-list">
        {rows.map((r) => (
          <li key={r.key} className={`up-row ${r.kind} ${r.overdue ? 'overdue' : ''}`}>
            <span className="up-date" aria-hidden="true">
              {r.date ? (<><span className="up-wd">{weekday(r.date)}</span><span className="up-day">{dayNum(r.date)}</span><span className="up-mo">{month(r.date)}</span></>) : <span className="up-day">?</span>}
            </span>
            <span className="up-main">
              <span className="up-name">{r.name}</span>
              <span className="up-meta">
                {r.kind === 'income' ? 'Expected in, counted when received' : r.kind === 'later' ? 'After payday' : r.overdue ? 'Overdue' : r.date ? `Due ${relativeDay(r.date, today)}` : 'Date not set'}
                {r.date && <span className="visually-hidden">, {r.date}</span>}
              </span>
            </span>
            <span className={`up-amount amount ${r.kind === 'income' ? 'pos' : ''}`}>{r.kind === 'income' ? '+' : ''}{money(r.amount)}</span>
            {(r.kind === 'bill' || r.kind === 'debtMin') && (
              <button type="button" className="up-paid" aria-label={`Mark ${r.name} paid, ${money(r.amount)}`} onClick={() => update((p) => (r.kind === 'bill' ? markBillPaid(p, r.id) : addEntry(p, { kind: 'debtPaid', debtId: r.id, part: 'minimum', amount: r.amount })), `${r.name} marked paid. ${money(r.amount)} taken from your cash and your bills.`)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                <span>Paid</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
