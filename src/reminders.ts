/**
 * Money check-in reminders. Pure logic: no timers, no network.
 * After the last check-in LEFT shows day 1, day 3 and day 7 reminders, each once,
 * then pauses until the next check-in. Reminder text never contains money figures.
 */
import type { ISODate } from './dates';
import { addDays, daysBetween, toISO } from './dates';

export type Stage = 1 | 3 | 7;
export type Tone = 'gentle' | 'cheeky';
export const STAGES: Stage[] = [1, 3, 7];

export interface ReminderState {
  enabled: boolean;
  time: string; // "HH:MM", local time
  tone: Tone;
  lastCheckIn: ISODate | null;
  shown: Stage[]; // stages already shown since the last check-in
  snoozedUntil: string | null; // local "YYYY-MM-DDTHH:MM"
}

export const defaultReminders: ReminderState = { enabled: false, time: '18:00', tone: 'cheeky', lastCheckIn: null, shown: [], snoozedUntil: null };

function stamp(now: Date): string {
  return `${toISO(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Which reminder is due now, if any. Skipped earlier stages are never shown late. */
export function dueStage(s: ReminderState, now: Date): Stage | null {
  if (!s.enabled || !s.lastCheckIn) return null;
  if (s.snoozedUntil && stamp(now) < s.snoozedUntil) return null;
  const days = daysBetween(s.lastCheckIn, toISO(now));
  const pastTime = now.getHours() * 60 + now.getMinutes() >= minutes(s.time);
  const eligible = [...STAGES].reverse().find((d) => days > d || (days === d && pastTime));
  if (!eligible || s.shown.includes(eligible)) return null;
  if (s.shown.some((x) => x > eligible)) return null;
  return eligible;
}

/** Record that a stage was shown (and that any earlier, missed stages are skipped). */
export function markShown(s: ReminderState, stage: Stage): ReminderState {
  return { ...s, shown: STAGES.filter((d) => d <= stage || s.shown.includes(d)), snoozedUntil: null };
}

/** Paused after day 7 until the next check-in. */
export function isPaused(s: ReminderState): boolean {
  return s.shown.includes(7);
}

export function checkIn(s: ReminderState, now: Date): ReminderState {
  return { ...s, lastCheckIn: toISO(now), shown: [], snoozedUntil: null };
}

/** Bring this stage back tomorrow at the reminder time. */
export function snooze(s: ReminderState, stage: Stage, now: Date): ReminderState {
  return { ...s, shown: s.shown.filter((d) => d !== stage), snoozedUntil: `${addDays(toISO(now), 1)}T${s.time}` };
}

export function enable(s: ReminderState, now: Date): ReminderState {
  return { ...s, enabled: true, lastCheckIn: s.lastCheckIn ?? toISO(now), shown: [], snoozedUntil: null };
}

export function turnOff(s: ReminderState): ReminderState {
  return { ...s, enabled: false, snoozedUntil: null };
}

export type Mood = 'wave' | 'offended' | 'sigh' | 'celebrate' | 'idle';

export interface ReminderCopy {
  mood: Mood;
  title: string;
  body: string;
  moodLabel: string; // describes the coin for screen readers and reduced motion
  subject: string; // email subject
  emailBody: string;
}

/** Jokes are about the coin being left waiting — never about the person's money. No figures. */
export function reminderCopy(stage: Stage, tone: Tone): ReminderCopy {
  if (stage === 1) {
    return tone === 'cheeky'
      ? { mood: 'wave', moodLabel: 'The coin waves at you', title: 'Ten seconds for your money?', body: 'I’m waving. Quite hard, actually. Come and see what’s left until payday.', subject: 'Ten seconds for your money?', emailBody: 'Your LEFT coin is waving at you. Quite hard, actually. Open LEFT to see what’s left until payday.' }
      : { mood: 'wave', moodLabel: 'The coin waves at you', title: 'Ten seconds for your money?', body: 'When you have a moment, see what’s left until payday.', subject: 'Ten seconds for your money?', emailBody: 'When you have a moment, open LEFT to see what’s left until payday.' };
  }
  if (stage === 3) {
    return tone === 'cheeky'
      ? { mood: 'offended', moodLabel: 'The coin looks offended, arms folded', title: 'Your money pots held a meeting.', body: 'I was the only one who showed up.', subject: 'Your money pots held a meeting', emailBody: 'Your money pots held a meeting. The coin was the only one who showed up. It’s fine. It’s totally fine.' }
      : { mood: 'offended', moodLabel: 'The coin looks a little left out', title: 'Your money pots held a meeting.', body: 'We saved you a seat. Pop in when you’re ready.', subject: 'Your money pots held a meeting', emailBody: 'Your money pots held a meeting and saved you a seat. Pop into LEFT when you’re ready.' };
  }
  return tone === 'cheeky'
    ? { mood: 'sigh', moodLabel: 'The coin sighs and sits down', title: 'Fine. I’ll stop being dramatic.', body: 'Your plan will be here when you’re ready.', subject: 'Fine. I’ll stop being dramatic.', emailBody: 'The coin has sat down and stopped being dramatic. Your plan will be here when you’re ready. This is the last reminder until you check in.' }
    : { mood: 'sigh', moodLabel: 'The coin settles down quietly', title: 'I’ll stop reminding you for now.', body: 'Your plan will be here when you’re ready.', subject: 'Your plan will be here when you’re ready', emailBody: 'LEFT will stop reminding you for now. Your plan will be here when you’re ready. This is the last reminder until you check in.' };
}
