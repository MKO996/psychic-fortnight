import type { Settings } from '../store';
import { Toggle } from '../ui';

export default function Welcome({ hasPersonal, onSample, onPersonal, settings, setSettings }: { hasPersonal: boolean; onSample: () => void; onPersonal: () => void; settings: Settings; setSettings: (s: Settings) => void }) {
  return (
    <main id="main" className="welcome">
      <h1 tabIndex={-1}>
        <span className="logo">LEFT</span>
        <span className="tagline">What you can spend before payday</span>
      </h1>
      <p className="lead">Tell LEFT what you have, what you owe and what you’re saving for. It shows what’s safe to spend today.</p>
      <div className="stack">
        <button type="button" className="btn primary xl" onClick={onSample}>
          Try the demo
          <small>Opens a full sample plan with made-up figures</small>
        </button>
        <button type="button" className="btn secondary xl" onClick={onPersonal}>
          {hasPersonal ? 'Open my plan' : 'Make my plan'}
          <small>{hasPersonal ? 'Your own plan, saved on this device' : 'A few short questions, one at a time'}</small>
        </button>
      </div>
      <div className="card quiet">
        <Toggle label="Large text" checked={settings.largeText} onChange={(b) => setSettings({ ...settings, largeText: b })} />
      </div>
      <p className="small-print">Your plan stays on this phone. LEFT doesn’t connect to your bank and doesn’t move money. You make payments and transfers yourself.</p>
    </main>
  );
}
