import { useState } from 'react';
import { useApp } from '../app-context';
import { Choice, Modal, Toggle } from '../ui';
import { enable, isPaused, turnOff } from '../reminders';
import { addDays, todayISO } from '../dates';

export default function SettingsScreen() {
  const { settings, setSettings, go, kind, resetSample, clearPersonal, hasPersonal, openSample, openPersonal, reminders: r, setReminders } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  return (
    <div className="screen settings">
      <div className="screen-head">
        <button type="button" className="btn back" onClick={() => go({ name: 'today' })}>‹ Back</button>
        <h1 tabIndex={-1}>Settings</h1>
      </div>
      <section className="card">
        <h2>Display</h2>
        <Toggle label="Large text" checked={settings.largeText} onChange={(b) => setSettings({ ...settings, largeText: b })} />
        <Toggle label="Reduce motion" hint="Pots and bars appear without moving." checked={settings.reduceMotion} onChange={(b) => setSettings({ ...settings, reduceMotion: b })} />
        <Toggle label="Celebrations" hint="A short message when you pay a bill or save." checked={settings.celebrations} onChange={(b) => setSettings({ ...settings, celebrations: b })} />
      </section>
      <section className="card">
        <h2>About you</h2>
        <p className="hint">What matters most, who you live with and what you often spend on. Used to order your insights and fill Quick add.</p>
        <button type="button" className="btn secondary" onClick={() => go({ name: 'about', back: 'settings' })}>Edit about you</button>
      </section>
      <section className="card" aria-labelledby="rem-h">
        <h2 id="rem-h">Money check-in reminders</h2>
        <p className="hint">If you haven’t checked in, the LEFT coin reminds you on day 1, 3 and 7, then stops until your next check-in. Reminders appear when you open LEFT. Your figures never appear in a reminder.</p>
        <Toggle label="Remind me to check my money" checked={r.enabled} onChange={(b) => setReminders((x) => (b ? enable(x, new Date()) : turnOff(x)))} />
        {r.enabled && (
          <>
            <div className="field">
              <label htmlFor="rem-time">Reminder time</label>
              <input id="rem-time" type="time" value={r.time} onChange={(e) => e.target.value && setReminders((x) => ({ ...x, time: e.target.value }))} />
            </div>
            <Choice legend="Reminder style" value={r.tone} onChange={(tone) => setReminders((x) => ({ ...x, tone }))} options={[{ value: 'gentle', label: 'Gentle' }, { value: 'cheeky', label: 'Cheeky', hint: 'A little playful guilt from the coin' }]} />
            {isPaused(r) && <p className="notice">Reminders are paused after day 7. Check in to start again.</p>}
            {r.snoozedUntil && <p className="hint">Snoozed until {r.snoozedUntil.replace('T', ' at ')}.</p>}
            <div className="row-wrap">
              <button type="button" className="btn secondary grow" onClick={() => setReminders((x) => ({ ...x, snoozedUntil: `${addDays(todayISO(), 1)}T${x.time}` }))}>Snooze until tomorrow</button>
              <button type="button" className="btn secondary grow" onClick={() => setReminders((x) => turnOff(x))}>Turn off</button>
            </div>
          </>
        )}
        <button type="button" className="btn tertiary" onClick={() => { if (kind !== 'sample') openSample(); go({ name: 'remindersDemo' }); }}>Try the reminders demo</button>
      </section>
      <section className="card">
        <h2>Plans</h2>
        <p>You’re looking at {kind === 'sample' ? 'the sample plan' : 'your own plan'}. The sample and your plan are kept apart.</p>
        <div className="stack">
          {kind === 'sample' ? (
            <button type="button" className="btn secondary" onClick={openPersonal}>{hasPersonal ? 'Switch to my plan' : 'Make my plan'}</button>
          ) : (
            <button type="button" className="btn secondary" onClick={openSample}>Switch to the sample</button>
          )}
          <button type="button" className="btn secondary" onClick={resetSample}>Reset sample data</button>
          {hasPersonal && <button type="button" className="btn danger" onClick={() => setConfirmClear(true)}>Clear my plan</button>}
        </div>
      </section>
      <section className="card quiet">
        <h2>Your data</h2>
        <p>Everything is stored on this device only. LEFT doesn’t connect to a bank, doesn’t move money, and never keeps voice recordings.</p>
      </section>
      {confirmClear && (
        <Modal title="Clear your plan?" onClose={() => setConfirmClear(false)}>
          <p>This deletes your own plan from this device. The sample is not affected. This can’t be undone.</p>
          <div className="stack">
            <button type="button" className="btn danger" onClick={() => { setConfirmClear(false); clearPersonal(); }}>Yes, clear my plan</button>
            <button type="button" className="btn secondary" onClick={() => setConfirmClear(false)}>Keep my plan</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
