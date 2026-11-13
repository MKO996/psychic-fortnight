import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../app-context';
import { money } from '../money';
import { addDays, daysBetween, shortDate } from '../dates';
import { nextDateFor, uid } from '../plan';
import { Choice, DateField, MoneyField, TextField } from '../ui';
import type { Bill, Debt, Goal, Income, Known, Plan, SectionKey } from '../types';
import { billDueThisPeriod, missingItems, periodEnd, softGaps } from '../calc';
import { ChipGroup, FOCUS_OPTIONS } from './About';
import { defaultProfile } from '../plan';
import { pounds } from '../money';

const STEPS = ['cash', 'frequency', 'payday', 'income', 'bills', 'groceries', 'transport', 'debts', 'goals', 'about', 'check'] as const;
type Step = (typeof STEPS)[number];

export default function Setup({ startStep, editOnly }: { startStep?: string; editOnly?: boolean }) {
  const { plan, update, go, fillPots, celebrate } = useApp();
  const first = (STEPS as readonly string[]).includes(startStep ?? '') ? (startStep as Step) : firstOpenStep(plan);
  const [step, setStep] = useState<Step>(first);
  const idx = STEPS.indexOf(step);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('h1')?.focus(); }, [step]);

  const set = (fn: (p: Plan) => Plan) => update(fn);
  const next = () => {
    if (editOnly) { go({ name: 'plan' }); return; }
    setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  };
  const back = () => {
    if (editOnly || idx === 0) { go({ name: plan.confirmed ? 'plan' : 'welcome' }); return; }
    setStep(STEPS[idx - 1]);
  };
  const section = (k: SectionKey, v: 'none' | 'later') => { set((p) => ({ ...p, sections: { ...p.sections, [k]: v } })); next(); };

  const nav = (extra?: ReactNode, canContinue = true) => (
    <div className="wizard-nav">
      {extra}
      <div className="row-wrap">
        <button type="button" className="btn secondary" onClick={back}>‹ Back</button>
        <button type="button" className="btn primary grow" disabled={!canContinue} onClick={next}>{editOnly ? 'Save' : 'Continue'}</button>
      </div>
    </div>
  );

  let body: ReactNode = null;
  switch (step) {
    case 'cash':
      body = (
        <>
          <Q title="How much money do you have now?" hint="Count money in your current account and cash you can use. Don’t count credit limits, an overdraft or money in savings." />
          <MoneyField big label="Money you can use now" value={plan.cash} onChange={(a) => set((p) => ({ ...p, cash: a }))} autoFocus />
          {!editOnly && <button type="button" className="btn link" onClick={() => go({ name: 'talk' })}>Or describe it in your own words</button>}
          {nav(<button type="button" className="btn tertiary" onClick={() => { set((p) => ({ ...p, cash: null })); next(); }}>I’ll add this later</button>)}
        </>
      );
      break;
    case 'frequency':
      body = (
        <>
          <Q title="How often are you paid?" />
          <Choice
            legend="How often are you paid?"
            value={plan.frequency}
            onChange={(v) => set((p) => ({ ...p, frequency: v, paydayUnknown: v === 'irregular' ? p.paydayUnknown : p.paydayUnknown }))}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'fortnightly', label: 'Every two weeks' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'irregular', label: 'It changes', hint: 'Shifts, gig work, or not sure' },
            ]}
          />
          {nav(undefined)}
        </>
      );
      break;
    case 'payday':
      body = <PaydayStep nav={nav} />;
      break;
    case 'income':
      body = (
        <>
          <Q title="What pay do you expect?" hint="Add each wage or other money you expect. It’s only counted when you record it as received." />
          <ItemList
            items={plan.incomes}
            addLabel={plan.incomes.length ? 'Add another income' : 'Add pay'}
            onAdd={() => set((p) => ({ ...p, incomes: [...p.incomes, { id: uid('inc'), name: p.incomes.length ? '' : 'Wage', amount: null, frequency: p.frequency ?? 'monthly', nextDate: p.nextPayday }], sections: { ...p.sections, income: 'filled' } }))}
            onRemove={(id) => set((p) => ({ ...p, incomes: p.incomes.filter((x) => x.id !== id) }))}
            render={(i) => <IncomeForm item={i} />}
            name={(i) => i.name || 'Income'}
          />
          {nav(<NoneLater onNone={() => section('income', 'none')} onLater={() => section('income', 'later')} noneLabel="None expected" />)}
        </>
      );
      break;
    case 'bills':
      body = (
        <>
          <Q title="Which bills do you need to pay?" hint="Rent, phone, energy, council tax and so on. Put a mortgage under debts." />
          <ItemList
            items={plan.bills}
            addLabel={plan.bills.length ? 'Add another bill' : 'Add a bill'}
            onAdd={() => set((p) => ({ ...p, bills: [...p.bills, { id: uid('bill'), name: '', amount: null, dueDate: null, paid: 0, reserveNow: null, heldSoFar: 0 }], sections: { ...p.sections, bills: 'filled' } }))}
            onRemove={(id) => set((p) => ({ ...p, bills: p.bills.filter((x) => x.id !== id) }))}
            render={(b) => <BillForm item={b} />}
            name={(b) => b.name || 'Bill'}
          />
          {nav(<NoneLater onNone={() => section('bills', 'none')} onLater={() => section('bills', 'later')} noneLabel="No bills" />)}
        </>
      );
      break;
    case 'groceries':
    case 'transport': {
      const e = plan.essentials.find((x) => x.id === step)!;
      const setBudget = (a: number | null, state?: 'later') =>
        set((p) => {
          const essentials = p.essentials.map((x) => (x.id === step ? { ...x, budget: a } : x));
          return { ...p, essentials, sections: { ...p.sections, essentials: state ?? (essentials.every((x) => x.budget !== null) ? 'filled' : p.sections.essentials) } };
        });
      body = (
        <>
          <Q title={step === 'groceries' ? 'How much do you need for groceries before payday?' : 'How much do you need for transport before payday?'} hint={step === 'groceries' ? 'Food and everyday shopping.' : 'Bus, train, fuel or taxis.'} />
          <MoneyField big label={step === 'groceries' ? 'Groceries' : 'Transport'} value={e.budget} onChange={(a) => setBudget(a)} autoFocus />
          <div className="amount-chips" role="group" aria-label="Quick amounts">
            {(step === 'groceries' ? [40, 60, 80, 100, 150] : [10, 20, 30, 50]).map((n) => (
              <button key={n} type="button" className="chip big" aria-pressed={e.budget === pounds(n)} onClick={() => setBudget(pounds(n))}>£{n}</button>
            ))}
          </div>
          {nav(
            <div className="row-wrap">
              {step === 'transport' && <button type="button" className="btn tertiary" onClick={() => { setBudget(0); next(); }}>None</button>}
              <button type="button" className="btn tertiary" onClick={() => { setBudget(null, 'later'); next(); }}>I’ll add this later</button>
            </div>,
          )}
        </>
      );
      break;
    }
    case 'debts':
      body = (
        <>
          <Q title="Do you have debt payments due?" hint="Cards, loans, catalogues, buy now pay later, or a mortgage." />
          <ItemList
            items={plan.debts}
            addLabel={plan.debts.length ? 'Add another debt' : 'Add a debt'}
            onAdd={() => set((p) => ({ ...p, debts: [...p.debts, { id: uid('debt'), name: '', kind: 'card', balance: null, minimum: null, dueDate: null, minimumPaid: 0, extraRequested: 0, extraPaid: 0, interest: 'unknown', fees: 'unknown' }], sections: { ...p.sections, debts: 'filled' } }))}
            onRemove={(id) => set((p) => ({ ...p, debts: p.debts.filter((x) => x.id !== id) }))}
            render={(t) => <DebtForm item={t} />}
            name={(t) => t.name || 'Debt'}
          />
          {nav(<NoneLater onNone={() => section('debts', 'none')} onLater={() => section('debts', 'later')} noneLabel="No debts" />)}
        </>
      );
      break;
    case 'goals':
      body = (
        <>
          <Q title="What are you saving for?" hint="Name a pot, like House deposit, Emergency savings or Holiday. Not sure what to put in? Leave it at £0 and use Help me split it later." />
          <ItemList
            items={[...plan.goals].sort((a, b) => a.priority - b.priority)}
            addLabel={plan.goals.length ? 'Add another goal' : 'Add a goal'}
            onAdd={() => set((p) => ({ ...p, goals: [...p.goals, { id: uid('goal'), name: '', target: null, saved: 0, priority: p.goals.length + 1, deadline: null, contribution: 0, savedThisPeriod: 0 }], sections: { ...p.sections, goals: 'filled' } }))}
            onRemove={(id) => set((p) => ({ ...p, goals: renumber(p.goals.filter((x) => x.id !== id)) }))}
            render={(g) => <GoalForm item={g} />}
            name={(g) => g.name || 'Goal'}
          />
          {nav(<NoneLater onNone={() => section('goals', 'none')} onLater={() => section('goals', 'later')} noneLabel="Not saving now" />)}
        </>
      );
      break;
    case 'about': {
      const prof = { ...defaultProfile, ...(plan.profile ?? {}) };
      body = (
        <>
          <Q title="What matters most to you right now?" hint="LEFT puts insights about this first. You can change it any time." />
          <ChipGroup legend="What matters most right now?" single options={FOCUS_OPTIONS} selected={prof.focus ? [prof.focus] : []} onToggle={(v) => set((p) => ({ ...p, profile: { ...prof, focus: v as typeof prof.focus } }))} />
          {nav(<button type="button" className="btn tertiary" onClick={next}>Skip</button>)}
        </>
      );
      break;
    }
    case 'check':
      body = (
        <>
          <Q title="Check what I understood" hint="Tap Change to fix anything." />
          <CheckSummary onEdit={(s) => setStep(s)} />
          <div className="wizard-nav">
            <div className="row-wrap">
              <button type="button" className="btn secondary" onClick={back}>‹ Back</button>
              <button type="button" className="btn primary grow" onClick={() => {
                set((p) => ({ ...p, confirmed: true }));
                fillPots();
                go({ name: 'today' });
                celebrate(missingItems(plan).length ? 'Plan saved. Finish the missing parts to see what’s safe to spend.' : 'Your plan is ready.');
              }}>Confirm my plan</button>
            </div>
          </div>
        </>
      );
      break;
  }

  return (
    <div className="screen setup" ref={ref}>
      {!editOnly && (
        <p className="step-count" aria-label={`Step ${idx + 1} of ${STEPS.length}`}>
          <span className="dots" aria-hidden="true">{STEPS.map((s, i) => <span key={s} className={i <= idx ? 'on' : ''} />)}</span>
          Step {idx + 1} of {STEPS.length}
        </p>
      )}
      {body}
    </div>
  );
}

