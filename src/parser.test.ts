import { describe, expect, it } from 'vitest';
import { findAmounts, parseUtterance, wordsToDigits } from './parser';
import { samplePlan } from './plan';

const plan = samplePlan('2026-11-12');

describe('amounts', () => {
  it('reads spoken and written amounts', () => {
    expect(wordsToDigits('twenty-five pounds')).toBe('25 pounds');
    expect(wordsToDigits('two hundred and fifty quid')).toBe('250 quid');
    expect(wordsToDigits('a thousand pounds')).toBe('1000 pounds');
    expect(findAmounts('twenty-five pounds')[0].pence).toBe(2500);
    expect(findAmounts('£1,200.50')[0].pence).toBe(120050);
    expect(findAmounts('twelve pounds fifty')[0].pence).toBe(1250);
    expect(findAmounts('50p')[0].pence).toBe(50);
    expect(findAmounts('three thousand five hundred pounds')[0].pence).toBe(350000);
  });
});

describe('utterances', () => {
  it('first-time description', () => {
    const r = parseUtterance('I have £600 now. I need £80 for groceries and £20 for travel', plan);
    expect(r.changes).toEqual([
      { type: 'setCash', amount: 60000 },
      { type: 'setEssential', id: 'groceries', name: 'Groceries', amount: 8000 },
      { type: 'setEssential', id: 'transport', name: 'Transport', amount: 2000 },
    ]);
    expect(r.followUp).toBeNull();
  });
  it('spend', () => {
    const r = parseUtterance('I spent £25 on groceries', plan);
    expect(r.changes).toEqual([{ type: 'spend', amount: 2500, category: 'groceries', note: 'groceries' }]);
    expect(parseUtterance('I spent twenty-five pounds on groceries', plan).changes[0]).toMatchObject({ amount: 2500, category: 'groceries' });
  });
  it('spend without amount or category asks a follow-up', () => {
    expect(parseUtterance('I spent some money on groceries', plan).followUp).toBe('How much did you spend?');
    expect(parseUtterance('I spent £12', plan).followUp).toBe('What was it for?');
  });
  it('income', () => {
    const r = parseUtterance('I got paid £200 for a shift', plan);
    expect(r.changes).toEqual([{ type: 'income', amount: 20000, note: 'shift' }]);
  });
  it('affordability', () => {
    const r = parseUtterance('Can I spend £25 on a takeaway?', plan);
    expect(r.changes).toEqual([{ type: 'afford', amount: 2500, note: 'takeaway' }]);
    expect(parseUtterance('can i afford twenty pounds for a haircut', plan).changes[0]).toMatchObject({ type: 'afford', amount: 2000 });
  });
  it('bill paid and savings moved', () => {
    expect(parseUtterance('I paid my phone bill', plan).changes[0]).toMatchObject({ type: 'billPaid', billId: 'bill-phone', amount: null });
    expect(parseUtterance('I moved £60 into the house deposit', plan).changes[0]).toMatchObject({ type: 'goalSaved', goalId: 'goal-house', amount: 6000 });
  });
  it('carries the verb across "and"', () => {
    const r = parseUtterance('I spent £10 on groceries and £5 on the bus', plan);
    expect(r.changes).toEqual([
      { type: 'spend', amount: 1000, category: 'groceries', note: 'groceries' },
      { type: 'spend', amount: 500, category: 'transport', note: 'bus' },
    ]);
  });
  it('bills, goals, debts in a description', () => {
    const r = parseUtterance('Rent is £220. I owe £600 on a credit card. I am saving for a holiday', plan);
    expect(r.changes[0]).toMatchObject({ type: 'addBill', name: 'Rent', amount: 22000 });
    expect(r.changes[1]).toMatchObject({ type: 'addDebt', amount: 60000 });
    expect(r.changes[2]).toMatchObject({ type: 'addGoal', name: 'Holiday' });
  });
  it('nonsense asks again', () => {
    const r = parseUtterance('hello there', plan);
    expect(r.understood).toBe(false);
    expect(r.followUp).toMatch(/didn’t catch/);
  });
});
