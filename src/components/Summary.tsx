import { useApp } from '../app-context';
import { money } from '../money';
import { longDate, relativeDay, shortDate } from '../dates';

/** Ring of what's left until payday, with three simple progress bars underneath. */
export default function Summary() {
  const { summary: s, plan, today, go } = useApp();
  const d = s.derived;
  const endWord = s.endKind === 'review' ? 'review date' : 'payday';
  const spentThisPay = plan.entries.filter((e) => e.kind === 'spend').reduce((a, e) => a + e.amount, 0);
  const otherSpent = plan.entries.filter((e) => e.kind === 'spend' && !d.essentials.some((x) => x.id === (e as { category: string }).category)).reduce((a, e) => a + e.amount, 0);
  const ringPct = s.left + otherSpent > 0 ? s.left / (s.left + otherSpent) : 0;

  const due = s.required.filter((r) => r.kind !== 'essential');
  const dueFull = due.reduce((a, r) => a + r.full, 0);
  const duePaid = due.reduce((a, r) => a + r.done, 0);
  const gro = s.required.find((r) => r.kind === 'essential' && r.id === 'groceries');
  const savePlanned = d.goals.reduce((a, g) => a + Math.max(g.contribution, g.savedThisPeriod), 0);
  const saveMoved = d.goals.reduce((a, g) => a + g.savedThisPeriod, 0);

  // Arc: 270° gauge
  const R = 52, C = 2 * Math.PI * R, ARC = C * 0.75;
  const filled = ARC * Math.max(0, Math.min(1, ringPct));

  return (
    <section className="card summary" aria-labelledby="sum-h">
      <div className="row-between">
        <h2 id="sum-h">Summary</h2>
        <button type="button" className="btn tertiary" onClick={() => go({ name: 'plan' })}>Details</button>
      </div>
      <div className="summary-top">
        <div className="sum-stat">
          <span className="sum-num amount">{money(spentThisPay)}</span>
          <span className="sum-label">Spent this pay</span>
        </div>
        <div className="ring" role="img" aria-label={`${money(s.left)} left until ${endWord}`}>
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r={R} className="ring-track" strokeDasharray={`${ARC} ${C}`} transform="rotate(135 60 60)" />
            <circle cx="60" cy="60" r={R} className="ring-fill" strokeDasharray={`${filled} ${C}`} transform="rotate(135 60 60)" />
          </svg>
          <span className="ring-center">
            <span className="ring-num amount" data-testid="left-total">{money(s.left)}</span>
            <span className="ring-label">Left until {endWord}</span>
          </span>
        </div>
        <div className="sum-stat">
          <span className="sum-num">{s.end ? `${s.days} ${s.days === 1 ? 'day' : 'days'}` : '—'}</span>
          <span className="sum-label">{s.end ? <span aria-label={`until ${endWord}, ${longDate(s.end)}`}>until {endWord}<br />{shortDate(s.end)}</span> : `No ${endWord} set`}</span>
        </div>
      </div>
      <div className="sum-bars">
        <Bar label="Bills & debt paid" value={duePaid} max={dueFull} text={`${money(duePaid)} / ${money(dueFull)}`} color="var(--pot-bills)" />
        {gro && <Bar label="Groceries left" value={gro.reserved} max={gro.full} text={<><span data-testid="groceries-left">{money(gro.reserved)}</span> / {money(gro.full)}</>} color="var(--pot-debt)" />}
        <Bar label="Savings moved" value={saveMoved} max={savePlanned} text={`${money(saveMoved)} / ${money(savePlanned)}`} color="var(--pot-savings)" />
      </div>
      <p className="sum-strip">
        {s.status === 'short' && s.nearestDue
          ? <>Next: {s.nearestDue.name} first, {money(s.nearestDue.reserved)}{s.nearestDue.dueDate && ` · ${shortDate(s.nearestDue.dueDate)}`}</>
          : s.nearestDue
          ? <>Next: {s.nearestDue.name} {money(s.nearestDue.reserved)}{s.nearestDue.dueDate && ` · ${shortDate(s.nearestDue.dueDate)} (${relativeDay(s.nearestDue.dueDate, today)})`}</>
          : s.end ? <>All bills covered. {endWord === 'payday' ? 'Payday' : 'Review'} {shortDate(s.end)}.</> : <>Finish your plan to see what’s next.</>}
      </p>
      {gro && gro.done > gro.full && <p className="hint">Groceries are {money(gro.done - gro.full)} over: that comes out of your spending money.</p>}
    </section>
  );
}

function Bar({ label, value, max, text, color }: { label: string; value: number; max: number; text: React.ReactNode; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="sum-bar">
      <span className="sum-bar-label">{label}</span>
      <span className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={typeof text === 'string' ? text : `${money(value)} of ${money(max)}`}>
        <span className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </span>
      <span className="sum-bar-text amount">{text}</span>
    </div>
  );
}
