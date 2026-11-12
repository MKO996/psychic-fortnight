import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../app-context';
import { EXAMPLES, followUpFor, parseUtterance, type Change } from '../parser';
import { applyChanges, changeReady } from '../apply';
import { previewSpend } from '../calc';
import { money } from '../money';
import { listen, localSpeechAvailable, type Listening } from '../speech';
import { MoneyField, TextField } from '../ui';

export default function Talk({ initial }: { initial?: string }) {
  const { plan, go, update, summary } = useApp();
  const [text, setText] = useState(initial ?? '');
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [micOk, setMicOk] = useState(false);
  const [listening, setListening] = useState<Listening | null>(null);
  const [micMsg, setMicMsg] = useState<string | null>(null);
  const boxId = useId();
  const checkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    localSpeechAvailable().then((ok) => alive && setMicOk(ok));
    return () => { alive = false; listening?.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const understand = (t = text) => {
    const r = parseUtterance(t, plan);
    if (!r.understood) {
      setChanges(null);
      setNotice(r.followUp);
      return;
    }
    setNotice(null);
    setChanges(r.changes);
    requestAnimationFrame(() => checkRef.current?.querySelector<HTMLElement>('h2')?.focus());
  };

  const startMic = () => {
    setMicMsg('Listening… speak now.');
    const l = listen({
      onText: (t, final) => {
        setText(t);
        if (final) { setMicMsg(null); understand(t); }
      },
      onEnd: () => { setListening(null); setMicMsg((m) => (m === 'Listening… speak now.' ? null : m)); },
      onError: (m) => { setMicMsg(m); setListening(null); },
    });
    setListening(l);
  };

  const affordChange = changes?.find((c) => c.type === 'afford') as Extract<Change, { type: 'afford' }> | undefined;
  const followUp = changes ? followUpFor(changes) : null;
  const ready = !!changes && changes.length > 0 && changes.every(changeReady);

  const setChange = (i: number, c: Change) => setChanges((cs) => cs!.map((x, j) => (j === i ? c : x)));

  const apply = () => {
    if (!changes) return;
    update((p) => applyChanges(p, changes), summaryText(changes));
    go({ name: 'today' });
  };

  return (
    <div className="screen talk">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <h1 tabIndex={-1}>Talk or type</h1>
      </div>

      {!changes && (
        <>
          <div className="field field-big">
            <label htmlFor={boxId}>What’s changed? Or describe your money in your own words.</label>
            <textarea
              id={boxId}
              rows={3}
              value={text}
              placeholder="For example: I spent £25 on groceries"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); understand(); } }}
            />
          </div>
          <div className="row-wrap">
            {micOk && (
              listening ? (
                <button type="button" className="btn secondary" onClick={() => listening.stop()}>■ Stop listening</button>
              ) : (
                <button type="button" className="btn secondary" onClick={startMic}><span aria-hidden="true">🎙</span> Speak</button>
              )
            )}
            <button type="button" className="btn primary grow" onClick={() => understand()} disabled={!text.trim()}>Continue</button>
          </div>
          {micMsg && <p className="status" role="status">{micMsg}</p>}
          {!micOk && <p className="hint">To speak, use the microphone on your phone’s keyboard. LEFT doesn’t record or keep audio.</p>}
          {notice && <p className="notice" role="alert">{notice}</p>}

          <section aria-labelledby="ex-h" className="examples">
            <h2 id="ex-h">Try an example</h2>
            <ul>
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button type="button" className="chip" onClick={() => { setText(ex); understand(ex); }}>“{ex}”</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {changes && affordChange && (
        <AffordPreview change={affordChange} onChange={(c) => setChange(changes.indexOf(affordChange), c)} onClose={() => go({ name: 'today' })} onBought={() => {
          if (affordChange.amount === null) return;
          update((p) => applyChanges(p, [{ type: 'spend', amount: affordChange.amount, category: 'other', note: affordChange.note }]), `Recorded ${money(affordChange.amount)} spent${affordChange.note ? ` on ${affordChange.note}` : ''}.`);
          go({ name: 'today' });
        }} />
      )}

      {changes && !affordChange && (
        <div ref={checkRef} className="check">
          <h2 tabIndex={-1}>Check what I heard</h2>
          <p className="quote">“{text}”</p>
          {followUp && <p className="notice" role="status"><strong>{followUp}</strong></p>}
          <ul className="check-list">
            {changes.map((c, i) => (
              <li key={i} className="card">
                <ChangeEditor change={c} onChange={(nc) => setChange(i, nc)} />
              </li>
            ))}
          </ul>
          <p className="hint">Nothing changes until you press Apply. {summary.status === 'incomplete' ? '' : 'Your totals update straight away after.'}</p>
          <div className="row-wrap">
            <button type="button" className="btn secondary" onClick={() => setChanges(null)}>‹ Change what I said</button>
            <button type="button" className="btn primary grow" disabled={!ready} onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

function summaryText(changes: Change[]): string {
  const parts = changes.map((c) => {
    switch (c.type) {
      case 'spend': return `${money(c.amount ?? 0)} spent${c.category === 'groceries' ? ' on groceries' : c.category === 'transport' ? ' on transport' : c.note ? ` on ${c.note}` : ''}`;
      case 'income': return `${money(c.amount ?? 0)} received`;
      case 'setCash': return `cash now ${money(c.amount ?? 0)}`;
      case 'setEssential': return `${c.name.toLowerCase()} ${money(c.amount ?? 0)}`;
      case 'billPaid': return `${c.name} paid`;
      case 'goalSaved': return `${money(c.amount ?? 0)} saved to ${c.name}`;
      case 'addBill': return `${c.name} added`;
      case 'addGoal': return `${c.name} goal added`;
      case 'addDebt': return `${c.name} added`;
      default: return '';
    }
  });
  const s = parts.filter(Boolean).join(', ');
  return `Updated: ${s}.`;
}

function ChangeEditor({ change: c, onChange }: { change: Change; onChange: (c: Change) => void }) {
  const { plan } = useApp();
  const catId = useId();
  const pickId = useId();
  switch (c.type) {
    case 'setCash':
      return <MoneyField label="Money you have now" hint="Money you can use. Not credit limits or savings pots." value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} invalid={c.amount === null} autoFocus={c.amount === null} />;
    case 'setEssential':
      return <MoneyField label={`${c.name} until payday`} value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} invalid={c.amount === null} />;
    case 'addBill':
      return (
        <>
          <TextField label="Bill" value={c.name} onChange={(n) => onChange({ ...c, name: n })} />
          <MoneyField label="Amount" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} />
          <p className="hint">You can add the due date in your plan.</p>
        </>
      );
    case 'spend':
      return (
        <>
          <p className="change-title">Spent</p>
          <MoneyField label="Amount spent" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} invalid={c.amount === null} autoFocus={c.amount === null} />
          <div className="field">
            <label htmlFor={catId}>What was it for?</label>
            <select id={catId} value={c.category ?? ''} aria-invalid={!c.category || undefined} onChange={(e) => onChange({ ...c, category: e.target.value || null })}>
              <option value="">Choose…</option>
              {plan.essentials.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              <option value="other">Something else (from spending money)</option>
            </select>
          </div>
        </>
      );
    case 'income':
      return (
        <>
          <p className="change-title">Money received</p>
          <MoneyField label="Amount received" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} invalid={c.amount === null} autoFocus={c.amount === null} />
          <TextField label="What for" value={c.note} onChange={(n) => onChange({ ...c, note: n })} />
          <p className="hint">Counted once, now. It isn’t counted again on payday.</p>
        </>
      );
    case 'billPaid':
      return (
        <>
          <p className="change-title">Bill paid</p>
          <div className="field">
            <label htmlFor={pickId}>Which bill?</label>
            <select id={pickId} value={c.billId ?? ''} onChange={(e) => { const b = plan.bills.find((x) => x.id === e.target.value); onChange({ ...c, billId: b?.id ?? null, name: b?.name ?? '' }); }}>
              <option value="">Choose…</option>
              {plan.bills.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <MoneyField label="Amount paid" hint="Leave empty to mark the rest of the bill paid." value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} />
        </>
      );
    case 'goalSaved':
      return (
        <>
          <p className="change-title">Moved to savings</p>
          <div className="field">
            <label htmlFor={pickId}>Which pot?</label>
            <select id={pickId} value={c.goalId ?? ''} onChange={(e) => { const g = plan.goals.find((x) => x.id === e.target.value); onChange({ ...c, goalId: g?.id ?? null, name: g?.name ?? '' }); }}>
              <option value="">Choose…</option>
              {plan.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <MoneyField label="Amount moved" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} invalid={c.amount === null} />
        </>
      );
    case 'addGoal':
      return (
        <>
          <p className="change-title">New savings goal</p>
          <TextField label="Name" value={c.name} onChange={(n) => onChange({ ...c, name: n })} />
          <MoneyField label="Target (optional)" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} />
        </>
      );
    case 'addDebt':
      return (
        <>
          <p className="change-title">New debt</p>
          <TextField label="Name" value={c.name} onChange={(n) => onChange({ ...c, name: n })} />
          <MoneyField label="Balance owed" value={c.amount} onChange={(a) => onChange({ ...c, amount: a })} />
          <p className="hint">Add the payment due and date in your plan.</p>
        </>
      );
    default:
      return null;
  }
}

