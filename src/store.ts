import type { Plan } from './types';
import { defaultReminders, type ReminderState } from './reminders';

const KEYS = { sample: 'left.sample.v1', personal: 'left.personal.v1', settings: 'left.settings.v1', active: 'left.active.v1', reminders: 'left.reminders.v1' } as const;

export interface Settings {
  largeText: boolean;
  reduceMotion: boolean;
  celebrations: boolean;
  /** A/B test: 'plain' = Version A (Bills & essentials first), 'game' = Version B (Shield first). */
  statNames: 'plain' | 'game';
  theme: 'light' | 'dark' | 'system';
}

/** ?v=a or ?v=b in the address sets the test version, so a facilitator can share one link per version. */
function versionFromUrl(): Settings['statNames'] | null {
  try {
    const params = new URLSearchParams(location.search);
    const v = params.get('v')?.toLowerCase();
    if (!v) return null;
    // Apply once, then tidy the address so a later change in Settings isn't overridden on refresh.
    params.delete('v');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
    return v === 'a' ? 'plain' : v === 'b' ? 'game' : null;
  } catch {
    return null;
  }
}

function read<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be blocked; the app still works for this visit */
  }
}

export const store = {
  loadPlan: (kind: 'sample' | 'personal') => {
    const p = read<Plan>(KEYS[kind]);
    return p && p.version === 1 ? p : null;
  },
  savePlan: (kind: 'sample' | 'personal', p: Plan | null) => write(KEYS[kind], p),
  loadActive: () => read<'sample' | 'personal'>(KEYS.active),
  saveActive: (a: 'sample' | 'personal' | null) => write(KEYS.active, a),
  loadSettings: (): Settings => {
    const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saved = { largeText: false, reduceMotion: prefersReduced, celebrations: true, statNames: 'plain' as const, theme: 'light' as const, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
    const fromUrl = versionFromUrl();
    return fromUrl ? { ...saved, statNames: fromUrl } : saved;
  },
  saveSettings: (s: Settings) => write(KEYS.settings, s),
  loadReminders: (): ReminderState => ({ ...defaultReminders, ...(read<Partial<ReminderState>>(KEYS.reminders) ?? {}) }),
  saveReminders: (r: ReminderState) => write(KEYS.reminders, r),
};
