import { describe, expect, it } from 'vitest';
import { checkIn, defaultReminders, dueStage, enable, isPaused, markShown, reminderCopy, snooze, turnOff, STAGES, type ReminderState } from './reminders';

const at = (date: string, time = '19:00') => new Date(`${date}T${time}:00`);
const on = (): ReminderState => enable({ ...defaultReminders, time: '18:00' }, at('2026-11-12', '09:00'));

describe('reminder sequence', () => {
  it('is off until opted in', () => {
    expect(dueStage(defaultReminders, at('2026-11-20'))).toBeNull();
  });
  it('day 1 at the chosen time, not before', () => {
    const s = on();
    expect(dueStage(s, at('2026-11-12'))).toBeNull();
    expect(dueStage(s, at('2026-11-13', '17:59'))).toBeNull();
    expect(dueStage(s, at('2026-11-13', '18:00'))).toBe(1);
  });
  it('shows each stage once, then day 3, then day 7, then pauses', () => {
    let s = on();
    s = markShown(s, dueStage(s, at('2026-11-13'))!);
    expect(dueStage(s, at('2026-11-14'))).toBeNull();
    expect(dueStage(s, at('2026-11-15'))).toBe(3);
    s = markShown(s, 3);
    expect(dueStage(s, at('2026-11-18'))).toBeNull();
    expect(dueStage(s, at('2026-11-19'))).toBe(7);
    s = markShown(s, 7);
    expect(isPaused(s)).toBe(true);
    expect(dueStage(s, at('2027-01-30'))).toBeNull();
  });
  it('skips missed stages instead of showing them late', () => {
    const s = on();
    expect(dueStage(s, at('2026-11-17'))).toBe(3);
    const after = markShown(s, 3);
    expect(after.shown).toEqual([1, 3]);
    expect(dueStage(after, at('2026-11-17'))).toBeNull();
  });
  it('check-in resets the sequence', () => {
    let s = markShown(markShown(on(), 1), 3);
    s = checkIn(s, at('2026-11-16'));
    expect(s.shown).toEqual([]);
    expect(dueStage(s, at('2026-11-16', '23:00'))).toBeNull();
    expect(dueStage(s, at('2026-11-17'))).toBe(1);
  });
  it('snooze brings the same stage back tomorrow at the reminder time', () => {
    let s = markShown(on(), 1);
    s = snooze(s, 1, at('2026-11-13', '18:05'));
    expect(dueStage(s, at('2026-11-13', '23:00'))).toBeNull();
    expect(dueStage(s, at('2026-11-14', '17:00'))).toBeNull();
    expect(dueStage(s, at('2026-11-14', '18:00'))).toBe(1);
  });
  it('turn off stops reminders', () => {
    expect(dueStage(turnOff(on()), at('2026-11-20'))).toBeNull();
  });
  it('copy has no money figures, in either tone', () => {
    for (const st of STAGES) for (const tone of ['gentle', 'cheeky'] as const) {
      const c = reminderCopy(st, tone);
      expect(`${c.title} ${c.body} ${c.subject} ${c.emailBody}`).not.toMatch(/£|\d/);
    }
    expect(reminderCopy(3, 'cheeky').body).toBe('I was the only one who showed up.');
    expect(reminderCopy(7, 'cheeky').title).toBe('Fine. I’ll stop being dramatic.');
  });
});