function AffordPreview({ change, onChange, onClose, onBought }: { change: Extract<Change, { type: 'afford' }>; onChange: (c: Change) => void; onClose: () => void; onBought: () => void }) {
  const { plan, today } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('h2')?.focus(); }, []);
  const res = change.amount !== null ? previewSpend(plan, today, change.amount, 'other', change.note) : null;
  const what = change.note ? ` on ${change.note}` : '';
  return (
    <div className="preview" ref={ref}>
      <h2 tabIndex={-1}>Preview: spend {change.amount !== null ? money(change.amount) : '…'}{what}</h2>
      <p className="preview-note" role="note">This is only a preview. Your plan hasn’t changed.</p>
      <MoneyField label="How much would it cost?" value={change.amount} onChange={(a) => onChange({ ...change, amount: a })} invalid={change.amount === null} />
      {res && res.before.status === 'ok' && (
        <>
          <table className="compare">
            <thead>
              <tr><th scope="col"></th><th scope="col">Now</th><th scope="col">If you spend it</th></tr>
            </thead>
            <tbody>
              <tr><th scope="row">Safe to spend each day</th><td className="amount">{money(res.before.daily, { pennies: true })}</td><td className="amount" data-testid="preview-daily">{money(res.after.daily, { pennies: true })}</td></tr>
              <tr><th scope="row">Left until payday</th><td className="amount">{money(res.before.left)}</td><td className="amount" data-testid="preview-left">{money(res.after.left)}</td></tr>
            </tbody>
          </table>
          <p className="verdict">
            {res.tradeOffs.length === 0
              ? `Yes. You’d have ${money(res.after.left)} left until payday, about ${money(res.after.daily, { pennies: true })} a day.`
              : 'It would change your plan:'}
          </p>
          {res.tradeOffs.length > 0 && <ul className="tradeoffs">{res.tradeOffs.map((t) => <li key={t}>{t}</li>)}</ul>}
        </>
      )}
      {res && res.before.status !== 'ok' && <p className="notice">{res.before.status === 'short' ? `You’re already ${money(res.before.shortfall)} short for bills and essentials, so there’s nothing spare right now.` : 'Finish your plan first to see what you can afford.'}</p>}
      <div className="stack">
        <button type="button" className="btn primary" onClick={onClose}>Close preview</button>
        <button type="button" className="btn secondary" disabled={change.amount === null} onClick={onBought}>I’ve bought it: record it</button>
      </div>
    </div>
  );
}
