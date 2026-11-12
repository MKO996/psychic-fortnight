import type { Plan } from './types';

const KEYS = { sample: 'left.sample.v1', personal: 'left.personal.v1', settings: 'left.settings.v1', active: 'left.active.v1' } as const;

export interface Settings {
  largeText: boolean;
  reduceMotion: boolean;
  celebrations: boolean;
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
    return { largeText: false, reduceMotion: prefersReduced, celebrations: true, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
  },
  saveSettings: (s: Settings) => write(KEYS.settings, s),
};
