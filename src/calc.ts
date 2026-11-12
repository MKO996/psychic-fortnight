/**
 * LEFT's single deterministic calculation. Every screen reads from computePlan().
 * All amounts are integer pence.
 */
import type { Pence } from './money';
import { money } from './money';
import type { ISODate } from './dates';
import { addDays, daysBetween, endOfMonth } from './dates';
import type { Bill, Debt, Entry, Goal, Plan } from './types';

export type LineKind = 'bill' | 'essential' | 'debtMin';

export interface RequiredLine {
  kind: LineKind;
  id: string;
  name: string;
  /** Amount still reserved now. */
  reserved: Pence;
  /** Full amount for this item in this period (bill amount, budget, minimum). */
  full: Pence;
  done: Pence;
  dueDate: ISODate | null;
  overdue: boolean;
  note: string;
}

export interface AllocationLine {
  id: string;
  name: string;
  requested: Pence; // still wanted from this pay
  allocated: Pence;
  reduced: Pence;
  reason: '' | 'not enough money' | 'target reached' | 'balance covered' | 'paused: bills come first';
}

export interface View {
  key: 'today' | 'week' | 'month';
  label: string;
  coveredDays: number;
  amount: Pence;
  lastFunded: ISODate | null;
  wholePeriod: boolean;
}

export interface Summary {
  today: ISODate;
  end: ISODate | null;
  endKind: 'payday' | 'review' | null;
  days: number;
  status: 'incomplete' | 'payday' | 'short' | 'ok';
  missing: string[];
  cash: Pence;
  required: RequiredLine[];
  requiredTotal: Pence;
  laterBills: Bill[];
  available: Pence; // cash - required (may be negative)
  shortfall: Pence;
  goals: AllocationLine[];
  goalTotal: Pence;
  extras: AllocationLine[];
  extraTotal: Pence;
  left: Pence;
  daily: Pence;
  views: View[];
  nearestDue: RequiredLine | null;
  pots: { bills: Pence; debt: Pence; savings: Pence; spending: Pence };
  derived: Plan;
}

/** Apply logged entries on top of the base plan. Pure: never mutates the input. */
export function derivePlan(plan: Plan): { derived: Plan; cash: Pence } {
  const d: Plan = structuredCloneSafe(plan);
  let cash = plan.cash ?? 0;
  for (const e of plan.entries) cash = applyEntry(d, e, cash);
  return { derived: d, cash };
}

function applyEntry(d: Plan, e: Entry, cash: Pence): Pence {
  switch (e.kind) {
    case 'income':
      return cash + e.amount;
    case 'spend': {
      const ess = d.essentials.find((x) => x.id === e.category);
      if (ess) ess.spent += e.amount;
      return cash - e.amount;
    }
    case 'billPaid': {
      const b = d.bills.find((x) => x.id === e.billId);
      if (b) b.paid += e.amount;
      return cash - e.amount;
    }
    case 'debtPaid': {
      const t = d.debts.find((x) => x.id === e.debtId);
      if (t) {
        if (e.part === 'minimum') t.minimumPaid += e.amount;
        else t.extraPaid += e.amount;
        if (t.balance !== null) t.balance = Math.max(0, t.balance - e.amount);
      }
      return cash - e.amount;
    }
    case 'goalSaved': {
      const g = d.goals.find((x) => x.id === e.goalId);
      if (g) {
        g.saved += e.amount;
        g.savedThisPeriod += e.amount;
      }
      return cash - e.amount;
    }
  }
}

function structuredCloneSafe<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function periodEnd(plan: Plan): { end: ISODate | null; endKind: 'payday' | 'review' | null } {
  if (plan.nextPayday && !plan.paydayUnknown) return { end: plan.nextPayday, endKind: 'payday' };
  if (plan.reviewDate) return { end: plan.reviewDate, endKind: 'review' };
  return { end: null, endKind: null };
}

/** Does this bill need to be covered from the money available now? */
export function billDueThisPeriod(b: { dueDate: ISODate | null }, end: ISODate | null, payArrivesBeforeBills: boolean): boolean {
  if (!b.dueDate || !end) return true; // unknown → be careful and cover it
  const n = daysBetween(b.dueDate, end); // end - due
  if (n > 0) return true;
  if (n === 0) return !payArrivesBeforeBills;
  return false;
}

