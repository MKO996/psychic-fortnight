/**
 * LEFT's game layer. Everything is DERIVED from what the person actually did (logs and check-ins),
 * so undo removes XP too and nothing can be farmed by spending.
 * Rule: XP rewards habits (looking, logging, paying, saving) and never the amount spent or earned.
 */
import type { Summary } from './calc';
import type { ISODate } from './dates';
import { addDays, daysBetween } from './dates';
import { money } from './money';
import type { Entry, GameLog, Plan } from './types';

export const XP = { activeDay: 10, log: 5, logsPerDayCap: 3, billPaid: 15, saved: 20, planDone: 50, badge: 25, questsDone: 30 } as const;

export const TITLES = ['Rookie', 'Tracker', 'Planner', 'Steady Hand', 'Bill Boss', 'Pot Master', 'Money Captain', 'Legend'];

/** Total XP needed to reach a level: 0, 100, 250, 450, 700, 1000… */
export function xpForLevel(n: number): number {
  return 25 * (n - 1) * (n + 2);
}

export function levelFor(xp: number): number {
  let n = 1;
  while (xpForLevel(n + 1) <= xp) n++;
  return n;
}

export interface Badge {
  id: string;
  name: string;
  how: string;
  icon: string;
  earned: boolean;
}

export interface Quest {
  id: string;
  label: string;
  xp: number;
  done: boolean;
  action?: 'checkIn' | 'noSpend' | 'plan' | 'goals' | 'insights' | 'talk';
  actionLabel?: string;
}

export interface GameState {
  xp: number;
  level: number;
  title: string;
  levelStart: number;
  nextLevelAt: number;
  streak: number;
  /** True when today isn't done yet but yesterday was: the streak is still alive. */
  streakAtRisk: boolean;
  bestStreak: number;
  badges: Badge[];
  quests: Quest[];
  questsDone: number;
  activeToday: boolean;
}

export const emptyGameLog = (): GameLog => ({ checkIns: [], noSpendDays: [], insightDays: [] });

const day = (e: Entry) => e.at.slice(0, 10);

