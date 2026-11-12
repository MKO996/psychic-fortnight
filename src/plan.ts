import type { Pence } from './money';
import { pounds } from './money';
import type { ISODate } from './dates';
import { addDays, addMonths, daysBetween, isValidISO } from './dates';
import type { Entry, Plan, PayFrequency } from './types';
import { derivePlan, periodEnd } from './calc';

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The fictional sample used by "Try the demo". Dates are relative to `today`. */
export function samplePlan(today: ISODate): Plan {
  return {
    version: 1,
    kind: 'sample',
    anchor: today,
    cash: pounds(600),
    frequency: 'weekly',
    nextPayday: addDays(today, 7),
    paydayUnknown: false,
    reviewDate: null,
    payArrivesBeforeBills: false,
    incomes: [{ id: 'inc-wage', name: 'Weekly wage (sample)', amount: pounds(380), frequency: 'weekly', nextDate: addDays(today, 7) }],
    bills: [
      { id: 'bill-rent', name: 'Rent', amount: pounds(220), dueDate: addDays(today, 2), paid: 0, reserveNow: null, heldSoFar: 0 },
      { id: 'bill-phone', name: 'Phone bill', amount: pounds(30), dueDate: addDays(today, 4), paid: 0, reserveNow: null, heldSoFar: 0 },
    ],
    essentials: [
      { id: 'groceries', name: 'Groceries', budget: pounds(80), spent: 0 },
      { id: 'transport', name: 'Transport', budget: pounds(20), spent: 0 },
    ],
    debts: [
      { id: 'debt-card', name: 'Credit card (0%)', kind: 'card', balance: pounds(600), minimum: pounds(50), dueDate: addDays(today, 5), minimumPaid: 0, extraRequested: pounds(30), extraPaid: 0, interest: 'none', fees: 'none' },
    ],
    goals: [
      { id: 'goal-emergency', name: 'Emergency savings', target: pounds(500), saved: 0, priority: 1, deadline: null, contribution: pounds(40), savedThisPeriod: 0 },
      { id: 'goal-house', name: 'House deposit', target: pounds(3000), saved: pounds(400), priority: 2, deadline: null, contribution: pounds(60), savedThisPeriod: 0 },
    ],
    sections: { income: 'filled', bills: 'filled', essentials: 'filled', debts: 'filled', goals: 'filled' },
    entries: [],
    confirmed: true,
  };
}

export function blankPlan(today: ISODate): Plan {
  return {
    version: 1,
    kind: 'personal',
    anchor: today,
    cash: null,
    frequency: null,
    nextPayday: null,
    paydayUnknown: false,
    reviewDate: null,
    payArrivesBeforeBills: false,
    incomes: [],
    bills: [],
    essentials: [
      { id: 'groceries', name: 'Groceries', budget: null, spent: 0 },
      { id: 'transport', name: 'Transport', budget: null, spent: 0 },
    ],
    debts: [],
    goals: [],
    sections: { income: 'open', bills: 'open', essentials: 'open', debts: 'open', goals: 'open' },
    entries: [],
    confirmed: false,
  };
}

/** Keep the sample's dates moving with the calendar so it always opens 7 days before payday. */
export function reanchorSample(plan: Plan, today: ISODate): Plan {
  const shift = daysBetween(plan.anchor, today);
  if (plan.kind !== 'sample' || shift === 0) return plan;
  const mv = (d: ISODate | null) => (d ? addDays(d, shift) : d);
  return {
    ...plan,
    anchor: today,
    nextPayday: mv(plan.nextPayday),
    reviewDate: mv(plan.reviewDate),
    incomes: plan.incomes.map((i) => ({ ...i, nextDate: mv(i.nextDate) })),
    bills: plan.bills.map((b) => ({ ...b, dueDate: mv(b.dueDate) })),
    debts: plan.debts.map((t) => ({ ...t, dueDate: mv(t.dueDate) })),
    goals: plan.goals.map((g) => ({ ...g, deadline: mv(g.deadline) })),
  };
}

type NewEntry = Entry extends infer E ? (E extends Entry ? Omit<E, 'id' | 'at'> : never) : never;

export function addEntry(plan: Plan, e: NewEntry): Plan {
  const entry = { ...e, id: uid('e'), at: new Date().toISOString() } as Entry;
  return { ...plan, entries: [...plan.entries, entry] };
}

