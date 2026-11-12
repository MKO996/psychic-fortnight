import { describe, expect, it } from 'vitest';
import { computePlan, monthsToClear, previewSpend } from './calc';
import { addEntry, blankPlan, markBillPaid, proposeSplit, reanchorSample, removeEntry, samplePlan, startNewPeriod } from './plan';
import { addDays } from './dates';
import { pounds } from './money';
import type { Plan } from './types';

const TODAY = '2026-11-12';
const fresh = () => samplePlan(TODAY);
const calc = (p: Plan, t = TODAY) => computePlan(p, t);

describe('sample scenario (spec table)', () => {
  it('opens with £400 required, £100 goals, £30 extra, £70 left, £10.00 today', () => {
    const s = calc(fresh());
    expect(s.status).toBe('ok');
    expect(s.cash).toBe(60000);
    expect(s.requiredTotal).toBe(40000);
    expect(s.goalTotal).toBe(10000);
    expect(s.extraTotal).toBe(3000);
    expect(s.left).toBe(7000);
    expect(s.days).toBe(7);
    expect(s.daily).toBe(1000);
    expect(s.required.find((r) => r.id === 'groceries')!.reserved).toBe(8000);
    expect(s.pots).toEqual({ bills: 35000, debt: 8000, savings: 10000, spending: 7000 });
  });

  it('previews a £25 takeaway without changing the plan', () => {
    const p = fresh();
    const { after, before, tradeOffs } = previewSpend(p, TODAY, pounds(25), 'other', 'takeaway');
    expect(after.left).toBe(4500);
    expect(after.daily).toBe(642);
    expect(tradeOffs).toEqual([]);
    expect(before.left).toBe(7000);
    expect(p.entries).toHaveLength(0);
    expect(calc(p).daily).toBe(1000);
  });

  it('records £25 of groceries, keeps the daily guide, and undo restores it', () => {
    const p = addEntry(fresh(), { kind: 'spend', amount: pounds(25), category: 'groceries', note: '' });
    const s = calc(p);
    expect(s.required.find((r) => r.id === 'groceries')!.reserved).toBe(5500);
    expect(s.cash).toBe(57500);
    expect(s.left).toBe(7000);
    expect(s.daily).toBe(1000);
    const undone = removeEntry(p, p.entries[0].id);
    expect(calc(undone).required.find((r) => r.id === 'groceries')!.reserved).toBe(8000);
    expect(calc(undone).cash).toBe(60000);
  });

  it('marks the £30 phone bill paid', () => {
    const p = markBillPaid(fresh(), 'bill-phone');
    const s = calc(p);
    expect(s.cash).toBe(57000);
    expect(s.requiredTotal).toBe(37000);
    expect(s.daily).toBe(1000);
    expect(s.left).toBe(7000);
    // exactly once
    expect(calc(markBillPaid(p, 'bill-phone')).cash).toBe(57000);
  });

  it('marks the £60 deposit contribution saved', () => {
    const p = addEntry(fresh(), { kind: 'goalSaved', goalId: 'goal-house', amount: pounds(60) });
    const s = calc(p);
    const house = s.derived.goals.find((g) => g.id === 'goal-house')!;
    expect(house.saved).toBe(46000);
    expect(s.goals.find((g) => g.id === 'goal-house')!.allocated).toBe(0);
    expect(s.goals.find((g) => g.id === 'goal-house')!.requested).toBe(0);
    expect(s.cash).toBe(54000);
    expect(s.daily).toBe(1000);
  });

  it('starting cash of £350 is £50 short with nothing for goals or extra debt', () => {
    const s = calc({ ...fresh(), cash: pounds(350) });
    expect(s.status).toBe('short');
    expect(s.shortfall).toBe(5000);
    expect(s.daily).toBe(0);
    expect(s.left).toBe(0);
    expect(s.goalTotal).toBe(0);
    expect(s.extraTotal).toBe(0);
    expect(s.nearestDue!.name).toBe('Rent');
    expect(s.goals.every((g) => g.reason === 'paused: bills come first')).toBe(true);
  });

  it('compares £50 and £80 a month on the £600 0% debt', () => {
    expect(monthsToClear(pounds(600), pounds(50), 'none', 'none')).toBe(12);
    expect(monthsToClear(pounds(600), pounds(80), 'none', 'none')).toBe(8);
    expect(monthsToClear(pounds(600), pounds(80), 'charged', 'none')).toBeNull();
    expect(monthsToClear(pounds(600), pounds(80), 'none', 'unknown')).toBeNull();
  });
});

