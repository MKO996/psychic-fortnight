import { useEffect, useState } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { longDate, relativeDay, shortDate } from '../dates';
import Coin from './Coin';
import { Modal } from '../ui';

type StatKey = 'bills' | 'debt' | 'savings' | 'spending';
/** Plain-English names stay first; the game name sits beside them. */
const STATS: { key: StatKey; label: string; game: string; icon: string }[] = [
  { key: 'bills', label: 'Bills & essentials', game: 'Shield', icon: '🛡️' },
  { key: 'debt', label: 'Debt', game: 'Attack', icon: '⚔️' },
  { key: 'savings', label: 'Savings', game: 'Treasure', icon: '💎' },
  { key: 'spending', label: 'Spending', game: 'Stamina', icon: '⚡' },
];

/** Today's character sheet: who you are in the game, and where every pound of your cash is. */
export default function CharacterSheet() {
  const { summary: s, game: g, plan, potsKey, settings, go, today } = useApp();
  const [open, setOpen] = useState<StatKey | null>(null);
  const [filled, setFilled] = useState(settings.reduceMotion);
  useEffect(() => {
    if (settings.reduceMotion) { setFilled(true); return; }
    setFilled(false);
    const t = setTimeout(() => setFilled(true), 60);
    return () => clearTimeout(t);
  }, [potsKey, settings.reduceMotion]);

  const endWord = s.endKind === 'review' ? 'your review date' : 'payday';
  const name = plan.profile?.name || (plan.kind === 'sample' ? 'Sam' : 'You');
  const into = g.xp - g.levelStart;
  const need = g.nextLevelAt - g.levelStart;
  const total = Math.max(1, s.pots.bills + s.pots.debt + s.pots.savings + s.pots.spending);
  const groceries = s.required.find((r) => r.kind === 'essential' && r.id === 'groceries');
  const ready = s.status !== 'incomplete';
  const gameFirst = settings.statNames === 'game';
  const statTitle = (st: (typeof STATS)[number]) => (gameFirst ? st.game : st.label);
  const statSub = (st: (typeof STATS)[number]) => (gameFirst ? st.label : st.game);

  return (
    <section className="sheet" aria-labelledby="safe-h">
      <button type="button" className="sheet-head" onClick={() => go({ name: 'trophies' })} data-testid="hud"
        aria-label={`Level ${g.level}, ${g.title}. ${into} of ${need} XP to level ${g.level + 1}. ${g.streak}-day streak${g.streakAtRisk ? ', check in to keep it going' : ''}. Open trophies`}>
        <span className="sheet-avatar" aria-hidden="true"><Coin mood={g.activeToday ? 'celebrate' : 'idle'} label="" size={64} outfit={g.level} /></span>
        <span className="sheet-id" aria-hidden="true">
          <span className="sheet-name">{name}</span>
          <span className="sheet-level">Lv {g.level} · {g.title}</span>
          <span className="xpbar"><span className="xpbar-fill" style={{ width: `${Math.round((into / need) * 100)}%` }} /></span>
          <span className="sheet-xp">{into} / {need} XP</span>
        </span>
        <span className={`sheet-streak ${g.activeToday ? 'lit' : g.streakAtRisk ? 'risk' : ''}`} aria-hidden="true">🔥<b>{g.streak}</b></span>
      </button>

      <div className="sheet-today">
        <h2 id="safe-h" className="sheet-label">Safe to spend today</h2>
        {s.status === 'incomplete' ? (
          <>
            <p className="sheet-figure muted" aria-hidden="true">£ –</p>
            <p className="hero-line">Finish your plan to see what’s safe to spend.</p>
          </>
        ) : s.status === 'payday' ? (
          <>
            <p className="sheet-figure muted" aria-hidden="true">£ –</p>
            <p className="hero-line">It’s {endWord}. Update your plan to see what’s safe to spend.</p>
            <button type="button" className="btn primary" onClick={() => go({ name: 'newPeriod' })}>Update my plan</button>
          </>
        ) : (
          <>
            <p className="sheet-figure amount" data-testid="safe-today">{money(s.daily, { pennies: true })}</p>
            {s.status === 'short' ? (
              <p className="hero-line warn" role="status">You’re {money(s.shortfall)} short for bills and essentials.{s.nearestDue && <> Your {s.nearestDue.name.toLowerCase()} is due first.</>}</p>
            ) : (
              <p className="hero-line">You have {money(s.daily, { pennies: s.daily % 100 !== 0 })} to spend today after the money you’ve set aside.</p>
            )}
          </>
        )}
        {ready && s.end && (
          <p className="sheet-left">
            <span><b className="amount" data-testid="left-total">{money(s.left)}</b> left until {endWord}</span>
            <span aria-label={longDate(s.end)}>{s.endKind === 'review' ? 'Review' : 'Payday'} {shortDate(s.end)} ({relativeDay(s.end, today)})</span>
          </p>
        )}
      </div>

      {ready && (
        <>
          <h3 className="sheet-sub">Your {money(s.cash)}, split into 4 stats <small>Tap a stat to see what’s in it</small></h3>
          <ul className="stats">
            {STATS.map((st, i) => {
              const v = s.pots[st.key];
              const short = st.key === 'bills' && s.status === 'short';
              return (
                <li key={st.key}>
                  <button type="button" className={`stat pot stat-${st.key}`} onClick={() => setOpen(st.key)} aria-label={gameFirst ? `${st.game}, ${st.label}: ${money(v)}. Show breakdown` : `${st.label}: ${money(v)}. Show breakdown`}>
                    <span className="stat-icon" aria-hidden="true">{st.icon}</span>
                    <span className="stat-name" aria-hidden="true"><b>{statTitle(st)}</b><small>{statSub(st)}{short ? ' · cracked' : ''}</small></span>
                    <span className="stat-val amount" aria-hidden="true">{money(v)}</span>
                    <span className="stat-track" aria-hidden="true">
                      <span className="stat-fill pot-fill" style={{ width: filled ? `${Math.max(Math.round((v / total) * 100), v > 0 ? 3 : 0)}%` : '0%', transitionDelay: `${i * 140}ms` }} />
                    </span>
                    {short && <span className="stat-warn">{money(s.shortfall)} short</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {groceries && (
            <div className="supplies" role="group" aria-labelledby="gro-h">
              <span className="stat-icon" aria-hidden="true">🍞</span>
              <span className="stat-name"><b id="gro-h">{gameFirst ? 'Supplies left' : 'Groceries left'}</b><small>{gameFirst ? 'Groceries' : 'Supplies'} · {money(groceries.done)} spent of {money(groceries.full)}</small></span>
              <span className="stat-val amount" data-testid="groceries-left">{money(groceries.reserved)}</span>
              <span className="stat-track" aria-hidden="true"><span className="stat-fill supplies-fill" style={{ width: `${groceries.full ? Math.round((groceries.reserved / groceries.full) * 100) : 0}%` }} /></span>
            </div>
          )}
          {groceries && groceries.done > groceries.full && <p className="sheet-note">Groceries are {money(groceries.done - groceries.full)} over: that comes out of your spending money.</p>}
          {s.nearestDue && <p className="sheet-next">{gameFirst ? 'Next encounter' : 'Next payment'}: <b>{s.nearestDue.name} {money(s.nearestDue.reserved)}</b>{s.nearestDue.dueDate && ` · ${shortDate(s.nearestDue.dueDate)} (${relativeDay(s.nearestDue.dueDate, today)})`}</p>}
        </>
      )}

      {open && (
        <Modal title={gameFirst ? `${STATS.find((x) => x.key === open)!.game}: ${STATS.find((x) => x.key === open)!.label}` : STATS.find((x) => x.key === open)!.label} onClose={() => setOpen(null)}>
          <StatBreakdown k={open} />
          <button type="button" className="btn primary" onClick={() => setOpen(null)}>Close</button>
        </Modal>
      )}
    </section>
  );
}

function StatBreakdown({ k }: { k: StatKey }) {
  const { summary: s } = useApp();
  let rows: [string, number, string?][] = [];
  if (k === 'bills') rows = s.required.filter((r) => r.kind !== 'debtMin').map((r) => [r.name, r.reserved, r.dueDate ? `due ${shortDate(r.dueDate)}` : r.kind === 'essential' ? 'left to spend' : r.note]);
  if (k === 'debt') rows = [...s.required.filter((r) => r.kind === 'debtMin').map((r) => [`${r.name}: payment due`, r.reserved, r.dueDate ? `due ${shortDate(r.dueDate)}` : ''] as [string, number, string]), ...s.extras.map((x) => [`${x.name}: extra payment`, x.allocated, 'optional'] as [string, number, string])];
  if (k === 'savings') rows = s.goals.map((g) => [g.name, g.allocated, 'from this pay']);
  if (k === 'spending') rows = [['Left until ' + (s.endKind === 'review' ? 'your review date' : 'payday'), s.left], ['Safe to spend today', s.daily]];
  if (!rows.length) return <p>Nothing in this stat right now.</p>;
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