export function removeEntry(plan: Plan, id: string): Plan {
  return { ...plan, entries: plan.entries.filter((e) => e.id !== id) };
}

export function updateEntry(plan: Plan, id: string, patch: Partial<Entry>): Plan {
  return { ...plan, entries: plan.entries.map((e) => (e.id === id ? ({ ...e, ...patch } as Entry) : e)) };
}

/** Pay the rest of a bill (exactly the unpaid amount, once). */
export function markBillPaid(plan: Plan, billId: string): Plan {
  const { derived } = derivePlan(plan);
  const b = derived.bills.find((x) => x.id === billId);
  if (!b || b.amount === null) return plan;
  const unpaid = b.amount - b.paid;
  if (unpaid <= 0) return plan;
  return addEntry(plan, { kind: 'billPaid', billId, amount: unpaid });
}

export function nextDateFor(freq: PayFrequency | null, from: ISODate): ISODate | null {
  if (freq === 'weekly') return addDays(from, 7);
  if (freq === 'fortnightly') return addDays(from, 14);
  if (freq === 'monthly') return addMonths(from, 1);
  return null;
}

/**
 * Start a new pay period: bake logged entries into the plan, reset spending,
 * move monthly bills on, and credit money put aside towards later bills.
 */
export function startNewPeriod(plan: Plan, today: ISODate, cash: Pence, nextPayday: ISODate | null, reviewDate: ISODate | null): Plan {
  const { derived } = derivePlan(plan);
  const { end } = periodEnd(derived);
  const bills = derived.bills.map((b) => {
    const amount = b.amount ?? 0;
    const fullyPaid = b.paid >= amount && amount > 0;
    const dueAfter = !!b.dueDate && !!end && daysBetween(end, b.dueDate) > 0;
    if (fullyPaid) {
      return { ...b, paid: 0, heldSoFar: 0, dueDate: b.dueDate && isValidISO(b.dueDate) ? addMonths(b.dueDate, 1) : b.dueDate };
    }
    if (dueAfter) {
      return { ...b, heldSoFar: Math.min(amount - b.paid, b.heldSoFar + (b.reserveNow ?? 0)) };
    }
    return b; // still unpaid and due: stays required (overdue if the date passed)
  });
  const debts = derived.debts.map((t) => {
    const minDone = t.minimum !== null && t.minimumPaid >= t.minimum;
    return { ...t, minimumPaid: minDone ? 0 : t.minimumPaid, extraPaid: 0, dueDate: minDone && t.dueDate ? addMonths(t.dueDate, 1) : t.dueDate };
  });
  return {
    ...derived,
    cash,
    nextPayday,
    paydayUnknown: !nextPayday,
    reviewDate: nextPayday ? null : reviewDate,
    anchor: today,
    bills,
    debts,
    essentials: derived.essentials.map((e) => ({ ...e, spent: 0 })),
    goals: derived.goals.map((g) => ({ ...g, savedThisPeriod: 0 })),
    incomes: derived.incomes.map((i) => ({ ...i, nextDate: i.nextDate && daysBetween(today, i.nextDate) <= 0 ? nextDateFor(i.frequency, i.nextDate) : i.nextDate })),
    entries: [],
  };
}

/**
 * Help me split it: split what's left after required costs and the amount to keep,
 * evenly across goals, capped at what each still needs (overflow moves on).
 */
export function proposeSplit(pool: Pence, goals: { id: string; stillNeeded: number }[]): Record<string, Pence> {
  const out: Record<string, Pence> = {};
  for (const g of goals) out[g.id] = 0;
  let remaining = Math.max(0, pool);
  let open = goals.filter((g) => g.stillNeeded > 0);
  while (remaining > 0 && open.length) {
    const even = Math.floor(remaining / open.length);
    const share = Math.max(1, even >= 100 ? Math.floor(even / 100) * 100 : even);
    for (const g of open) {
      const give = Math.min(share, g.stillNeeded - out[g.id], remaining);
      out[g.id] += give;
      remaining -= give;
      if (remaining <= 0) break;
    }
    open = open.filter((g) => out[g.id] < g.stillNeeded);
  }
  return out;
}