describe('edge cases', () => {
  it('shows Finish your plan when key inputs are missing', () => {
    const s = calc(blankPlan(TODAY));
    expect(s.status).toBe('incomplete');
    expect(s.missing).toContain('How much money you have now');
    expect(s.daily).toBe(0);
    const later = { ...fresh(), sections: { ...fresh().sections, essentials: 'later' as const } };
    expect(calc(later).status).toBe('incomplete');
    const noAmount = fresh();
    noAmount.bills[0].amount = null;
    expect(calc(noAmount).missing).toContain('Amount for Rent');
  });

  it('covers a bill due on payday unless pay is known to arrive first', () => {
    const p = fresh();
    p.bills.push({ id: 'b-pay', name: 'Gym', amount: pounds(14), dueDate: addDays(TODAY, 7), paid: 0, reserveNow: null, heldSoFar: 0 });
    expect(calc(p).requiredTotal).toBe(41400);
    expect(calc({ ...p, payArrivesBeforeBills: true }).requiredTotal).toBe(40000);
    // a bill due after payday is not reserved
    p.bills[2].dueDate = addDays(TODAY, 8);
    expect(calc(p).requiredTotal).toBe(40000);
  });

  it('includes overdue bills', () => {
    const p = fresh();
    p.bills[0].dueDate = addDays(TODAY, -2);
    const s = calc(p);
    expect(s.required.find((r) => r.id === 'bill-rent')!.overdue).toBe(true);
    expect(s.requiredTotal).toBe(40000);
  });

  it('counts a received wage once, when recorded', () => {
    const p = addEntry(fresh(), { kind: 'income', amount: pounds(200), note: 'shift' });
    const s = calc(p);
    expect(s.cash).toBe(80000);
    expect(s.left).toBe(27000);
    expect(s.daily).toBe(Math.floor(27000 / 7));
    // the expected wage alone is never counted
    expect(calc(fresh()).cash).toBe(60000);
  });

  it('overspending a category reduces what is left elsewhere', () => {
    const p = addEntry(fresh(), { kind: 'spend', amount: pounds(90), category: 'groceries', note: '' });
    const s = calc(p);
    expect(s.required.find((r) => r.id === 'groceries')!.reserved).toBe(0);
    expect(s.left).toBe(6000);
  });

  it('a big purchase preview shows trade-offs against goals and extra debt', () => {
    const { after, tradeOffs } = previewSpend(fresh(), TODAY, pounds(120));
    expect(after.left).toBe(0);
    expect(after.extraTotal).toBe(0);
    expect(after.goalTotal).toBe(8000);
    expect(tradeOffs.length).toBe(2);
  });

  it('caps extra debt at the balance after the minimum, and goals at the target', () => {
    const p = fresh();
    p.debts[0].balance = pounds(70); // 50 minimum leaves 20
    p.goals[1].target = pounds(420); // only 20 still needed
    const s = calc(p);
    expect(s.extras[0].allocated).toBe(2000);
    expect(s.extras[0].reduced).toBe(1000);
    expect(s.extras[0].reason).toBe('balance covered');
    expect(s.goals.find((g) => g.id === 'goal-house')!.allocated).toBe(2000);
    expect(s.goals.find((g) => g.id === 'goal-house')!.reason).toBe('target reached');
  });

  it('allocates goals in priority order when money is tight', () => {
    const s = calc({ ...fresh(), cash: pounds(450) });
    expect(s.goals.find((g) => g.id === 'goal-emergency')!.allocated).toBe(4000);
    expect(s.goals.find((g) => g.id === 'goal-house')!.allocated).toBe(1000);
    expect(s.extraTotal).toBe(0);
    expect(s.left).toBe(0);
  });

  it('views: today, 7 days and rest of month', () => {
    const s = calc(fresh());
    const [t, w, m] = s.views;
    expect(t.amount).toBe(1000);
    expect(t.lastFunded).toBe(TODAY);
    expect(w.amount).toBe(7000); // covers the whole period → full remainder
    expect(w.lastFunded).toBe(addDays(TODAY, 6));
    expect(m.coveredDays).toBe(7);
    // with a longer period the week view multiplies the daily guide
    const long = calc({ ...fresh(), nextPayday: addDays(TODAY, 10) });
    expect(long.daily).toBe(700);
    expect(long.views[1].amount).toBe(4900);
    expect(long.views[1].wholePeriod).toBe(false);
  });

  it('prompts on payday', () => {
    expect(calc(fresh(), addDays(TODAY, 7)).status).toBe('payday');
  });

  it('uses a review date when payday is unknown', () => {
    const p = { ...fresh(), nextPayday: null, paydayUnknown: true, reviewDate: addDays(TODAY, 5) };
    const s = calc(p);
    expect(s.endKind).toBe('review');
    expect(s.days).toBe(5);
    expect(s.daily).toBe(1400);
  });

  it('weekly pay: reserve towards a monthly bill due later, then credit it', () => {
    const p = fresh();
    p.bills.push({ id: 'b-council', name: 'Council tax', amount: pounds(120), dueDate: addDays(TODAY, 20), paid: 0, reserveNow: pounds(30), heldSoFar: 0 });
    const s = calc(p);
    expect(s.requiredTotal).toBe(43000);
    expect(s.left).toBe(4000);
    const next = startNewPeriod(p, addDays(TODAY, 7), pounds(400), addDays(TODAY, 14), null);
    const council = next.bills.find((b) => b.id === 'b-council')!;
    expect(council.heldSoFar).toBe(3000);
    const s2 = calc(next, addDays(TODAY, 7));
    expect(s2.required.find((r) => r.id === 'b-council')!.reserved).toBe(6000); // 30 held + 30 more
    // once due inside the period, the full unpaid amount is reserved (held money counts towards it)
    const s3 = calc({ ...next, nextPayday: addDays(TODAY, 21) }, addDays(TODAY, 7));
    expect(s3.required.find((r) => r.id === 'b-council')!.reserved).toBe(12000);
  });

  it('mortgage payment is required once; overpayment is an optional extra', () => {
    const p = fresh();
    p.debts.push({ id: 'd-mort', name: 'Mortgage', kind: 'mortgage', balance: pounds(90000), minimum: pounds(100), dueDate: addDays(TODAY, 3), minimumPaid: 0, extraRequested: pounds(10), extraPaid: 0, interest: 'charged', fees: 'unknown' });
    const s = calc({ ...p, cash: pounds(800) });
    expect(s.required.filter((r) => r.id === 'd-mort')).toHaveLength(1);
    expect(s.requiredTotal).toBe(50000);
    expect(s.extraTotal).toBe(4000);
  });

  it('re-anchors the sample to today', () => {
    const p = reanchorSample(samplePlan('2026-11-01'), TODAY);
    expect(calc(p).days).toBe(7);
    expect(calc(p).daily).toBe(1000);
  });

  it('help me split it: even split, capped, no money lost', () => {
    const out = proposeSplit(pounds(100), [{ id: 'a', stillNeeded: pounds(30) }, { id: 'b', stillNeeded: pounds(1000) }]);
    expect(out).toEqual({ a: 3000, b: 7000 });
    const odd = proposeSplit(1001, [{ id: 'a', stillNeeded: 99999 }, { id: 'b', stillNeeded: 99999 }, { id: 'c', stillNeeded: 99999 }]);
    expect(odd.a + odd.b + odd.c).toBe(1001);
  });
});

