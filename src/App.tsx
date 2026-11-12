import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ctx, type AppCtx, type Screen } from './app-context';
import { computePlan } from './calc';
import { todayISO } from './dates';
import { blankPlan, reanchorSample, samplePlan } from './plan';
import { store, type Settings } from './store';
import type { Plan } from './types';
import Welcome from './screens/Welcome';
import Today from './screens/Today';
import Talk from './screens/Talk';
import PlanView from './screens/PlanView';
import Goals from './screens/Goals';
import Setup from './screens/Setup';
import SettingsScreen from './screens/Settings';
import Split from './screens/Split';
import NewPeriod from './screens/NewPeriod';
import RemindersDemo from './screens/RemindersDemo';
import Coin from './components/Coin';
import { checkIn, dueStage, markShown, snooze, turnOff, type ReminderState, type Stage, type Tone } from './reminders';

function useToday() {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const t = setInterval(() => setToday(todayISO()), 60_000);
    const vis = () => setToday(todayISO());
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, []);
  return today;
}

interface Toast { id: number; text: string; undo?: Plan; celebrate?: boolean; coin?: boolean }

export default function App() {
  const today = useToday();
  const [settings, setSettingsState] = useState<Settings>(() => store.loadSettings());
  const [sample, setSample] = useState<Plan | null>(() => {
    const p = store.loadPlan('sample');
    return p ? reanchorSample(p, todayISO()) : null;
  });
  const [personal, setPersonal] = useState<Plan | null>(() => store.loadPlan('personal'));
  const [kind, setKind] = useState<'sample' | 'personal' | null>(() => {
    const a = store.loadActive();
    if (a === 'sample' && store.loadPlan('sample')) return 'sample';
    if (a === 'personal' && store.loadPlan('personal')) return 'personal';
    return null;
  });
  const [screen, setScreen] = useState<Screen>(() => {
    if (!kind) return { name: 'welcome' };
    const p = kind === 'sample' ? sample : personal;
    return p && !p.confirmed ? { name: 'setup' } : { name: 'today' };
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const [potsKey, setPotsKey] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const [reminders, setRemindersState] = useState<ReminderState>(() => store.loadReminders());
  const [pending, setPending] = useState<AppCtx['pendingReminder']>(null);
  const [demoCheckedIn, setDemoCheckedIn] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    const vis = () => setTick((n) => n + 1);
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  useEffect(() => store.saveReminders(reminders), [reminders]);

  // Keep the sample's dates current when the day changes.
  useEffect(() => {
    if (sample) {
      const moved = reanchorSample(sample, today);
      if (moved !== sample) setSample(moved);
    }
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => store.savePlan('sample', sample), [sample]);
  useEffect(() => store.savePlan('personal', personal), [personal]);
  useEffect(() => store.saveActive(kind), [kind]);
  useEffect(() => {
    store.saveSettings(settings);
    document.documentElement.dataset.large = settings.largeText ? 'true' : 'false';
    document.documentElement.dataset.motion = settings.reduceMotion ? 'reduce' : 'full';
  }, [settings]);

  const plan = kind === 'sample' ? sample : kind === 'personal' ? personal : null;
  const summary = useMemo(() => (plan ? computePlan(plan, today) : null), [plan, today]);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo({ top: 0 });
    // Move focus to the new screen's heading for keyboard and screen-reader users.
    requestAnimationFrame(() => mainRef.current?.querySelector<HTMLElement>('h1')?.focus());
  }, []);

  // Real reminders: only for your own plan, only when opted in. Shown once, on Today.
  useEffect(() => {
    if (kind !== 'personal' || pending) return;
    const stage = dueStage(reminders, new Date());
    if (!stage) return;
    setRemindersState((r) => markShown(r, stage));
    setPending({ stage, tone: reminders.tone, demo: false, opened: false });
    setScreen((sc) => (['today', 'plan', 'goals', 'welcome'].includes(sc.name) ? { name: 'today' } : sc));
  }, [kind, reminders, tick, pending]);

  const isDemo = kind === 'sample';
  const remindersOn = isDemo || reminders.enabled;
  const checkedInToday = isDemo ? demoCheckedIn : reminders.lastCheckIn === today && reminders.enabled;

  const registerCheckIn = useCallback(() => {
    if (kind === 'sample') setDemoCheckedIn(true);
    else if (reminders.enabled) setRemindersState((r) => checkIn(r, new Date()));
    setPending(null);
  }, [kind, reminders.enabled]);

  const celebrate = useCallback(
    (msg: string) => {
      // Used after confirmed actions (plan confirmed, savings marked): also a check-in.
      setToast({ id: Date.now(), text: msg, celebrate: settings.celebrations, coin: remindersOn && settings.celebrations });
      registerCheckIn();
    },
    [settings.celebrations, remindersOn, registerCheckIn],
  );

  const setPlan = useCallback(
    (fn: (p: Plan) => Plan) => {
      if (kind === 'sample') setSample((p) => (p ? fn(p) : p));
      else if (kind === 'personal') setPersonal((p) => (p ? fn(p) : p));
    },
    [kind],
  );

  const update = useCallback(
    (fn: (p: Plan) => Plan, message?: string) => {
      const before = plan;
      setPlan(fn);
      if (message) {
        // A confirmed money update counts as a check-in: the coin celebrates and the sequence resets.
        setToast({ id: Date.now(), text: message, undo: before ?? undefined, coin: remindersOn && settings.celebrations });
        registerCheckIn();
      }
    },
    [plan, setPlan, remindersOn, settings.celebrations, registerCheckIn],
  );



  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const startSample = () => {
    if (!sample) setSample(samplePlan(today));
    setKind('sample');
    setPotsKey((k) => k + 1);
    go({ name: 'today' });
  };
  const startPersonal = () => {
    const p = personal ?? blankPlan(today);
    if (!personal) setPersonal(p);
    setKind('personal');
    go(p.confirmed ? { name: 'today' } : { name: 'setup' });
  };

  const ctx: AppCtx | null = plan && summary && kind
    ? {
        today,
        kind,
        plan,
        summary,
        hasPersonal: !!personal,
        update,
        go,
        settings,
        setSettings: setSettingsState,
        celebrate,
        potsKey,
        fillPots: () => setPotsKey((k) => k + 1),
        openSample: () => startSample(),
        openPersonal: () => startPersonal(),
        resetSample: () => {
          setSample(samplePlan(today));
          setPotsKey((k) => k + 1);
          setToast({ id: Date.now(), text: 'Sample reset to the starting figures.' });
        },
        clearPersonal: () => {
          setPersonal(null);
          if (kind === 'personal') {
            setKind(null);
            setScreen({ name: 'welcome' });
          }
          setToast({ id: Date.now(), text: 'Your plan was cleared from this device.' });
        },
        reminders,
        setReminders: (fn) => setRemindersState(fn),
        pendingReminder: isDemo ? (pending?.demo ? pending : null) : pending && !pending.demo ? pending : null,
        openReminder: () => {
          setPending((p) => (p ? { ...p, opened: true } : p));
          go({ name: 'today' });
        },
        snoozeReminder: () => {
          if (pending && !pending.demo) setRemindersState((r) => snooze(r, pending.stage, new Date()));
          setPending(null);
          setToast({ id: Date.now(), text: pending?.demo ? 'Snoozed. In your own plan this comes back tomorrow at your reminder time.' : `Snoozed until tomorrow at ${reminders.time}.` });
        },
        turnOffReminder: () => {
          if (!pending?.demo) setRemindersState((r) => turnOff(r));
          setPending(null);
          setToast({ id: Date.now(), text: pending?.demo ? 'In your own plan this turns reminders off. You can turn them on again in Settings.' : 'Reminders are off. Turn them on again in Settings.' });
        },
        simulateReminder: (stage: Stage, tone: Tone) => {
          setDemoCheckedIn(false);
          setPending({ stage, tone, demo: true, opened: false });
        },
        checkedInToday,
        checkInNow: () => {
          registerCheckIn();
          setToast({ id: Date.now(), text: settings.celebrations ? 'Checked in! The coin is thrilled. See you tomorrow.' : 'Checked in for today.', coin: settings.celebrations, celebrate: settings.celebrations });
        },
      }
    : null;

  if (!ctx || screen.name === 'welcome') {
    return (
      <Welcome
        hasPersonal={!!personal}
        onSample={startSample}
        onPersonal={startPersonal}
        settings={settings}
        setSettings={setSettingsState}
      />
    );
  }

  const tab = screen.name === 'plan' ? 'plan' : screen.name === 'goals' ? 'goals' : screen.name === 'today' ? 'today' : null;

  return (
    <Ctx.Provider value={ctx}>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button className="brand" onClick={() => go({ name: 'welcome' })} aria-label="LEFT home: choose sample or your plan">LEFT</button>
        <span className={`mode-chip ${kind}`}>{kind === 'sample' ? 'Sample' : 'My plan'}</span>
        <button type="button" className="icon-btn" aria-pressed={settings.largeText} onClick={() => setSettingsState({ ...settings, largeText: !settings.largeText })}>
          <span aria-hidden="true" className="aa">Aa</span>
          <span className="icon-label">Large text</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => go({ name: 'settings' })}>
          <span aria-hidden="true" className="gear">⚙</span>
          <span className="icon-label hide-narrow">Settings</span>
        </button>
      </header>
      {kind === 'sample' && (
        <div className="sample-banner" role="note">
          <span>This is a sample with made-up UK figures. Change anything you like.</span>
          <div className="row-wrap tight">
            <button type="button" className="btn-small" onClick={() => go({ name: 'remindersDemo' })}>Reminders</button>
            <button type="button" className="btn-small" onClick={ctx.resetSample}>Reset sample</button>
          </div>
        </div>
      )}
      <main id="main" ref={mainRef} tabIndex={-1}>
        {screen.name === 'today' && <Today />}
        {screen.name === 'talk' && <Talk initial={screen.text} />}
        {screen.name === 'plan' && <PlanView />}
        {screen.name === 'goals' && <Goals />}
        {screen.name === 'setup' && <Setup startStep={screen.step} editOnly={screen.editOnly} />}
        {screen.name === 'settings' && <SettingsScreen />}
        {screen.name === 'split' && <Split />}
        {screen.name === 'newPeriod' && <NewPeriod />}
        {screen.name === 'remindersDemo' && <RemindersDemo />}
      </main>
      {tab && (
        <nav className="tabs" aria-label="Main">
          {(['today', 'plan', 'goals'] as const).map((t) => (
            <button key={t} type="button" aria-current={tab === t ? 'page' : undefined} onClick={() => go({ name: t })}>
              <span aria-hidden="true" className="tab-icon">{t === 'today' ? '◉' : t === 'plan' ? '☰' : '★'}</span>
              {t === 'today' ? 'Today' : t === 'plan' ? 'Plan' : 'Goals'}
            </button>
          ))}
        </nav>
      )}
      <div className="toast-area" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.celebrate ? 'celebrate' : ''}`} key={toast.id}>
            {toast.coin ? <Coin mood="celebrate" label="The coin celebrates" size={56} /> : toast.celebrate && <span className="sparkle" aria-hidden="true">✦</span>}
            <span>{toast.text}</span>
            {toast.undo && (
              <button type="button" className="btn-small" onClick={() => { const u = toast.undo!; setPlan(() => u); setToast({ id: Date.now(), text: 'Undone.' }); }}>
                Undo
              </button>
            )}
            <button type="button" className="btn-small ghost" aria-label="Dismiss message" onClick={() => setToast(null)}>✕</button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
