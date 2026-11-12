import { useState } from 'react';
import { useApp } from '../app-context';
import { Modal, Toggle } from '../ui';

export default function SettingsScreen() {
  const { settings, setSettings, go, kind, resetSample, clearPersonal, hasPersonal, openSample, openPersonal } = useApp();
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