import { applyChanges } from './apply';
import { parseUtterance } from './parser';

describe('talk or type → apply', () => {
  it('"I spent £25 on groceries" then "I have £600 now" keeps cash consistent', () => {
    let p = fresh();
    p = applyChanges(p, parseUtterance('I spent £25 on groceries', p).changes);
    expect(calc(p).cash).toBe(57500);
    p = applyChanges(p, parseUtterance('I have £600 now', p).changes);
    expect(calc(p).cash).toBe(60000);
    expect(calc(p).required.find((r) => r.id === 'groceries')!.reserved).toBe(5500);
  });
  it('"I got paid £200 for a shift" adds income once', () => {
    const p = applyChanges(fresh(), parseUtterance('I got paid £200 for a shift', fresh()).changes);
    expect(calc(p).cash).toBe(80000);
    expect(p.entries).toHaveLength(1);
  });
  it('first-time description fills a blank plan', () => {
    const b = blankPlan(TODAY);
    const p = applyChanges(b, parseUtterance('I have £600 now. I need £80 for groceries and £20 for travel', b).changes);
    expect(p.cash).toBe(60000);
    expect(p.essentials.map((e) => e.budget)).toEqual([8000, 2000]);
    expect(calc(p).missing).toContain('Your next payday');
  });
});