function bestRun(days: Set<string>): number {
  const sorted = [...days].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export function computeGame(plan: Plan, s: Summary, today: ISODate): GameState {
  const log = { ...emptyGameLog(), ...(plan.game ?? {}) };
  const entries = [...(plan.history ?? []), ...plan.entries].filter((e) => e.at);
  const active = new Set<string>([...log.checkIns, ...log.noSpendDays, ...entries.map(day)]);
  active.forEach((d) => { if (d > today) active.delete(d); });

  // Streak: consecutive active days ending today (or yesterday, if today isn't done yet).
  const activeToday = active.has(today);
  let streak = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (active.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const streakAtRisk = !activeToday && streak > 0;
  const bestStreak = Math.max(streak, bestRun(active));

  // XP from habits
  let xp = active.size * XP.activeDay;
  const logsPerDay = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === 'spend' || e.kind === 'income') {
      const n = logsPerDay.get(day(e)) ?? 0;
      if (n < XP.logsPerDayCap) xp += XP.log;
      logsPerDay.set(day(e), n + 1);
    } else if (e.kind === 'billPaid' || e.kind === 'debtPaid') xp += XP.billPaid;
    else if (e.kind === 'goalSaved') xp += XP.saved;
  }
  if (plan.confirmed) xp += XP.planDone;

  const spends = entries.filter((e) => e.kind === 'spend').length;
  const goalPct = Math.max(0, ...s.derived.goals.filter((g) => g.target).map((g) => g.saved / g.target!));
  const badges: Badge[] = [
    { id: 'first', name: 'First look', how: 'Check your money once', icon: '👀', earned: active.size > 0 },
    { id: 'planner', name: 'Plan made', how: 'Finish your plan', icon: '🗺️', earned: plan.confirmed },
    { id: 'streak3', name: 'On a roll', how: 'Check in 3 days in a row', icon: '🔥', earned: bestStreak >= 3 },
    { id: 'streak7', name: 'Full week', how: 'Check in 7 days in a row', icon: '📅', earned: bestStreak >= 7 },
    { id: 'streak30', name: 'Habit hero', how: 'Check in 30 days in a row', icon: '🏆', earned: bestStreak >= 30 },
    { id: 'logger', name: 'Note taker', how: 'Log 10 spends', icon: '📝', earned: spends >= 10 },
    { id: 'bill', name: 'Bill boss', how: 'Mark a bill paid', icon: '✅', earned: entries.some((e) => e.kind === 'billPaid') },
    { id: 'saver', name: 'Pot filler', how: 'Move money to a goal', icon: '🫙', earned: entries.some((e) => e.kind === 'goalSaved') },
    { id: 'quarter', name: 'Quarter way', how: 'Get a goal 25% of the way', icon: '⭐', earned: goalPct >= 0.25 },
    { id: 'debt', name: 'Debt dent', how: 'Make an extra debt payment', icon: '🔨', earned: entries.some((e) => e.kind === 'debtPaid' && e.part === 'extra') },
    { id: 'insight', name: 'Curious mind', how: 'Read your insights', icon: '💡', earned: log.insightDays.length > 0 },
  ];
  xp += badges.filter((b) => b.earned).length * XP.badge;

  // Today's three quests
  const todays = entries.filter((e) => day(e) === today);
  const quests: Quest[] = [
    { id: 'check', label: 'Check your money', xp: XP.activeDay, done: log.checkIns.includes(today), action: 'checkIn', actionLabel: 'Checked today' },
    { id: 'log', label: 'Log today’s spending', xp: XP.log, done: todays.some((e) => e.kind === 'spend') || log.noSpendDays.includes(today), action: 'noSpend', actionLabel: 'Nothing spent today' },
  ];
  const soon = s.required.find((r) => r.kind !== 'essential' && r.reserved > 0 && r.dueDate && daysBetween(today, r.dueDate) <= 3);
  const paidToday = todays.some((e) => e.kind === 'billPaid' || e.kind === 'debtPaid');
  const goal = s.goals.find((g) => g.allocated > 0);
  const savedToday = todays.some((e) => e.kind === 'goalSaved');
  if (paidToday || (soon && s.status !== 'incomplete')) {
    quests.push({ id: 'bill', label: soon ? `Mark ${soon.name.toLowerCase()} paid when it goes out` : 'Pay a bill on time', xp: XP.billPaid, done: paidToday, action: 'plan', actionLabel: 'Go to bills' });
  } else if (savedToday || (goal && s.status === 'ok')) {
    quests.push({ id: 'save', label: goal ? `Move ${money(goal.allocated)} to ${goal.name}` : 'Move money to a goal', xp: XP.saved, done: savedToday, action: 'goals', actionLabel: 'Go to goals' });
  } else {
    quests.push({ id: 'insight', label: 'Read your insights', xp: XP.activeDay, done: log.insightDays.includes(today), action: 'insights', actionLabel: 'Open insights' });
  }
  const questsDone = quests.filter((q) => q.done).length;
  // Bonus for finishing all three, on each day it happened (today counted live).
  if (questsDone === quests.length) xp += XP.questsDone;

  const level = levelFor(xp);
  return {
    xp, level, title: TITLES[Math.min(level, TITLES.length) - 1],
    levelStart: xpForLevel(level), nextLevelAt: xpForLevel(level + 1),
    streak, streakAtRisk, bestStreak, badges, quests, questsDone, activeToday,
  };
}

export function recordDay(plan: Plan, key: keyof GameLog, today: ISODate): Plan {
  const log = { ...emptyGameLog(), ...(plan.game ?? {}) };
  if (log[key].includes(today)) return plan;
  return { ...plan, game: { ...log, [key]: [...log[key], today].slice(-200) } };
}