export function missingItems(plan: Plan): string[] {
  const m: string[] = [];
  if (plan.cash === null) m.push('How much money you have now');
  if (!plan.nextPayday && !plan.reviewDate) m.push(plan.paydayUnknown ? 'A date to review your plan' : 'Your next payday');
  if (plan.sections.bills === 'later' || plan.sections.bills === 'open') m.push('Your bills');
  for (const b of plan.bills) if (b.amount === null) m.push(`Amount for ${b.name || 'a bill'}`);
  for (const e of plan.essentials) if (e.budget === null) m.push(`Amount for ${e.name.toLowerCase()}`);
  if (plan.sections.essentials === 'later' || plan.sections.essentials === 'open') m.push('Groceries and travel');
  if (plan.sections.debts === 'later' || plan.sections.debts === 'open') m.push('Debt payments');
  for (const t of plan.debts) if (t.minimum === null) m.push(`Payment due for ${t.name || 'a debt'}`);
  return m;
}

/** Soft gaps: shown so they can be finished later, but they don't block the figure. */
export function softGaps(plan: Plan): string[] {
  const m: string[] = [];
  for (const b of plan.bills) if (!b.dueDate) m.push(`Due date for ${b.name || 'a bill'} (covered now to be safe)`);
  for (const t of plan.debts) {
    if (t.balance === null) m.push(`Balance for ${t.name || 'a debt'}`);
    if (!t.dueDate) m.push(`Due date for ${t.name || 'a debt'} (covered now to be safe)`);
  }
  for (const g of plan.goals) if (g.target === null) m.push(`Target for ${g.name || 'a goal'}`);
  for (const i of plan.incomes) {
    if (i.amount === null) m.push(`Amount for ${i.name || 'your pay'}`);
  }
  if (plan.sections.income === 'later' || plan.sections.income === 'open') m.push('What pay you expect');
  if (plan.sections.goals === 'later' || plan.sections.goals === 'open') m.push('What you are saving for');
  return m;
}

