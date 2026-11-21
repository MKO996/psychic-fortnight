import { createContext, useContext } from 'react';
import type { Plan } from './types';
import type { Summary } from './calc';
import type { Settings } from './store';
import type { ISODate } from './dates';
import type { ReminderState, Stage, Tone } from './reminders';
import type { GameState } from './game';

export type Screen =
  | { name: 'welcome' }
  | { name: 'today' }
  | { name: 'plan' }
  | { name: 'goals' }
  | { name: 'talk'; text?: string }
  | { name: 'setup'; step?: string; editOnly?: boolean }
  | { name: 'settings' }
  | { name: 'split' }
  | { name: 'newPeriod' }
  | { name: 'remindersDemo' }
  | { name: 'insights' }
  | { name: 'trophies' }
  | { name: 'about'; back?: 'insights' | 'settings' };

export interface AppCtx {
  today: ISODate;
  kind: 'sample' | 'personal';
  plan: Plan;
  summary: Summary;
  hasPersonal: boolean;
  /** Change the active plan. `message` shows a short confirmation with Undo. */
  update: (fn: (p: Plan) => Plan, message?: string) => void;
  go: (s: Screen) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  celebrate: (msg: string) => void;
  potsKey: number;
  fillPots: () => void;
  openSample: () => void;
  openPersonal: () => void;
  resetSample: () => void;
  clearPersonal: () => void;
  reminders: ReminderState;
  setReminders: (fn: (r: ReminderState) => ReminderState) => void;
  /** Reminder waiting on Today (real, or simulated in the sample). */
  pendingReminder: { stage: Stage; tone: Tone; demo: boolean; opened: boolean } | null;
  openReminder: () => void;
  snoozeReminder: () => void;
  turnOffReminder: () => void;
  simulateReminder: (stage: Stage, tone: Tone) => void;
  checkedInToday: boolean;
  checkInNow: () => void;
  game: GameState;
  recordInsightView: () => void;
  markNoSpend: () => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('no app context');
  return c;
}
