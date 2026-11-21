import { describe, expect, it } from 'vitest';
import { computeGame, levelFor, recordDay, xpForLevel, XP } from './game';
import { computePlan } from './calc';
import { addEntry, blankPlan, removeEntry, samplePlan } from './plan';
import { pounds } from './money';
import type { Plan } from './types';

const TODAY = '2026-11-12';
const g = (p: Plan) => computeGame(p, computePlan(p, TODAY), TODAY);
const today = (p: Plan) => ({ ...p, entries: p.entries.map((e) => ({ ...e, at: `${TODAY}T12:00` })) });

describe('game', () => {
  it('levels: 0, 100, 250, 450, 700', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 250, 450, 700]);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(levelFor(449)).toBe(3);
  });
  it('a fresh personal plan starts at level 1 with no streak', () => {
    const s = g(blankPlan(TODAY));
    expect(s.level).toBe(1);
    expect(s.xp).toBe(0);
    expect(s.streak).toBe(0);
    expect(s.quests.map((q) => q.id)).toEqual(['check', 'log', 'insight']);
  });
  it('checking in starts a streak and earns XP', () => {
    const p = recordDay(blankPlan(TODAY), 'checkIns', TODAY);
    const s = g(p);
    expect(s.streak).toBe(1);
    expect(s.quests[0].done).toBe(true);
    expect(s.xp).toBe(XP.activeDay + XP.badge); // + First look badge
    expect(recordDay(p, 'checkIns', TODAY)).toBe(p); // once per day
  });
  it('sample: streak alive but at risk until today is done', () => {
    const s = g(samplePlan(TODAY));
    expect(s.streak).toBeGreaterThan(20);
    expect(s.streakAtRisk).toBe(true);
    expect(s.activeToday).toBe(false);
  });
  it('spending more never earns more: logging XP is capped per day and ignores amounts', () => {
    let small = samplePlan(TODAY);
    small = today(addEntry(small, { kind: 'spend', amount: pounds(1), category: 'other', note: '' }));
    let big = samplePlan(TODAY);
    big = today(addEntry(big, { kind: 'spend', amount: pounds(500), category: 'other', note: '' }));
    expect(g(small).xp).toBe(g(big).xp);
    let many = samplePlan(TODAY);
    for (let i = 0; i < 6; i++) many = addEntry(many, { kind: 'spend', amount: pounds(1), category: 'other', note: '' });
    many = today(many);
    let three = samplePlan(TODAY);
    for (let i = 0; i < 3; i++) three = addEntry(three, { kind: 'spend', amount: pounds(1), category: 'other', note: '' });
    three = today(three);
    expect(g(many).xp).toBe(g(three).xp);
  });
  it('undo removes the XP it gave', () => {
    const base = samplePlan(TODAY);
    const paid = today(addEntry(base, { kind: 'billPaid', amount: pounds(30), billId: 'bill-phone' }));
    expect(g(paid).xp).toBeGreaterThan(g(base).xp);
    expect(g(removeEntry(paid, paid.entries[0].id)).xp).toBe(g(base).xp);
  });
  it('quest 3 follows the plan: a bill due soon', () => {
    const s = g(samplePlan(TODAY));
    expect(s.quests[2].id).toBe('bill');
    expect(s.quests[2].label).toBe('Mark rent paid when it goes out');
  });
  it('all quests done gives the bonus', () => {
    let p = recordDay(samplePlan(TODAY), 'checkIns', TODAY);
    p = recordDay(p, 'noSpendDays', TODAY);
    const before = g(p);
    expect(before.questsDone).toBe(2);
    p = today(addEntry(p, { kind: 'billPaid', amount: pounds(220), billId: 'bill-rent' }));
    const after = g(p);
    expect(after.questsDone).toBe(3);
    expect(after.xp - before.xp).toBe(XP.billPaid + XP.questsDone);
  });
  it('badges: some earned in the sample, some still to win', () => {
    const b = g(samplePlan(TODAY)).badges;
    expect(b.find((x) => x.id === 'saver')!.earned).toBe(true);
    expect(b.find((x) => x.id === 'debt')!.earned).toBe(false);
    expect(b.find((x) => x.id === 'insight')!.earned).toBe(false);
  });
});