export function computePlan(plan: Plan, today: ISODate): Summary {
  const { derived, cash } = derivePlan(plan);
  const { end, endKind } = periodEnd(derived);
  const missing = missingItems(derived);
  const days = end ? Math.max(0, daysBetween(today, end)) : 0;

  // 1. Required: unpaid bills due by end (incl. overdue), essentials left, debt minimums due by end.
  const required: RequiredLine[] = [];
  const laterBills: Bill[] = [];
  for (const b of derived.bills) {
    const amount = b.amount ?? 0;
    const unpaid = Math.max(0, amount - b.paid);
    const overdue = !!b.dueDate && daysBetween(today, b.dueDate) < 0 && unpaid > 0;
    if (billDueThisPeriod(b, end, derived.payArrivesBeforeBills)) {
      required.push({ kind: 'bill', id: b.id, name: b.name, reserved: unpaid, full: amount, done: Math.min(b.paid, amount), dueDate: b.dueDate, overdue, note: b.dueDate ? '' : 'Due date missing, covered now to be safe' });
    } else {
      laterBills.push(b);
      const hold = Math.min(unpaid, b.heldSoFar + (b.reserveNow ?? 0));
      if (hold > 0) {
        required.push({ kind: 'bill', id: b.id, name: b.name, reserved: hold, full: hold, done: 0, dueDate: b.dueDate, overdue: false, note: `Putting aside towards ${money(amount)} due after payday` });
      }
    }
  }
  for (const e of derived.essentials) {
    const budget = e.budget ?? 0;
    required.push({ kind: 'essential', id: e.id, name: e.name, reserved: Math.max(0, budget - e.spent), full: budget, done: e.spent, dueDate: null, overdue: false, note: '' });
  }
  for (const t of derived.debts) {
    const min = t.minimum ?? 0;
    if (!billDueThisPeriod(t, end, derived.payArrivesBeforeBills)) continue;
    let unpaid = Math.max(0, min - t.minimumPaid);
    if (t.balance !== null) unpaid = Math.min(unpaid, t.balance);
    const overdue = !!t.dueDate && daysBetween(today, t.dueDate) < 0 && unpaid > 0;
    required.push({ kind: 'debtMin', id: t.id, name: t.name, reserved: unpaid, full: min, done: Math.min(t.minimumPaid, min), dueDate: t.dueDate, overdue, note: t.dueDate ? '' : 'Due date missing, covered now to be safe' });
  }
  const requiredTotal = sum(required.map((r) => r.reserved));
  const available = cash - requiredTotal;
  const shortfall = available < 0 ? -available : 0;

  // 2. Goals in priority order, then extra debt payments. Paused when short.
  let room = Math.max(0, available);
  const paused = shortfall > 0;
  const goals: AllocationLine[] = [...derived.goals]
    .sort((a, b) => a.priority - b.priority)
    .map((g: Goal) => {
      const requested = Math.max(0, g.contribution - g.savedThisPeriod);
      const stillNeeded = g.target === null ? Infinity : Math.max(0, g.target - g.saved);
      let allocated = paused ? 0 : Math.min(requested, stillNeeded, room);
      allocated = Math.max(0, allocated);
      room -= allocated;
      const reason: AllocationLine['reason'] = allocated === requested ? '' : paused ? 'paused: bills come first' : allocated === stillNeeded ? 'target reached' : 'not enough money';
      return { id: g.id, name: g.name, requested, allocated, reduced: requested - allocated, reason };
    });
  const extras: AllocationLine[] = derived.debts
    .filter((t) => t.extraRequested > 0)
    .map((t: Debt) => {
      const requested = Math.max(0, t.extraRequested - t.extraPaid);
      const minLine = required.find((r) => r.kind === 'debtMin' && r.id === t.id);
      const balanceAfterMin = t.balance === null ? Infinity : Math.max(0, t.balance - (minLine?.reserved ?? 0));
      let allocated = paused ? 0 : Math.min(requested, balanceAfterMin, room);
      allocated = Math.max(0, allocated);
      room -= allocated;
      const reason: AllocationLine['reason'] = allocated === requested ? '' : paused ? 'paused: bills come first' : allocated === balanceAfterMin ? 'balance covered' : 'not enough money';
      return { id: t.id, name: t.name, requested, allocated, reduced: requested - allocated, reason };
    });
  const goalTotal = sum(goals.map((g) => g.allocated));
  const extraTotal = sum(extras.map((x) => x.allocated));

  // 3. What's left, and the daily guide (rounded down to the penny).
  const left = paused ? 0 : Math.max(0, available - goalTotal - extraTotal);
  let status: Summary['status'] = 'ok';
  if (missing.length) status = 'incomplete';
  else if (end && days === 0) status = 'payday';
  else if (paused) status = 'short';
  const daily = status === 'ok' && days > 0 ? Math.floor(left / days) : 0;

  const views: View[] = [];
  if (end && days > 0) {
    const defs: [View['key'], string, number][] = [
      ['today', 'Today', 1],
      ['week', 'Next 7 days', 7],
      ['month', 'Rest of month', daysBetween(today, endOfMonth(today)) + 1],
    ];
    for (const [key, label, n] of defs) {
      const covered = Math.min(n, days);
      const whole = covered >= days;
      const amount = status !== 'ok' ? 0 : whole ? left : daily * covered;
      views.push({ key, label, coveredDays: covered, amount, lastFunded: addDays(today, covered - 1), wholePeriod: whole });
    }
  }

  const unpaidDue = required.filter((r) => r.kind !== 'essential' && r.reserved > 0);
  unpaidDue.sort((a, b) => (a.dueDate ?? '9999') .localeCompare(b.dueDate ?? '9999'));
  const nearestDue = unpaidDue[0] ?? null;

  const debtMin = sum(required.filter((r) => r.kind === 'debtMin').map((r) => r.reserved));
  const pots = {
    bills: requiredTotal - debtMin,
    debt: debtMin + extraTotal,
    savings: goalTotal,
    spending: left,
  };

  return { today, end, endKind, days, status, missing, cash, required, requiredTotal, laterBills, available, shortfall, goals, goalTotal, extras, extraTotal, left, daily, views, nearestDue, pots, derived };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Months to clear a 0%, no-fee debt paying the same amount each month. null when it can't be estimated. */
export function monthsToClear(balance: Pence, monthly: Pence, interest: Debt['interest'], fees: Debt['fees']): number | null {
  if (interest !== 'none' || fees !== 'none') return null;
  if (monthly <= 0) return null;
  return Math.ceil(balance / monthly);
}

/** What happens to the plan if someone spends `amount` now (not saved). */
export function previewSpend(plan: Plan, today: ISODate, amount: Pence, category = 'other', note = '') {
  const before = computePlan(plan, today);
  const trial: Plan = { ...plan, entries: [...plan.entries, { id: 'preview', at: '', kind: 'spend', amount, category, note }] };
  const after = computePlan(trial, today);
  const tradeOffs: string[] = [];
  for (const g of after.goals) {
    const b = before.goals.find((x) => x.id === g.id);
    if (b && g.allocated < b.allocated) tradeOffs.push(`${g.name} gets ${money(b.allocated - g.allocated)} less from this pay`);
  }
  for (const x of after.extras) {
    const b = before.extras.find((y) => y.id === x.id);
    if (b && x.allocated < b.allocated) tradeOffs.push(`Extra payment to ${x.name} is ${money(b.allocated - x.allocated)} less`);
  }
  if (after.shortfall > before.shortfall) tradeOffs.push(`You would be ${money(after.shortfall)} short for bills and essentials`);
  const ess = before.derived.essentials.find((e) => e.id === category);
  if (ess) {
    const r = before.required.find((x) => x.kind === 'essential' && x.id === category);
    if (r && amount > r.reserved) tradeOffs.push(`That is ${money(amount - r.reserved)} more than you have left for ${ess.name.toLowerCase()}`);
  }
  return { before, after, tradeOffs };
}
