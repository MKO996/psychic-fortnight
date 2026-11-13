import { describe, expect, it } from 'vitest';
import { buildInsights, windowStats } from './insights';
import { computePlan } from './calc';
import { addEntry, samplePlan } from './plan';
import { pounds } from './money';
import type { Plan } from './types';

const TODAY = '2026-11-12';
const sample = () => samplePlan(TODAY);
const report = (p: Plan, range: 'day' | 'week' | 'month') => buildInsights(p, computePlan(p, TODAY), TODAY, range, p.profile);

describe('insights', () => {
  it('sample history does not change the money figures', () => {
    const s = computePlan(sample(), TODAY);
    expect(s.left).toBe(7000);
    expect(s.daily).toBe(1000);
  });
  it('week: counts only the last 7 days', () => {
    const st = windowStats(sample().history!, '2026-11-06', TODAY);
    expect(st.groceries).toBe(pounds(85));
    expect(st.transport).toBe(pounds(12));
    expect(st.days).toBe(7);
  });
  it('month: spots groceries above plan and repeated takeaways', () => {
    const r = report(sample(), 'month');
    const gro = r.insights.find((i) => i.id === 'groceries')!;
    expect(gro.tone).toBe('change');
    expect(gro.detail).toMatch(/about £85 a week/);
    const rep = r.insights.find((i) => i.id === 'repeat')!;
    expect(rep.title).toBe('Takeaway: £80 over 4 times');
    expect(rep.detail).toMatch(/Emergency savings/);
    expect(r.insights.find((i) => i.id === 'debt-debt-card')!.detail).toMatch(/8 monthly payments, not 12/);
  });
  it('day: compares today with the daily guide', () => {
    const added = addEntry(sample(), { kind: 'spend', amount: pounds(25), category: 'other', note: 'takeaway' });
    const p = { ...added, entries: added.entries.map((e) => ({ ...e, at: `${TODAY}T19:00` })) };
    const r = report(p, 'day');
    const i = r.insights.find((x) => x.id === 'today-pace')!;
    expect(i.tone).toBe('change');
  });
  it('shortfall is the first thing said', () => {
    const r = report({ ...sample(), cash: pounds(350) }, 'week');
    expect(r.insights[0].id).toBe('short');
    expect(r.headline).toMatch(/£50 short/);
  });
  it('focus moves matching insights up', () => {
    const p = sample();
    const saving = report({ ...p, profile: { ...p.profile!, focus: 'saving' } }, 'month');
    const debt = report({ ...p, profile: { ...p.profile!, focus: 'debt' } }, 'month');
    expect(saving.insights[0].topic).toBe('saving');
    expect(debt.insights[0].topic).toBe('debt');
  });
  it('empty history says nothing logged yet', () => {
    const r = report({ ...sample(), history: [] }, 'week');
    expect(r.headline).toMatch(/nothing logged/);
  });
});
