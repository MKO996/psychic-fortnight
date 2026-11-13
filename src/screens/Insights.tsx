import { useMemo, useState } from 'react';
import { useApp } from '../app-context';
import { buildInsights, RANGE_LABEL, type Insight, type Range } from '../insights';
import { money } from '../money';

const GROUPS: { tone: Insight['tone']; title: string; icon: string }[] = [
  { tone: 'watch', title: 'Coming up', icon: '!' },
  { tone: 'change', title: 'Worth changing', icon: '↻' },
  { tone: 'keep', title: 'Keep doing', icon: '✓' },
];

export default function Insights() {
  const { plan, summary, today, go } = useApp();
  const [range, setRange] = useState<Range>('week');
  const [showAll, setShowAll] = useState(false);
  const profile = plan.profile;
  const r = useMemo(() => buildInsights(plan, summary, today, range, profile), [plan, summary, today, range, profile]);
  const simple = (profile?.detail ?? 'simple') === 'simple';
  const visible = simple && !showAll ? r.insights.slice(0, 3) : r.insights;

  const act = (to: NonNullable<Insight['action']>['to']) => {
    if (to === 'groceries') go({ name: 'setup', step: 'groceries', editOnly: true });
    else go({ name: to });
  };

  return (
    <div className="screen insights">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <h1 tabIndex={-1}>Your insights</h1>
      </div>
      <div className="segmented" role="group" aria-label="Choose a time span">
        {(['day', 'week', 'month'] as Range[]).map((x) => (
          <button key={x} type="button" aria-pressed={range === x} onClick={() => { setRange(x); setShowAll(false); }}>{RANGE_LABEL[x]}</button>
        ))}
      </div>
      <p className="insight-headline" data-testid="insight-headline" aria-live="polite">{r.headline}</p>

      {range !== 'day' && (
        <dl className="stat-chips">
          <div><dt>Spent</dt><dd className="amount">{money(r.stats.spent)}</dd></div>
          <div><dt>Came in</dt><dd className="amount">{money(r.stats.income)}</dd></div>
          <div><dt>Saved</dt><dd className="amount">{money(r.stats.saved)}</dd></div>
          <div><dt>Days logged</dt><dd>{r.stats.daysLogged} of {r.stats.days}</dd></div>
        </dl>
      )}

      {GROUPS.map((g) => {
        const items = visible.filter((i) => i.tone === g.tone);
        if (!items.length) return null;
        return (
          <section key={g.tone} className={`insight-group ${g.tone}`} aria-labelledby={`ig-${g.tone}`}>
            <h2 id={`ig-${g.tone}`}><span className="ig-icon" aria-hidden="true">{g.icon}</span>{g.title}</h2>
            <ul className="insight-list">
              {items.map((i) => <InsightCard key={i.id} i={i} openWhy={!simple} onAct={act} />)}
            </ul>
          </section>
        );
      })}

      {simple && r.insights.length > 3 && (
        <button type="button" className="btn secondary add" onClick={() => setShowAll((x) => !x)}>
          {showAll ? 'Show the top 3 only' : `Show all ${r.insights.length} insights`}
        </button>
      )}

      <section className="card quiet">
        <h2>Make these fit you</h2>
        <p className="hint">Tell LEFT what matters most and what you often spend on. Insights about that come first.</p>
        <button type="button" className="btn secondary" onClick={() => go({ name: 'about', back: 'insights' })}>About you</button>
      </section>
      <p className="small-print">Worked out on this phone from what you’ve logged. Nothing is sent anywhere. These are observations, not financial advice.</p>
    </div>
  );
}

function InsightCard({ i, openWhy, onAct }: { i: Insight; openWhy: boolean; onAct: (to: NonNullable<Insight['action']>['to']) => void }) {
  return (
    <li className="card insight" data-testid={`insight-${i.id}`}>
      <h3>{i.title}</h3>
      <p>{i.detail}</p>
      <details open={openWhy}>
        <summary>Why I’m saying this</summary>
        <p className="hint">{i.why}</p>
      </details>
      {i.action && <button type="button" className="btn secondary" onClick={() => onAct(i.action!.to)}>{i.action.label}</button>}
    </li>
  );
}
