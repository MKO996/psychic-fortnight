// End-to-end checks for LEFT. Run `npm run build` first, then `npm run e2e`.
// Starts `vite preview`, drives Chromium with Playwright and blocks every non-local request.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const SHOTS = 'screenshots';
mkdirSync(SHOTS, { recursive: true });

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  setTimeout(() => rej(new Error('server did not start')), 15000);
});

const results = [];
const external = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const browser = await chromium.launch();
async function newPage(opts = {}) {
  const { keepSpeech, ...ctxOpts } = opts;
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, ...ctxOpts });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(URL) || u.startsWith('data:')) return route.continue();
    external.push(u);
    return route.abort();
  });
  const page = await ctx.newPage();
  // This headless Chromium crashes when asked SpeechRecognition.available(), so by default
  // tests run as a device without speech recognition. Voice tests below install their own engine.
  if (!keepSpeech) await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  page.on('pageerror', (e) => check('no page errors', false, e.message));
  return page;
}
const text = async (page, sel) => (await page.locator(sel).first().innerText()).trim();
async function freshSample(opts) {
  const page = await newPage(opts);
  await page.goto(URL);
  await page.getByRole('button', { name: /Try the demo/ }).click();
  await page.getByTestId('safe-today').waitFor();
  return page;
}
async function talk(page, words) {
  await page.getByRole('button', { name: 'Talk or type' }).click();
  await page.getByLabel(/What’s changed/).fill(words);
  await page.getByRole('button', { name: 'Continue' }).click();
}

