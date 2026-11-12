import type { Change } from './parser';
import type { Plan } from './types';
import { addEntry, markBillPaid, uid } from './plan';
import { derivePlan } from './calc';

/** Apply checked changes from Talk or type. Affordability questions never reach here. */
export function applyChanges(plan: Plan, changes: Change[]): Plan {
  let p = plan;
  for (const c of changes) {
    switch (c.type) {
      case 'setCash': {
        if (c.amount === null) break;
        // "I have £X now" means after everything logged, so adjust the starting figure.
        const { cash } = derivePlan(p);
        const net = cash - (p.cash ?? 0);
        p = { ...p, cash: c.amount - net };
        break;
      }
      case 'setEssential': {
        if (c.amount === null) break;
        const exists = p.essentials.some((e) => e.id === c.id);
        const essentials = exists ? p.essentials.map((e) => (e.id === c.id ? { ...e, budget: c.amount } : e)) : [...p.essentials, { id: c.id, name: c.name, budget: c.amount, spent: 0 }];
        p = { ...p, essentials, sections: { ...p.sections, essentials: essentials.every((e) => e.budget !== null) ? 'filled' : p.sections.essentials } };
        break;
      }
      case 'addBill': {
        const existing = p.bills.find((b) => b.name.toLowerCase() === c.name.toLowerCase());
        const bills = existing ? p.bills.map((b) => (b === existing ? { ...b, amount: c.amount } : b)) : [...p.bills, { id: uid('bill'), name: c.name, amount: c.amount, dueDate: null, paid: 0, reserveNow: null, heldSoFar: 0 }];
        p = { ...p, bills, sections: { ...p.sections, bills: 'filled' } };
        break;
      }
      case 'billPaid':
        if (!c.billId) break;
        p = c.amount === null ? markBillPaid(p, c.billId) : addEntry(p, { kind: 'billPaid', billId: c.billId, amount: c.amount });
        break;
      case 'spend':
        if (c.amount === null || !c.category) break;
        p = addEntry(p, { kind: 'spend', amount: c.amount, category: c.category, note: c.note });
        break;
      case 'income':
        if (c.amount === null) break;
        p = addEntry(p, { kind: 'income', amount: c.amount, note: c.note });
        break;
      case 'goalSaved':
        if (c.amount === null || !c.goalId) break;
        p = addEntry(p, { kind: 'goalSaved', goalId: c.goalId, amount: c.amount });
        break;
      case 'addGoal':
        p = { ...p, goals: [...p.goals, { id: uid('goal'), name: c.name, target: c.amount, saved: 0, priority: p.goals.length + 1, deadline: null, contribution: 0, savedThisPeriod: 0 }], sections: { ...p.sections, goals: 'filled' } };
        break;
      case 'addDebt':
        p = { ...p, debts: [...p.debts, { id: uid('debt'), name: c.name, kind: /mortgage/i.test(c.name) ? 'mortgage' : /card/i.test(c.name) ? 'card' : 'other', balance: c.amount, minimum: null, dueDate: null, minimumPaid: 0, extraRequested: 0, extraPaid: 0, interest: 'unknown', fees: 'unknown' }], sections: { ...p.sections, debts: 'filled' } };
        break;
      case 'afford':
        break;
    }
  }
  return p;
}

export function changeReady(c: Change): boolean {
  if (c.type === 'afford' || c.type === 'billPaid') return c.type === 'afford' ? c.amount !== null : !!c.billId;
  if (c.type === 'spend') return c.amount !== null && !!c.category;
  if (c.type === 'goalSaved') return c.amount !== null && !!c.goalId;
  if (c.type === 'addGoal' || c.type === 'addDebt' || c.type === 'addBill') return !!c.name;
  return c.amount !== null;
}
