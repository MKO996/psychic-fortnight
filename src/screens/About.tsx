import { useState } from 'react';
import { useApp } from '../app-context';
import { defaultProfile } from '../plan';
import { TextField } from '../ui';
import type { Focus, Profile } from '../types';

export const FOCUS_OPTIONS: { value: Focus; label: string; hint: string }[] = [
  { value: 'runningOut', label: 'Not running out before payday', hint: 'Daily pace comes first' },
  { value: 'bills', label: 'Paying bills on time', hint: 'Due dates come first' },
  { value: 'debt', label: 'Clearing debt', hint: 'Debt payments come first' },
  { value: 'saving', label: 'Saving more', hint: 'Goals come first' },
  { value: 'whereItGoes', label: 'Seeing where it goes', hint: 'Spending patterns come first' },
];
const HOUSEHOLD: { value: NonNullable<Profile['household']>; label: string }[] = [
  { value: 'alone', label: 'Just me' },
  { value: 'partner', label: 'With a partner' },
  { value: 'children', label: 'With children' },
  { value: 'sharing', label: 'Sharing a home' },
];
export const SPEND_SUGGESTIONS = ['Takeaway', 'Coffee', 'Eating out', 'Clothes', 'Going out', 'Kids', 'Pets', 'Gifts', 'Games', 'Subscriptions'];

/** Tap-to-choose questions about the person. All optional. */
export default function About({ back }: { back?: 'insights' | 'settings' }) {
  const { plan, update, go } = useApp();
  const p = { ...defaultProfile, ...(plan.profile ?? {}) };
  const set = (patch: Partial<Profile>) => update((x) => ({ ...x, profile: { ...defaultProfile, ...(x.profile ?? {}), ...patch } }));
  const [custom, setCustom] = useState('');
  const toggleSpend = (v: string) => set({ spendsOn: p.spendsOn.includes(v) ? p.spendsOn.filter((x) => x !== v) : [...p.spendsOn, v] });
  return (
    <div className="screen about">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: back ?? 'settings' })}>‹ Back</button>
        <h1 tabIndex={-1}>About you</h1>
      </div>
      <p className="lead">Tap what fits. Everything here is optional and stays on this phone.</p>

      <TextField label="What should LEFT call you? (optional)" value={p.name} onChange={(name) => set({ name })} />

      <ChipGroup legend="What matters most right now?" single options={FOCUS_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint }))} selected={p.focus ? [p.focus] : []} onToggle={(v) => set({ focus: p.focus === v ? null : (v as Focus) })} />
      <ChipGroup legend="Who do you live with?" single options={HOUSEHOLD} selected={p.household ? [p.household] : []} onToggle={(v) => set({ household: p.household === v ? null : (v as Profile['household']) })} />
      <ChipGroup legend="What do you often spend on?" hint="These become one-tap buttons in Quick add, and insights watch them." options={[...new Set([...SPEND_SUGGESTIONS, ...p.spendsOn])].map((x) => ({ value: x, label: x }))} selected={p.spendsOn} onToggle={toggleSpend} />
      <div className="row-wrap">
        <div className="grow"><TextField label="Add your own" value={custom} placeholder="e.g. Petrol station snacks" onChange={setCustom} /></div>
        <button type="button" className="btn secondary" disabled={!custom.trim()} onClick={() => { const v = custom.trim(); if (!p.spendsOn.includes(v)) set({ spendsOn: [...p.spendsOn, v] }); setCustom(''); }}>Add</button>
      </div>
      <ChipGroup legend="How much detail do you like?" single options={[{ value: 'simple', label: 'Short and simple', hint: 'Top 3 insights' }, { value: 'detailed', label: 'All the detail', hint: 'Every insight, with the numbers' }]} selected={[p.detail]} onToggle={(v) => set({ detail: v as Profile['detail'] })} />

      <button type="button" className="btn primary xl" onClick={() => go({ name: back ?? 'settings' })}>Done</button>
    </div>
  );
}

export function ChipGroup({ legend, hint, options, selected, onToggle, single }: { legend: string; hint?: string; options: { value: string; label: string; hint?: string }[]; selected: string[]; onToggle: (v: string) => void; single?: boolean }) {
  return (
    <fieldset className="chip-group">
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="chip-wrap" role={single ? 'radiogroup' : 'group'} aria-label={legend}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button key={o.value} type="button" role={single ? 'radio' : undefined} aria-checked={single ? on : undefined} aria-pressed={single ? undefined : on} className={`chip select ${on ? 'on' : ''}`} onClick={() => onToggle(o.value)}>
              {on && <span aria-hidden="true">✓ </span>}{o.label}
              {o.hint && <small>{o.hint}</small>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
