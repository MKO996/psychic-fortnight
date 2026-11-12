/**
 * In-app microphone, offered ONLY when the browser says it can recognise speech on this device.
 * Audio is never stored by LEFT; only the recognised words are put into the text box.
 */
type SRCtor = {
  new (): any;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  availableOnDevice?: (lang: string) => Promise<string | boolean>;
};

function ctor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const PROBE_KEY = 'left.speechProbe.v1';

function getProbe(): string | null {
  try { return localStorage.getItem(PROBE_KEY); } catch { return null; }
}
function setProbe(v: string) {
  try { localStorage.setItem(PROBE_KEY, v); } catch { /* ignore */ }
}

/**
 * True only when the browser confirms on-device recognition for en-GB.
 * Some browser builds crash the tab while answering this question, so we mark the probe as
 * "pending" first. If we find it still pending on a later visit, the check crashed: never ask again.
 */
export async function localSpeechAvailable(): Promise<boolean> {
  const SR = ctor();
  if (!SR) return false;
  const prev = getProbe();
  if (prev === 'pending' || prev === 'crashed') {
    setProbe('crashed');
    return false;
  }
  try {
    setProbe('pending');
    let ok = false;
    if (typeof SR.available === 'function') {
      ok = (await SR.available({ langs: ['en-GB'], processLocally: true })) === 'available';
    } else if (typeof SR.availableOnDevice === 'function') {
      const r = await SR.availableOnDevice('en-GB');
      ok = r === true || r === 'available';
    }
    // Recognition without an on-device check may send audio to a server: don't offer it.
    setProbe(ok ? 'yes' : 'no');
    return ok;
  } catch {
    setProbe('no');
    return false;
  }
}

export interface Listening {
  stop: () => void;
}

export function listen(handlers: { onText: (t: string, final: boolean) => void; onEnd: () => void; onError: (msg: string) => void }): Listening | null {
  const SR = ctor();
  if (!SR) return null;
  const r = new SR();
  r.lang = 'en-GB';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  try {
    r.processLocally = true;
  } catch {
    /* older engines */
  }
  r.onresult = (ev: any) => {
    let text = '';
    let final = false;
    for (let i = 0; i < ev.results.length; i++) {
      text += ev.results[i][0].transcript;
      if (ev.results[i].isFinal) final = true;
    }
    handlers.onText(text, final);
  };
  r.onerror = (ev: any) => {
    const code = ev?.error ?? 'error';
    handlers.onError(code === 'not-allowed' || code === 'service-not-allowed' ? 'Microphone access was not allowed. You can type instead.' : 'I couldn’t hear that. You can try again or type instead.');
  };
  r.onend = () => handlers.onEnd();
  try {
    r.start();
  } catch {
    handlers.onError('The microphone could not start. You can type instead.');
    return null;
  }
  return { stop: () => r.stop() };
}
