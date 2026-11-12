# LEFT: a voice-first payday planner (demo)

LEFT tells someone with weekly or irregular pay **what's safe to spend today**, what's left for groceries, which bills and debt payments to cover, and how much can go to each savings goal. Plans live only on the device. LEFT never moves money and never connects to a bank.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (also printed: a Network URL for your phone)
```

Production build:

```bash
npm run build && npm run preview   # http://localhost:4173 + Network URL
```

### Open it on a phone

1. Put the phone and the computer on the same Wi-Fi.
2. Run `npm run dev` (or `npm run build && npm run preview`).
3. Type the **Network** address Vite prints (for example `http://192.168.1.20:5173`) into the phone's browser.
   If it doesn't load, allow Node through the computer's firewall.

Everything is bundled. After the page loads, planning and typing need no internet.

## Tests

```bash
npm test             # 35 unit tests: calculation, parser, talk-to-plan
npm run build && npm run e2e   # 62 browser checks in Chromium at 320–360px, all external requests blocked
```

The e2e script saves screenshots to `screenshots/`.

## Five-minute usability walkthrough

Use a phone. Say: *"I'm testing the app, not you. Please think aloud."* **Write down what they do before you explain anything.**

| Min | Ask the tester to… | Watch for |
|---|---|---|
| 0–1 | Tap **Try the demo**. *"Tell me what you can spend today, and what's left for groceries."* | Do they read £10.00 as "today" and £80 as groceries? Do they notice "Sample"? |
| 1–2 | *"You fancy a £25 takeaway. Ask LEFT if that's OK."* (Talk or type → example or type it) | Do they find Talk or type? Do they understand the preview didn't change the plan? (£45 left, £6.42 a day) |
| 2–3 | *"You just spent £25 on groceries. Tell LEFT, by speaking or typing."* | Do they check the fields under **Check what I heard**, then Apply? Groceries should show £55 and today stays £10.00. |
| 3–4 | *"Find your house deposit pot. How much is saved?"* | Goals tab → House deposit, £400 saved, £60 from this pay. |
| 4–5 | Ask: **"What did you think the first number meant?"** and **"Where did you hesitate?"** | Note their words exactly. |

Reset between testers: **Reset sample** (yellow banner) or Settings → Reset sample data. Settings → Clear my plan removes a personal plan separately.

## The sample (fictional)

£600 available, payday in 7 days. Rent £220 and phone £30 unpaid, groceries £80, transport £20, card minimum £50 (0%, no fees, £600 balance, £30 extra chosen). Goals: Emergency savings £40, House deposit £60 (target £3,000, £400 already saved separately).
Result: £400 required, £100 goals, £30 extra to debt, **£70 left, £10.00 safe today**.
Sample dates move with the calendar, so it always opens 7 days before payday.

## How the numbers work (`src/calc.ts`)

One pure function, `computePlan(plan, today)`, feeds every screen. Money is integer pence.

1. **Cash** = the cash the person confirmed, plus income recorded as received, minus logged spending, bill payments, debt payments and savings transfers. Expected pay is shown with its date but never counted until recorded.
2. **Required** = unpaid bills and debt payments due before payday or the review date (overdue ones too, and those due *on* payday unless the person says pay always lands first), plus unspent groceries/transport budgets, plus anything put aside towards a bill due later.
3. If cash < required: show the shortfall, £0 to spend, the first payment due, and pause new goal and extra-debt money.
4. Otherwise goals get their chosen amounts in priority order (capped at what's left and what each still needs), then extra debt payments (capped at the balance after the minimum).
5. **Left** ÷ days until payday (payday itself excluded), rounded down to the penny = **Safe to spend today**.

Logging a planned payment (bill paid, money moved to a pot) lowers cash and that reservation by the same amount, once, so today's figure doesn't move.

## Voice

- Typing always works. **Try an example** runs the flow without a microphone, and the phone keyboard's own dictation works in the text box.
- The in-app **Speak** button appears only if the browser confirms **on-device** speech recognition (`SpeechRecognition.available({ processLocally: true })`). LEFT doesn't offer recognition that might send audio to a server, and it never stores audio.
- What was verified: the typed path, the examples, and the whole mic path (button → recognised words → *Check what I heard*) using a **simulated** on-device engine in Chromium. Real speech recognition was **not** verified: the headless Chromium here has no speech model, and its `available()` check crashes the tab. LEFT guards against this. It records that a check started, and if a check ever crashes the tab, it never runs it again and falls back to typing.

## Accessibility notes

Large text toggle in the header, a Reduce motion setting (it follows the system setting by default), a Celebrations toggle, 48 px or larger controls, visible focus, labels on every amount and control, and no sideways scrolling at 320 px with Large text or 200% text.

## Structure

```
src/calc.ts        single deterministic calculation (+ calc.test.ts)
src/plan.ts        sample, blank plan, entries, new pay period, Help me split it
src/parser.ts      small local parser for spoken/typed sentences (+ parser.test.ts)
src/apply.ts       applies checked changes to the plan
src/speech.ts      on-device-only speech recognition with crash guard
src/screens/       Today, Talk, Plan, Goals, Setup wizard, Split, New period, Settings
scripts/e2e.mjs    Playwright journey checks
```
