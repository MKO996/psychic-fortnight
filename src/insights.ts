/**
 * LEFT insights: plain-English observations from the person's own logs and plan.
 * Rule-based and on-device: no network, no AI service, every insight explains its numbers.
 */
import type { Summary } from './calc';
import { monthsToClear } from './calc';
import type { ISODate } from './dates';
import { addDays, daysBetween, shortDate } from './dates';
import { money, type Pence } from './money';
import type { Entry, Focus, Plan, Profile } from './types';

export type Range = 'day' | 'week' | 'month';
export const RANGE_DAYS: Record<Range, number> = { day: 1, week: 7, month: 30 };
export const RANGE_LABEL: Record<Range, string> = { day: 'Today', week: 'This week', month: 'This month' };

export interface Insight {
  id: string;
  tone: 'keep' | 'change' | 'watch';
  topic: Focus;
  title: string;
  detail: string;
  why: string;
  action?: { label: string; to: 'plan' | 'goals' | 'groceries' | 'talk' };
  weight: number;
}

export interface WindowStats {
  from: ISODate;
  to: ISODate;
  days: number;
  spent: Pence;
  groceries: Pence;
  transport: Pence;
  other: Pence;
  income: Pence;
  saved: Pence;
  billsPaid: Pence;
  daysLogged: number;
  entries: Entry[];
}

export interface InsightReport {
  range: Range;
  stats: WindowStats;
  previous: WindowStats;
  headline: string;
  insights: Insight[];
}

const dateOf = (e: Entry) => e.at.slice(0, 10);

export function windowStats(entries: Entry[], from: ISODate, to: ISODate): WindowStats {
  const inWin = entries.filter((e) => e.at && dateOf(e) >= from && dateOf(e) <= to);
  const s: WindowStats = { from, to, days: daysBetween(from, to) + 1, spent: 0, groceries: 0, transport: 0, other: 0, income: 0, saved: 0, billsPaid: 0, daysLogged: new Set(inWin.map(dateOf)).size, entries: inWin };
  for (const e of inWin) {
    if (e.kind === 'spend') {
      s.spent += e.amount;
      if (e.category === 'groceries') s.groceries += e.amount;
      else if (e.category === 'transport') s.transport += e.amount;
      else s.other += e.amount;
    } else if (e.kind === 'income') s.income += e.amount;
    else if (e.kind === 'goalSaved') s.saved += e.amount;
    else if (e.kind === 'billPaid' || e.kind === 'debtPaid') s.billsPaid += e.amount;
  }
  return s;
}

function periodLength(plan: Plan): number {
  return plan.frequency === 'fortnightly' ? 14 : plan.frequency === 'monthly' ? 30 : 7;
}