try {
  // 1. Open the sample
  {
    const page = await freshSample();
    check('sample: £10.00 safe today', (await text(page, '[data-testid=safe-today]')) === '£10.00');
    check('sample: £70 left until payday', (await text(page, '[data-testid=left-total]')) === '£70');
    check('sample: groceries £80 left', (await text(page, '[data-testid=groceries-left]')) === '£80');
    check('sample: copy line', await page.getByText('You have £10 to spend today after the money you’ve set aside.').isVisible());
    await page.screenshot({ path: `${SHOTS}/01-today-360.png`, fullPage: true });
    await page.getByRole('button', { name: 'View plan' }).click();
    check('plan: £400 required', (await text(page, '[data-testid=required]')) === '−£400');
    check('plan: £100 goals', (await text(page, '[data-testid=goals-total]')) === '−£100');
    check('plan: £30 extra to debt', (await text(page, '[data-testid=extra-total]')) === '−£30');
    await page.screenshot({ path: `${SHOTS}/02-plan-360.png`, fullPage: true });
    // pots breakdown
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('button', { name: /^Bills & essentials: £350/ }).click();
    check('pot breakdown dialog opens', await page.getByRole('dialog', { name: 'Bills & essentials' }).isVisible());
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    // refresh with saved data
    await talk(page, 'I got paid £200 for a shift');
    await page.getByRole('button', { name: 'Apply' }).click();
    check('received wage: £270 left', (await text(page, '[data-testid=left-total]')) === '£270');
    check('received wage: £38.57 today', (await text(page, '[data-testid=safe-today]')) === '£38.57');
    await page.reload();
    await page.getByTestId('safe-today').waitFor();
    check('refresh keeps saved data', (await text(page, '[data-testid=left-total]')) === '£270');
    await page.getByRole('button', { name: 'Reset sample' }).click();
    check('reset sample with one tap', (await text(page, '[data-testid=left-total]')) === '£70');
    await page.context().close();
  }

  // 2. Takeaway preview
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'Talk or type' }).click();
    await page.getByRole('button', { name: '“Can I spend £25 on a takeaway?”' }).click();
    check('preview: £45 left', (await text(page, '[data-testid=preview-left]')) === '£45');
    check('preview: £6.42 a day', (await text(page, '[data-testid=preview-daily]')) === '£6.42');
    await page.screenshot({ path: `${SHOTS}/03-preview-360.png`, fullPage: true });
    await page.getByRole('button', { name: 'Close preview' }).click();
    check('after preview: still £70 / £10.00', (await text(page, '[data-testid=left-total]')) === '£70' && (await text(page, '[data-testid=safe-today]')) === '£10.00');
    await page.context().close();
  }

  // 3. Grocery spend + undo (typed, spoken-style words)
  {
    const page = await freshSample();
    await talk(page, 'I spent twenty-five pounds on groceries');
    check('check what I heard shows', await page.getByRole('heading', { name: 'Check what I heard' }).isVisible());
    check('heard £25', (await page.getByLabel('Amount spent').inputValue()) === '25');
    await page.screenshot({ path: `${SHOTS}/04-check-heard-360.png`, fullPage: true });
    await page.getByRole('button', { name: 'Apply' }).click();
    check('groceries: £55 left', (await text(page, '[data-testid=groceries-left]')) === '£55');
    check('groceries: still £10.00', (await text(page, '[data-testid=safe-today]')) === '£10.00');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    check('undo restores £80 groceries', (await text(page, '[data-testid=groceries-left]')) === '£80');
    // Undo from the plan's log too
    await talk(page, 'I spent £25 on groceries');
    await page.getByRole('button', { name: 'Apply' }).click();
    await page.getByRole('button', { name: 'View plan' }).click();
    await page.getByRole('button', { name: /^Correct: Spent on groceries/ }).click();
    await page.getByLabel('Correct amount').fill('30');
    await page.getByRole('button', { name: 'Save' }).click();
    check('correcting an entry updates cash', (await text(page, '[data-testid=cash]')) === '£570');
    await page.getByRole('button', { name: /^Undo: Spent on groceries/ }).click();
    check('undo entry from plan restores cash', (await text(page, '[data-testid=cash]')) === '£600');
    // follow-up question for missing amount
    await page.getByRole('button', { name: 'Today' }).click();
    await talk(page, 'I spent some money on the bus');
    check('follow-up asks how much', await page.getByText('How much did you spend?').isVisible());
    check('apply disabled until answered', await page.getByRole('button', { name: 'Apply' }).isDisabled());
    await page.getByLabel('Amount spent').fill('4');
    check('apply enabled after answer', await page.getByRole('button', { name: 'Apply' }).isEnabled());
    await page.context().close();
  }

  // 4. Phone bill paid
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'View plan' }).click();
    await page.getByRole('button', { name: /Mark Phone bill paid/ }).click();
    check('phone paid: cash £570', (await text(page, '[data-testid=cash]')) === '£570');
    check('phone paid: required £370', (await text(page, '[data-testid=required]')) === '−£370');
    check('phone paid: check mark', await page.locator('.is-paid .paid-badge').first().isVisible());
    await page.getByRole('button', { name: 'Today' }).click();
    check('phone paid: still £10.00', (await text(page, '[data-testid=safe-today]')) === '£10.00');
    await page.context().close();
  }

  // 5. Deposit saved
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'Goals' }).click();
    const house = page.getByTestId('goal-goal-house');
    await house.getByRole('button', { name: /I’ve moved £60/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Mark saved' }).click();
    check('house pot £460 saved', (await house.getByTestId('saved').innerText()) === '£460');
    check('house £60 reservation fulfilled', (await house.getByTestId('set-aside').innerText()) === '£0');
    await page.screenshot({ path: `${SHOTS}/05-goals-360.png`, fullPage: true });
    await page.getByRole('button', { name: 'Today' }).click();
    check('saved: still £10.00', (await text(page, '[data-testid=safe-today]')) === '£10.00');
    await page.context().close();
  }

  // 6. Cash £350
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'View plan' }).click();
    await page.getByRole('button', { name: 'Change money I have now' }).click();
    await page.getByLabel('Money you can use now').fill('350');
    await page.getByRole('button', { name: 'Save' }).click();
    check('short: £50 shortfall', (await text(page, '[data-testid=shortfall]')) === '£50');
    await page.getByRole('button', { name: 'Today' }).click();
    check('short: £0.00 safe', (await text(page, '[data-testid=safe-today]')) === '£0.00');
    check('short: copy', await page.getByText('You’re £50 short for bills and essentials. Your rent is due first.').isVisible());
    await page.getByRole('button', { name: /^Savings: £0/ }).waitFor();
    check('short: savings pot £0, debt pot only minimum', await page.getByRole('button', { name: /^Debt: £50\./ }).isVisible());
    await page.screenshot({ path: `${SHOTS}/06-short-360.png`, fullPage: true });
    await page.context().close();
  }

  // 7. Debt comparison
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'Goals' }).click();
    check('debt: £50 → 12 payments', (await text(page, '[data-testid=months-a]')) === '12 monthly payments');
    check('debt: £80 → 8 payments', (await text(page, '[data-testid=months-b]')) === '8 monthly payments');
    await page.context().close();
  }

  // 8. Make my plan, offline (all external requests blocked), with a bill due on payday
  {
    const page = await newPage();
    await page.goto(URL);
    await page.getByRole('button', { name: /Make my plan/ }).click();
    await page.getByLabel('Money you can use now').fill('500');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Weekly', { exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    const today = new Date();
    const iso = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const localIso = (n) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    void iso;
    await page.getByLabel('Next payday').fill(localIso(5));
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: '+ Add pay' }).click();
    await page.getByLabel('Amount you expect').fill('300');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: '+ Add a bill' }).click();
    await page.getByLabel('Bill', { exact: true }).fill('Rent');
    await page.getByLabel('Amount', { exact: true }).fill('200');
    await page.getByLabel('Due date').fill(localIso(5)); // due ON payday
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Groceries').fill('50');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'None' }).click();
    await page.getByRole('button', { name: 'No debts' }).click();
    await page.getByRole('button', { name: '+ Add a goal' }).click();
    await page.getByRole('button', { name: 'Emergency savings' }).click();
    await page.getByLabel('Put in from this pay').fill('50');
    await page.getByRole('button', { name: 'Continue' }).click();
    check('check what I understood', await page.getByRole('heading', { name: 'Check what I understood' }).isVisible());
    await page.screenshot({ path: `${SHOTS}/07-setup-check-360.png`, fullPage: true });
    await page.getByRole('button', { name: 'Confirm my plan' }).click();
    // 500 - 200 rent (due on payday, covered) - 50 groceries - 50 savings = 200 / 5 days = 40
    check('own plan: bill due on payday is covered → £200 left', (await text(page, '[data-testid=left-total]')) === '£200');
    check('own plan: £40.00 today', (await text(page, '[data-testid=safe-today]')) === '£40.00');
    check('own plan: no external requests', external.length === 0, external.join(', '));
    // sample kept separate
    await page.getByRole('button', { name: /LEFT home/ }).click();
    await page.getByRole('button', { name: /Try the demo/ }).click();
    check('sample separate from own plan', (await text(page, '[data-testid=left-total]')) === '£70');
    await page.getByRole('button', { name: /LEFT home/ }).click();
    await page.getByRole('button', { name: /Open my plan/ }).click();
    check('own plan still there', (await text(page, '[data-testid=left-total]')) === '£200');
    await page.context().close();
  }

  // 9. Missing data → Finish your plan
  {
    const page = await newPage();
    await page.goto(URL);
    await page.getByRole('button', { name: /Make my plan/ }).click();
    await page.getByLabel('Money you can use now').fill('300');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /LEFT home/ }).click();
    await page.getByRole('button', { name: /Open my plan/ }).click();
    // unfinished plan resumes setup; jump to Today via a confirmed-less route
    const onSetup = await page.getByText(/Step \d+ of 10/).isVisible();
    check('unfinished plan resumes where it stopped', onSetup);
    await page.context().close();
  }

  // 10. Narrow width, large text, 200% text, reduced motion, tap targets
  {
    const page = await freshSample({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' });
    const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('320px: no sideways scroll', (await overflow()) <= 0);
    await page.getByRole('button', { name: /Large text/ }).first().click();
    check('large text on', (await page.evaluate(() => document.documentElement.dataset.large)) === 'true');
    check('320px + large text: no sideways scroll', (await overflow()) <= 0, String(await overflow()));
    await page.screenshot({ path: `${SHOTS}/08-large-text-320.png`, fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    check('200% text: no sideways scroll', (await overflow()) <= 0, String(await overflow()));
    await page.screenshot({ path: `${SHOTS}/09-text-200pct-320.png`, fullPage: true });
    for (const name of ['Plan', 'Goals']) {
      await page.getByRole('button', { name, exact: true }).click();
      check(`200% text on ${name}: no sideways scroll`, (await overflow()) <= 0, String(await overflow()));
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    const dur = await page.locator('.pot-fill').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    check('reduced motion: no pot transition', dur === '0s', dur);
    const small = await page.evaluate(() => [...document.querySelectorAll('.btn, .tabs button, .icon-btn, .segmented button, .pot, .switch, .chip')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({ t: b.textContent.trim().slice(0, 20), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height }))
      .filter((r) => r.w < 48 || r.h < 48));
    check('primary controls ≥ 48×48', small.length === 0, JSON.stringify(small));
    const unlabeled = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea')].filter((el) => {
      const name = el.getAttribute('aria-label') || el.textContent.trim() || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim());
      return !name;
    }).length);
    check('every control has a name', unlabeled === 0, String(unlabeled));
    await page.context().close();
  }

  // 11. Motion toggle, controls work during the pot animation
  {
    const page = await freshSample();
    const dur = await page.locator('.pot-fill').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    check('motion on by default: pots animate', dur !== '0s', dur);
    await page.getByRole('button', { name: /^Spending: £70/ }).click(); // during the fill animation
    check('pots tappable while animating', await page.getByRole('dialog', { name: 'Spending' }).isVisible());
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: /Reduce motion/ }).click();
    check('motion toggle sets reduce', (await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduce');
    // keyboard focus visible
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    check('keyboard focus is visible', outline !== 'none', outline);
    await page.context().close();
  }

  // 12. Voice: mic hidden without on-device recognition; shown and wired with it (simulated engine)
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'Talk or type' }).click();
    check('no local speech engine → no mic button, typing hint shown', !(await page.getByRole('button', { name: /Speak/ }).isVisible()) && (await page.getByText(/microphone on your phone’s keyboard/).isVisible()));
    await page.context().close();

    // Crash guard: a probe left "pending" by a crashed tab is never retried.
    const p3 = await newPage({ keepSpeech: true });
    await p3.addInitScript(() => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); localStorage.setItem('left.speechProbe.v1', 'pending'); } });
    await p3.goto(URL);
    await p3.getByRole('button', { name: /Try the demo/ }).click();
    await p3.getByRole('button', { name: 'Talk or type' }).click();
    await p3.getByText(/microphone on your phone’s keyboard/).waitFor();
    check('crash guard: earlier crashed probe is not repeated, typing still works', (await p3.evaluate(() => localStorage.getItem('left.speechProbe.v1'))) === 'crashed');
    await p3.context().close();

    const p2 = await newPage({ keepSpeech: true });
    await p2.addInitScript(() => {
      class FakeSR {
        static available() { return Promise.resolve('available'); }
        start() {
          setTimeout(() => {
            this.onresult?.({ results: [Object.assign([{ transcript: 'I spent twenty five pounds on groceries' }], { isFinal: true })] });
            this.onend?.();
          }, 50);
        }
        stop() { this.onend?.(); }
      }
      window.SpeechRecognition = FakeSR; delete window.webkitSpeechRecognition;
    });
    await p2.goto(URL);
    await p2.getByRole('button', { name: /Try the demo/ }).click();
    await p2.getByRole('button', { name: 'Talk or type' }).click();
    await p2.getByRole('button', { name: /Speak/ }).click();
    await p2.getByRole('heading', { name: 'Check what I heard' }).waitFor();
    check('simulated on-device speech → Check what I heard (£25 groceries)', (await p2.getByLabel('Amount spent').inputValue()) === '25');
    const stored = await p2.evaluate(() => Object.keys(localStorage).join(','));
    check('no recordings in storage', !/audio|record/i.test(stored), stored);
    await p2.context().close();
  }

  // 13. Reminders demo: Try the demo → Reminders, all three days, in-app + mock email, offline
  {
    const page = await freshSample();
    await page.getByRole('button', { name: 'Reminders', exact: true }).click();
    await page.getByText('Cheeky', { exact: true }).click();
    const expect = {
      1: ['Ten seconds for your money?', 'I’m waving'],
      3: ['Your money pots held a meeting.', 'I was the only one who showed up.'],
      7: ['Fine. I’ll stop being dramatic.', 'Your plan will be here when you’re ready.'],
    };
    for (const d of [1, 3, 7]) {
      await page.getByRole('button', { name: `Day ${d}`, exact: true }).click();
      const inapp = await page.getByTestId('demo-inapp').innerText();
      const email = await page.getByTestId('demo-email').innerText();
      check(`demo day ${d}: in-app reminder copy`, inapp.includes(expect[d][0]) && inapp.includes(expect[d][1]));
      check(`demo day ${d}: mock email has subject, message, button`, (await page.getByTestId('email-subject').innerText()).length > 0 && email.includes('Check my money'));
      check(`demo day ${d}: no figures in reminder or email`, !/£\d/.test(inapp + email));
      if (d === 3) await page.screenshot({ path: `${SHOTS}/10-reminder-demo-day3-360.png`, fullPage: true });
    }
    check('demo: coin mood is sigh on day 7', (await page.getByTestId('demo-inapp').locator('.coin').getAttribute('data-mood')) === 'sigh');
    await page.getByTestId('demo-inapp').getByRole('button', { name: 'Check my money' }).click();
    check('reminder opens Today', await page.getByTestId('safe-today').isVisible());
    check('Today shows the waiting coin and Checked today', await page.getByTestId('checkin').getByRole('button', { name: 'Checked today' }).isVisible());
    await page.getByRole('button', { name: 'Checked today' }).click();
    check('Checked today: coin celebrates', (await page.locator('.toast .coin').getAttribute('data-mood')) === 'celebrate');
    check('Checked today: card updates', await page.getByRole('heading', { name: 'Checked in today' }).isVisible());
    await page.screenshot({ path: `${SHOTS}/11-checked-in-360.png`, fullPage: true });
    // A confirmed money update also counts as a check-in
    await page.getByRole('button', { name: 'Reminders', exact: true }).click();
    await page.getByRole('button', { name: 'Day 3', exact: true }).click();
    await page.getByTestId('demo-email').getByRole('button', { name: 'Check my money' }).click();
    await talk(page, 'I spent £25 on groceries');
    await page.getByRole('button', { name: 'Apply' }).click();
    check('money update: coin celebrates and resets', (await page.locator('.toast .coin').getAttribute('data-mood')) === 'celebrate' && await page.getByRole('heading', { name: 'Checked in today' }).isVisible());
    check('reminders demo: no external requests', external.length === 0, external.join(', '));
    await page.context().close();
  }

  // 14. Real reminders on your own plan: opt-in, once per stage, snooze, turn off, reduced motion
  {
    const page = await freshSample({ reducedMotion: 'reduce' });
    const today = new Date();
    const ago = (n) => { const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const setup = async (state) => page.evaluate(([st]) => {
      const p = JSON.parse(localStorage.getItem('left.sample.v1'));
      p.kind = 'personal';
      localStorage.setItem('left.personal.v1', JSON.stringify(p));
      localStorage.setItem('left.active.v1', JSON.stringify('personal'));
      localStorage.setItem('left.reminders.v1', JSON.stringify(st));
    }, [state]);
    await setup({ enabled: false, time: '00:00', tone: 'cheeky', lastCheckIn: ago(3), shown: [], snoozedUntil: null });
    await page.reload();
    await page.getByTestId('safe-today').waitFor();
    check('no reminder unless opted in', (await page.getByTestId('reminder-card').count()) === 0);
    await setup({ enabled: true, time: '00:00', tone: 'cheeky', lastCheckIn: ago(3), shown: [1], snoozedUntil: null });
    await page.reload();
    await page.getByTestId('reminder-card').waitFor();
    check('own plan: day 3 reminder on Today', (await page.getByTestId('reminder-card').innerText()).includes('I was the only one who showed up.'));
    check('reduced motion: coin still, mood in text', (await page.locator('.reminder .coin-body').first().evaluate((el) => getComputedStyle(el).animationName)) === 'none' && (await page.getByRole('img', { name: /offended/ }).count()) > 0);
    await page.reload();
    await page.getByTestId('safe-today').waitFor();
    check('each stage shows once', (await page.getByTestId('reminder-card').count()) === 0);
    await setup({ enabled: true, time: '00:00', tone: 'gentle', lastCheckIn: ago(8), shown: [1, 3], snoozedUntil: null });
    await page.reload();
    await page.getByTestId('reminder-card').waitFor();
    check('gentle day 7 copy', (await page.getByTestId('reminder-card').innerText()).includes('I’ll stop reminding you for now.'));
    await page.getByRole('button', { name: 'Snooze' }).click();
    check('snooze hides it', (await page.getByTestId('reminder-card').count()) === 0);
    const snoozed = await page.evaluate(() => JSON.parse(localStorage.getItem('left.reminders.v1')));
    check('snooze brings day 7 back tomorrow', !!snoozed.snoozedUntil && !snoozed.shown.includes(7));
    await setup({ enabled: true, time: '00:00', tone: 'cheeky', lastCheckIn: ago(1), shown: [], snoozedUntil: null });
    await page.reload();
    await page.getByTestId('reminder-card').waitFor();
    await page.getByRole('button', { name: 'Turn off' }).click();
    check('turn off', (await page.evaluate(() => JSON.parse(localStorage.getItem('left.reminders.v1')).enabled)) === false);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('switch', { name: /Remind me to check my money/ }).click();
    check('opt in shows time and style', await page.getByLabel('Reminder time').isVisible() && await page.getByText('Gentle', { exact: true }).isVisible());
    await page.getByLabel('Reminder time').fill('07:30');
    check('reminder time saved', (await page.evaluate(() => JSON.parse(localStorage.getItem('left.reminders.v1')).time)) === '07:30');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('settings at 360px: no sideways scroll', overflow <= 0, String(overflow));
    await page.context().close();
  }
} catch (e) {
  check('script error', false, e.message.split('\n')[0]);
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. External requests blocked: ${external.length}`);
process.exit(failed.length ? 1 : 0);