function firstOpenStep(p: Plan): Step {
  if (p.cash === null) return 'cash';
  if (!p.frequency) return 'frequency';
  if (!p.nextPayday && !p.reviewDate) return 'payday';
  if (p.sections.income === 'open') return 'income';
  if (p.sections.bills === 'open') return 'bills';
  if (p.essentials.find((e) => e.id === 'groceries')?.budget === null) return 'groceries';
  if (p.essentials.find((e) => e.id === 'transport')?.budget === null) return 'transport';
  if (p.sections.debts === 'open') return 'debts';
  if (p.sections.goals === 'open') return 'goals';
  return 'check';
}

function renumber(gs: Goal[]): Goal[] {
  return [...gs].sort((a, b) => a.priority - b.priority).map((g, i) => ({ ...g, priority: i + 1 }));
}

function Q({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="question">
      <h1 tabIndex={-1}>{title}</h1>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function NoneLater({ onNone, onLater, noneLabel }: { onNone: () => void; onLater: () => void; noneLabel: string }) {
  return (
    <div className="row-wrap">
      <button type="button" className="btn tertiary" onClick={onNone}>{noneLabel}</button>
      <button type="button" className="btn tertiary" onClick={onLater}>I’ll add this later</button>
    </div>
  );
}

function ItemList<T extends { id: string }>({ items, onAdd, onRemove, render, name, addLabel }: { items: T[]; onAdd: () => void; onRemove: (id: string) => void; render: (t: T) => ReactNode; name: (t: T) => string; addLabel: string }) {
  return (
    <div className="item-list">
      {items.map((it) => (
        <div key={it.id} className="card item-form">
          {render(it)}
          <button type="button" className="btn tertiary" onClick={() => onRemove(it.id)} aria-label={`Remove ${name(it)}`}>Remove</button>
        </div>
      ))}
      <button type="button" className="btn secondary add" onClick={onAdd}>+ {addLabel}</button>
    </div>
  );
}

function PaydayStep({ nav }: { nav: (extra?: ReactNode, ok?: boolean) => ReactNode }) {
  const { plan, update, today } = useApp();
  const set = (fn: (p: Plan) => Plan) => update(fn);
  const unknown = plan.paydayUnknown;
  const date = unknown ? plan.reviewDate : plan.nextPayday;
  const past = !!date && daysBetween(today, date) <= 0;
  return (
    <>
      <Q title={unknown ? 'When should we look at your plan again?' : 'When is your next payday?'} hint={unknown ? 'Pick a date to review. LEFT spreads your money until then.' : undefined} />
      {unknown ? (
        <DateField label="Review date" value={plan.reviewDate} min={addDays(today, 1)} onChange={(d) => set((p) => ({ ...p, reviewDate: d }))} />
      ) : (
        <DateField label="Next payday" value={plan.nextPayday} min={addDays(today, 1)} onChange={(d) => set((p) => ({ ...p, nextPayday: d, incomes: p.incomes.map((i, n) => (n === 0 && !i.nextDate ? { ...i, nextDate: d } : i)) }))} />
      )}
      {past && <p className="error" role="alert">Choose a date after today.</p>}
      <div className="row-wrap">
        {!unknown && (
          <button type="button" className="btn tertiary" onClick={() => set((p) => ({ ...p, paydayUnknown: true, nextPayday: null, reviewDate: p.reviewDate ?? addDays(today, 7) }))}>I don’t know</button>
        )}
        {unknown && (
          <button type="button" className="btn tertiary" onClick={() => set((p) => ({ ...p, paydayUnknown: false }))}>I know my payday</button>
        )}
        {!unknown && plan.frequency && plan.frequency !== 'irregular' && !plan.nextPayday && (
          <button type="button" className="btn tertiary" onClick={() => set((p) => ({ ...p, nextPayday: nextDateFor(p.frequency, today) }))}>Suggest a date</button>
        )}
      </div>
      {!unknown && (
        <label className="check-row">
          <input type="checkbox" checked={plan.payArrivesBeforeBills} onChange={(e) => set((p) => ({ ...p, payArrivesBeforeBills: e.target.checked }))} />
          <span>My pay always arrives before bills go out on payday. <small>Leave unticked if you’re not sure: LEFT will cover bills due on payday from the money you have now.</small></span>
        </label>
      )}
      {nav(undefined, !past)}
    </>
  );
}

function useItem<K extends 'incomes' | 'bills' | 'debts' | 'goals'>(key: K, id: string) {
  const { update } = useApp();
  return (patch: Partial<Plan[K][number]>) => update((p) => ({ ...p, [key]: (p[key] as { id: string }[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}

function IncomeForm({ item }: { item: Income }) {
  const patch = useItem('incomes', item.id);
  return (
    <>
      <TextField label="Name" value={item.name} placeholder="Wage, shifts, benefits…" onChange={(name) => patch({ name })} />
      <MoneyField label="Amount you expect" value={item.amount} onChange={(amount) => patch({ amount })} />
      <DateField label="Expected on" value={item.nextDate} onChange={(nextDate) => patch({ nextDate })} />
      <Choice legend="How often?" value={item.frequency} onChange={(frequency) => patch({ frequency })} options={[{ value: 'weekly', label: 'Weekly' }, { value: 'fortnightly', label: 'Every two weeks' }, { value: 'monthly', label: 'Monthly' }, { value: 'irregular', label: 'It changes' }]} />
    </>
  );
}

function BillForm({ item }: { item: Bill }) {
  const { plan } = useApp();
  const patch = useItem('bills', item.id);
  const { end } = periodEnd(plan);
  const later = !!item.dueDate && !!end && !billDueThisPeriod(item, end, plan.payArrivesBeforeBills);
  return (
    <>
      <TextField label="Bill" value={item.name} placeholder="Rent, phone, energy…" onChange={(name) => patch({ name })} />
      <MoneyField label="Amount" value={item.amount} onChange={(amount) => patch({ amount })} />
      <DateField label="Due date" hint="Leave empty if you’re not sure. LEFT will cover it now to be safe." value={item.dueDate} onChange={(dueDate) => patch({ dueDate })} />
      {later && (
        <MoneyField label={`Put aside from this pay (optional)`} hint={`Due after payday, on ${shortDate(item.dueDate!)}. Putting some aside now spreads the cost.`} value={item.reserveNow} onChange={(reserveNow) => patch({ reserveNow })} />
      )}
    </>
  );
}

const KNOWN = [{ value: 'none' as Known, label: 'None' }, { value: 'charged' as Known, label: 'Yes' }, { value: 'unknown' as Known, label: 'Not sure' }];

function DebtForm({ item }: { item: Debt }) {
  const patch = useItem('debts', item.id);
  const mort = item.kind === 'mortgage';
  return (
    <>
      <TextField label="Name" value={item.name} placeholder="Credit card, loan, mortgage…" onChange={(name) => patch({ name, kind: /mortgage/i.test(name) ? 'mortgage' : item.kind === 'mortgage' ? 'other' : item.kind })} />
      <MoneyField label={mort ? 'Mortgage payment due' : 'Payment due (minimum)'} value={item.minimum} onChange={(minimum) => patch({ minimum })} />
      <DateField label="Payment due on" value={item.dueDate} onChange={(dueDate) => patch({ dueDate })} />
      <MoneyField label="Balance owed" value={item.balance} onChange={(balance) => patch({ balance })} />
      <Choice legend="Is interest charged?" value={item.interest} onChange={(interest) => patch({ interest })} options={KNOWN} />
      <Choice legend="Are there fees?" value={item.fees} onChange={(fees) => patch({ fees })} options={KNOWN} />
      <MoneyField label={mort ? 'Overpayment from this pay (optional)' : 'Extra payment from this pay (optional)'} hint="Only paid if there’s money after bills and savings." value={item.extraRequested || null} onChange={(a) => patch({ extraRequested: a ?? 0 })} />
    </>
  );
}

function GoalForm({ item }: { item: Goal }) {
  const { plan, update } = useApp();
  const patch = useItem('goals', item.id);
  const move = (dir: -1 | 1) =>
    update((p) => {
      const gs = renumber(p.goals);
      const i = gs.findIndex((g) => g.id === item.id);
      const j = i + dir;
      if (j < 0 || j >= gs.length) return p;
      [gs[i], gs[j]] = [gs[j], gs[i]];
      return { ...p, goals: gs.map((g, n) => ({ ...g, priority: n + 1 })) };
    });
  return (
    <>
      <TextField label="Pot name" value={item.name} placeholder="House deposit" onChange={(name) => patch({ name })} />
      {!item.name && (
        <div className="row-wrap">
          {['Emergency savings', 'House deposit', 'Holiday'].map((n) => <button key={n} type="button" className="chip" onClick={() => patch({ name: n })}>{n}</button>)}
        </div>
      )}
      <MoneyField label="Target" value={item.target} onChange={(target) => patch({ target })} />
      <MoneyField label="Already saved" hint="Money already kept separately. LEFT won’t spend it." value={item.saved || null} onChange={(a) => patch({ saved: a ?? 0 })} />
      <MoneyField label="Put in from this pay" value={item.contribution || null} onChange={(a) => patch({ contribution: a ?? 0 })} />
      <DateField label="Deadline (optional)" value={item.deadline} onChange={(deadline) => patch({ deadline })} />
      <div className="row-wrap">
        <span className="badge">Priority {item.priority} of {plan.goals.length}</span>
        <button type="button" className="btn tertiary" disabled={item.priority === 1} onClick={() => move(-1)} aria-label={`Move ${item.name || 'goal'} up`}>↑ Higher</button>
        <button type="button" className="btn tertiary" disabled={item.priority === plan.goals.length} onClick={() => move(1)} aria-label={`Move ${item.name || 'goal'} down`}>↓ Lower</button>
      </div>
    </>
  );
}

function CheckSummary({ onEdit }: { onEdit: (s: Step) => void }) {
  const { plan, summary } = useApp();
  const fmt = (p: number | null) => (p === null ? <span className="gap">Missing</span> : money(p));
  const state = (k: SectionKey, n: number) => (plan.sections[k] === 'later' ? <span className="gap">To add later</span> : plan.sections[k] === 'none' ? 'None' : n === 0 ? <span className="gap">Not answered</span> : null);
  const end = summary.end;
  const rows: [Step, string, ReactNode][] = [
    ['cash', 'Money you have now', fmt(plan.cash)],
    ['frequency', 'Paid', plan.frequency ?? <span className="gap">Missing</span>],
    ['payday', plan.paydayUnknown ? 'Review date' : 'Next payday', end ? shortDate(end) : <span className="gap">Missing</span>],
    ['income', 'Pay expected', state('income', plan.incomes.length) ?? plan.incomes.map((i) => `${i.name || 'Income'} ${i.amount !== null ? money(i.amount) : '(amount missing)'}`).join(', ')],
    ['bills', 'Bills', state('bills', plan.bills.length) ?? plan.bills.map((b) => `${b.name || 'Bill'} ${b.amount !== null ? money(b.amount) : '(amount missing)'}${b.dueDate ? ` due ${shortDate(b.dueDate)}` : ''}`).join(', ')],
    ['groceries', 'Groceries', fmt(plan.essentials.find((e) => e.id === 'groceries')?.budget ?? null)],
    ['transport', 'Transport', fmt(plan.essentials.find((e) => e.id === 'transport')?.budget ?? null)],
    ['debts', 'Debt payments', state('debts', plan.debts.length) ?? plan.debts.map((t) => `${t.name || 'Debt'} ${t.minimum !== null ? money(t.minimum) : '(payment missing)'}`).join(', ')],
    ['goals', 'Saving for', state('goals', plan.goals.length) ?? plan.goals.map((g) => `${g.name || 'Goal'} ${money(g.contribution)} from this pay`).join(', ')],
  ];
  const gaps = softGaps(plan);
  return (
    <>
      <dl className="check-summary">
        {rows.map(([s, label, val]) => (
          <div key={s}>
            <dt>{label}</dt>
            <dd>{val}</dd>
            <button type="button" className="btn tertiary" onClick={() => onEdit(s)} aria-label={`Change ${label.toLowerCase()}`}>Change</button>
          </div>
        ))}
      </dl>
      {summary.status === 'incomplete' ? (
        <p className="notice">You can save now and finish later. Until then LEFT will say “Finish your plan to see what’s safe to spend”.</p>
      ) : summary.status === 'short' ? (
        <p className="notice">You’re {money(summary.shortfall)} short for bills and essentials.</p>
      ) : (
        <p className="ok-line">That leaves {money(summary.left)} until {summary.endKind === 'review' ? 'your review date' : 'payday'}: {money(summary.daily, { pennies: true })} a day.</p>
      )}
      {gaps.length > 0 && <p className="hint">You can add later: {gaps.join('; ')}.</p>}
    </>
  );
}