function noteKey(note: string): string {
  return note.trim().toLowerCase().replace(/^(a|an|the|my|some)\s+/, '').replace(/s$/, '');
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildInsights(plan: Plan, s: Summary, today: ISODate, range: Range, profile?: Profile): InsightReport {
  const all = [...(plan.history ?? []), ...plan.entries];
  const n = RANGE_DAYS[range];
  const from = addDays(today, -(n - 1));
  const stats = windowStats(all, from, today);
  const previous = windowStats(all, addDays(from, -n), addDays(from, -1));
  const out: Insight[] = [];
  const word = range === 'day' ? 'today' : range === 'week' ? 'in the last 7 days' : 'in the last 30 days';
  const span = `${shortDate(from)} to ${shortDate(today)}`;

  // Coming up: shortfall, overdue, due soon
  if (s.status === 'short') {
    out.push({ id: 'short', tone: 'watch', topic: 'bills', weight: 100, title: `You’re ${money(s.shortfall)} short for bills and essentials`, detail: `${s.nearestDue ? `Your ${s.nearestDue.name.toLowerCase()} is due first${s.nearestDue.dueDate ? `, on ${shortDate(s.nearestDue.dueDate)}` : ''}. ` : ''}New savings and extra debt payments are paused until there’s room.`, why: `${money(s.cash)} now, ${money(s.requiredTotal)} needed before payday.`, action: { label: 'See bills', to: 'plan' } });
  }
  for (const r of s.required.filter((x) => x.overdue)) {
    out.push({ id: `overdue-${r.id}`, tone: 'watch', topic: 'bills', weight: 95, title: `${r.name} looks overdue`, detail: `It was due ${shortDate(r.dueDate!)}. If you’ve paid it, mark it paid so your figures stay right.`, why: `${money(r.reserved)} still unpaid in your plan.`, action: { label: 'Go to bills', to: 'plan' } });
  }
  if (s.status === 'ok') {
    for (const r of s.required.filter((x) => x.kind !== 'essential' && x.reserved > 0 && x.dueDate && !x.overdue && daysBetween(today, x.dueDate) <= 3)) {
      out.push({ id: `soon-${r.id}`, tone: 'watch', topic: 'bills', weight: 60, title: `${r.name}: ${money(r.reserved)} due ${shortDate(r.dueDate!)}`, detail: 'It’s already set aside. Mark it paid once it goes out.', why: `Due in ${daysBetween(today, r.dueDate!)} day${daysBetween(today, r.dueDate!) === 1 ? '' : 's'}.`, action: { label: 'Go to bills', to: 'plan' } });
    }
  }

  // Everyday spending pace
  if (s.status === 'ok' && s.daily > 0) {
    if (range === 'day') {
      const t = stats.other;
      out.push(t <= s.daily
        ? { id: 'today-pace', tone: 'keep', topic: 'runningOut', weight: 50, title: `${money(t, { pennies: t % 100 !== 0 })} of everyday spending today`, detail: `That’s within today’s ${money(s.daily, { pennies: true })}.`, why: 'Everyday spending means things outside groceries, transport and bills.' }
        : { id: 'today-pace', tone: 'change', topic: 'runningOut', weight: 70, title: `${money(t - s.daily)} over today’s guide`, detail: 'That’s fine once in a while. The rest of the days until payday get a little less.', why: `Spent ${money(t)} today; today’s guide was ${money(s.daily, { pennies: true })}.` });
    } else if (stats.other > 0) {
      const avg = Math.round(stats.other / stats.days);
      out.push(avg <= s.daily
        ? { id: 'pace', tone: 'keep', topic: 'runningOut', weight: 45, title: `Everyday spending: about ${money(avg, { pennies: true })} a day`, detail: `That fits inside your current guide of ${money(s.daily, { pennies: true })} a day.`, why: `${money(stats.other)} of everyday spending ${word}.` }
        : { id: 'pace', tone: 'change', topic: 'runningOut', weight: 65, title: `Everyday spending: about ${money(avg, { pennies: true })} a day`, detail: `Your guide is ${money(s.daily, { pennies: true })} a day. About ${money(avg - s.daily, { pennies: true })} less a day would match it.`, why: `${money(stats.other)} of everyday spending ${word}.` });
    }
  }

  // Groceries: does the plan match real life?
  const gro = plan.essentials.find((e) => e.id === 'groceries');
  if (range !== 'day' && gro?.budget && stats.groceries > 0) {
    // Average over the days the logs actually cover, not empty days before the first entry.
    const first = stats.entries.reduce((m, e) => (dateOf(e) < m ? dateOf(e) : m), today);
    const covered = Math.min(stats.days, daysBetween(first, today) + 1);
    const weekly = Math.round((stats.groceries * 7) / covered / 100) * 100;
    const planWeekly = Math.round((gro.budget * 7) / periodLength(plan));
    const perPay = Math.round((stats.groceries * periodLength(plan)) / covered / 100) * 100;
    if (weekly > planWeekly * 1.05) {
      out.push({ id: 'groceries', tone: 'change', topic: 'whereItGoes', weight: 55, title: 'Groceries usually cost more than your plan', detail: `You spend about ${money(weekly)} a week. Your plan allows ${money(planWeekly)}. Setting groceries to ${money(perPay)} would make today’s figure more honest.`, why: `${money(stats.groceries)} on groceries, ${span}.`, action: { label: 'Change groceries', to: 'groceries' } });
    } else if (weekly < planWeekly * 0.9) {
      out.push({ id: 'groceries', tone: 'keep', topic: 'whereItGoes', weight: 35, title: 'Groceries came in under plan', detail: `About ${money(weekly)} a week against ${money(planWeekly)} planned. Whatever you’re doing, it’s working.`, why: `${money(stats.groceries)} on groceries, ${span}.` });
    } else {
      out.push({ id: 'groceries', tone: 'keep', topic: 'whereItGoes', weight: 30, title: 'Groceries match your plan', detail: `About ${money(weekly)} a week, close to the ${money(planWeekly)} you planned.`, why: `${money(stats.groceries)} on groceries, ${span}.` });
    }
  }

  // Repeated everyday spends ("takeaway" four times)
  if (range !== 'day') {
    const groups = new Map<string, { total: Pence; count: number; label: string }>();
    for (const e of stats.entries) {
      if (e.kind !== 'spend' || e.category !== 'other' || !e.note) continue;
      const k = noteKey(e.note);
      const g = groups.get(k) ?? { total: 0, count: 0, label: cap(e.note.trim()) };
      g.total += e.amount;
      g.count += 1;
      groups.set(k, g);
    }
    const top = [...groups.values()].filter((g) => g.count >= (range === 'week' ? 2 : 3)).sort((a, b) => b.total - a.total)[0];
    if (top) {
      const each = Math.round(top.total / top.count);
      const goal = [...plan.goals].sort((a, b) => a.priority - b.priority)[0];
      const watched = profile?.spendsOn.some((x) => noteKey(x) === noteKey(top.label));
      out.push({ id: 'repeat', tone: 'change', topic: 'whereItGoes', weight: watched ? 58 : 48, title: `${top.label}: ${money(top.total)} over ${top.count} times`, detail: `That’s about ${money(each)} each time. Skipping one would free ${money(each)}${goal ? ` for ${goal.name}` : ''}. No need to stop: just choose when it’s worth it.`, why: `Everyday spends you noted as “${top.label.toLowerCase()}”, ${span}.` });
    }
  }

  // Compared with the previous week or month
  if (range !== 'day' && previous.spent > 0 && stats.spent > 0) {
    const diff = stats.spent - previous.spent;
    const what = range === 'week' ? 'the week before' : 'the month before';
    if (diff <= 0) {
      out.push({ id: 'compare', tone: 'keep', topic: 'runningOut', weight: 40, title: `${money(-diff)} less spent than ${what}`, detail: `${money(stats.spent)} this time against ${money(previous.spent)}.`, why: `All logged spending, ${span} compared with the same number of days before.` });
    } else if (diff > previous.spent * 0.1) {
      const cats: [string, number][] = [['groceries', stats.groceries - previous.groceries], ['transport', stats.transport - previous.transport], ['everyday spending', stats.other - previous.other]];
      const most = cats.sort((a, b) => b[1] - a[1])[0];
      out.push({ id: 'compare', tone: 'change', topic: 'runningOut', weight: 52, title: `${money(diff)} more spent than ${what}`, detail: `Most of the rise was ${most[0]} (+${money(most[1])}).`, why: `${money(stats.spent)} this time against ${money(previous.spent)}.` });
    }
  }

  // Savings
  if (plan.goals.length && range !== 'day') {
    const lead = [...s.derived.goals].sort((a, b) => a.priority - b.priority).find((g) => g.target);
    const progress = lead && lead.target ? ` ${lead.name}: ${money(lead.saved)} of ${money(lead.target)} (${Math.floor((lead.saved / lead.target) * 100)}%).` : '';
    if (stats.saved > 0) {
      out.push({ id: 'saved', tone: 'keep', topic: 'saving', weight: 42, title: `You moved ${money(stats.saved)} to savings`, detail: `Steady saving adds up.${progress}`, why: `Savings you marked as moved, ${span}.`, action: { label: 'See goals', to: 'goals' } });
    } else if (s.goalTotal > 0) {
      out.push({ id: 'saved', tone: 'change', topic: 'saving', weight: 50, title: `No money moved to savings ${word}`, detail: `${money(s.goalTotal)} is set aside for savings this pay. Move it when you can, then mark it saved.`, why: 'No savings transfers logged in this time.', action: { label: 'See goals', to: 'goals' } });
    }
    for (const g of s.derived.goals.filter((x) => x.deadline && x.target && x.saved < x.target)) {
      const weeks = Math.max(1, Math.ceil(daysBetween(today, g.deadline!) / 7));
      const perWeek = Math.ceil((g.target! - g.saved) / weeks / 100) * 100;
      const planned = Math.round((g.contribution * 7) / periodLength(plan));
      out.push(planned >= perWeek
        ? { id: `deadline-${g.id}`, tone: 'keep', topic: 'saving', weight: 38, title: `${g.name} is on track for ${shortDate(g.deadline!)}`, detail: `You need about ${money(perWeek)} a week and you’re planning ${money(planned)}.`, why: `${money(g.target! - g.saved)} still needed, ${weeks} weeks left.` }
        : { id: `deadline-${g.id}`, tone: 'change', topic: 'saving', weight: 56, title: `${g.name} needs about ${money(perWeek)} a week`, detail: `You’re planning ${money(planned)} a week. Raise it, or move the date to make it easier.`, why: `${money(g.target! - g.saved)} still needed, ${weeks} weeks left.`, action: { label: 'See goals', to: 'goals' } });
    }
  }

  // Debt: 0% comparison
  for (const t of s.derived.debts) {
    if (range === 'day' || t.balance === null || !t.minimum || t.extraRequested <= 0) continue;
    const a = monthsToClear(t.balance, t.minimum, t.interest, t.fees);
    const b = monthsToClear(t.balance, t.minimum + t.extraRequested, t.interest, t.fees);
    if (a && b && a > b) {
      out.push({ id: `debt-${t.id}`, tone: 'keep', topic: 'debt', weight: 40, title: `Your extra ${money(t.extraRequested)} on ${t.name} helps`, detail: `Paying ${money(t.minimum + t.extraRequested)} a month instead of ${money(t.minimum)} clears it in about ${b} monthly payments, not ${a}. That’s an estimate at 0% with no fees.`, why: `${money(t.balance)} balance, same amount paid each month.`, action: { label: 'Compare payments', to: 'goals' } });
    }
  }

  // Income
  if (range !== 'day' && stats.income > 0) {
    const notes = stats.entries.filter((e) => e.kind === 'income').map((e) => (e as { note: string }).note).filter(Boolean);
    out.push({ id: 'income', tone: 'keep', topic: 'runningOut', weight: 25, title: `${money(stats.income)} arrived ${word}`, detail: notes.length ? `From: ${[...new Set(notes)].join(', ')}.` : 'Counted once, when you recorded it.', why: `Income you recorded as received, ${span}.` });
  }

  // Logging habit
  if (range !== 'day') {
    const ratio = stats.daysLogged / stats.days;
    out.push(ratio >= 0.4
      ? { id: 'habit', tone: 'keep', topic: 'whereItGoes', weight: 20, title: `You logged money on ${stats.daysLogged} of ${stats.days} days`, detail: 'Regular logging keeps your figures right and these insights sharp.', why: 'Days with at least one entry.' }
      : { id: 'habit', tone: 'change', topic: 'whereItGoes', weight: 44, title: `You logged money on ${stats.daysLogged} of ${stats.days} days`, detail: 'Logging after each shop takes about ten seconds and makes these insights more accurate.', why: 'Days with at least one entry.', action: { label: 'Log something', to: 'talk' } });
  }

  const focus = profile?.focus;
  for (const i of out) if (focus && i.topic === focus) i.weight += 30;
  out.sort((a, b) => b.weight - a.weight);

  return { range, stats, previous, headline: headline(range, s, stats, profile), insights: out };
}

function headline(range: Range, s: Summary, st: WindowStats, profile?: Profile): string {
  const hi = profile?.name ? `${profile.name}, ` : '';
  if (s.status === 'short') return `${cap(hi)}bills come first right now: you’re ${money(s.shortfall)} short.`;
  if (s.status === 'incomplete') return 'Finish your plan to get the full picture.';
  if (range === 'day') return `${cap(hi)}you have ${money(s.daily, { pennies: true })} to spend today and ${money(s.left)} until ${s.endKind === 'review' ? 'your review date' : 'payday'}.`;
  if (st.spent === 0 && st.entries.length === 0) return `${cap(hi)}nothing logged ${range === 'week' ? 'this week' : 'this month'} yet.`;
  return `${cap(hi)}you spent ${money(st.spent)} ${range === 'week' ? 'in the last 7 days' : 'in the last 30 days'}: groceries ${money(st.groceries)}, transport ${money(st.transport)}, everything else ${money(st.other)}.`;
}
