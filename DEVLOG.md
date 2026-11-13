# LEFT: developer log

A running record of what we built, added, removed and why. Newest entry at the bottom.
Each entry lists **Added / Changed / Removed / Why / Checked / Open questions**.

---

## 1. First build: voice-first payday planner (12 Nov 2026)

**Goal:** a phone-first demo for someone with weekly or irregular pay, low vision and little budgeting experience. It answers four questions: what can I spend today and before payday, what's left for groceries, which bills and debts to cover, and how much goes to each goal.

**Added**
- Vite + React + TypeScript app (the repository was empty).
- `src/calc.ts`: one deterministic calculation used by every screen. Money is stored as integer pence. The order is: cash → required (bills, debt minimums, essentials) → goals by priority → extra debt → left ÷ days (rounded down to the penny).
- Logged entries (spend, income, bill paid, debt paid, goal saved) are replayed on top of the plan. That makes **undo and correct** safe and exact.
- `src/parser.ts`: a small local parser for typed or spoken sentences ("twenty-five pounds", "Can I spend £25 on a takeaway?").
- Screens: Welcome, Today, Talk or type (with Check what I heard and an affordability preview), Plan, Goals (with a debt payment comparison), a 10-step setup wizard, Help me split it, New pay period, Settings.
- Fictional sample: £600 cash, 7 days to payday. It matches the spec table exactly.
- Accessibility: Large text toggle, reduced motion, controls of at least 48px, screen-reader labels, works at 320px and at 200% text.

**Why**
- **Replaying entries instead of changing totals:** undo and correction can't drift, and each payment is counted exactly once.
- **Local parser instead of AI:** it works offline, keeps data private and gives predictable results for the demo phrases.

**Checked:** 35 unit tests and 62 browser checks, with every outside request blocked.

**Found:** headless Chromium crashes the tab when asked `SpeechRecognition.available()`. I added a crash guard: LEFT remembers an unfinished check and never runs it again.

**Open:** real on-device speech recognition still needs testing on real phones.

---

## 2. Coin mascot check-in reminders (12 Nov 2026)

**Added**
- `src/reminders.ts`: reminders on day 1, 3 and 7 after the last check-in. Each shows once, and they pause after day 7. Settings: opt-in, reminder time, Gentle or Cheeky style, Snooze (back tomorrow at your time) and Turn off.
- `src/components/Coin.tsx`: animated SVG coin with five moods (wave, offended, sigh, celebrate, idle). Each mood is also described in text.
- Today: the reminder card and a Daily money check-in card (**Checked today**).
- Try the demo → **Reminders**: simulates all three days, showing the in-app reminder and a **mock email** (subject, message, button). Nothing is sent.

**Changed:** a confirmed money update (anything with an Undo message) now counts as a check-in, so the coin celebrates and the sequence resets.

**Why**
- The jokes only tease about **the coin being left waiting**, never about the person's money. That keeps it playful, not shaming.
- No figures appear in reminders or emails, because lock screens and inboxes aren't private.

**Not built:** real phone notifications and real email while the app is closed. Both need a server, so they stay a later opt-in.

**Checked:** 43 unit tests and 89 browser checks.

---

## 3. Insights, summary, upcoming payments, About you (13 Nov 2026)

**Inspiration:** a food-tracking app's Today screen. What we kept from it:
- one "Get your daily insights" entry button at the top;
- a summary card: a ring for the main remaining number, two side numbers, three progress bars, and a status strip;
- a list of rows, each with a big one-tap action button.

What we did **not** copy: their look, the gems or streak currency, and any branding.

**Added**
- **Get your insights** button on Today → `src/screens/Insights.tsx` with **Today / This week / This month** tabs.
  - `src/insights.ts` is a rule-based engine that runs on the phone. It reads the plan and the logs from this pay period and earlier ones.
  - It groups insights into **Coming up / Worth changing / Keep doing**.
  - Each insight has a "Why I'm saying this" line with the numbers it used, and often one action button (for example Change groceries).
  - Rules: shortfall, overdue or due-soon bills, everyday spending pace against the daily guide, groceries against the plan, repeated spends (such as takeaways), comparison with the previous week or month, savings moved, goal deadlines, the 0% debt payoff comparison, income received, and how many days were logged.
- **Summary card:**
  - ring = left until payday;
  - side numbers = spent this pay and days to payday;
  - bars = bills and debt paid, **groceries left**, and savings moved;
  - status strip = the next payment.
- **Upcoming payments:** date tiles, the amount, a one-tap **Paid** button, and expected income shown as "counted when received".
- **Quick add spending:** tap a category (including your own, such as Takeaway or Coffee), tap an amount (£3, £5, £10, £20 or £50) and it's done.
- **About you** (Settings, Insights, and a new setup step): name, what matters most, who you live with, what you often spend on, and short or detailed insights. All answers are taps, and all are optional.
- Quick amount chips on the groceries and transport setup screens.
- Plan data: `history` (logs from earlier pay periods, kept for about 120 days) and `profile`.
- Sample plan: four weeks of fictional history and a fictional profile ("Sam"), so the Week and Month insights show something real.

**Changed**
- Entry timestamps now use the phone's local date and time, not UTC, so a late-evening spend lands on the right day.
- New pay period now moves this period's logs into history instead of deleting them.
- Sample: Emergency savings shows £120 already saved, to match its history. Today's figures are unchanged.

**Removed**
- The separate "Groceries left" card on Today. It's now a labelled bar in the summary, still showing its own amount.
- The "Left until payday / Next payday" row under the big figure. It's now in the ring and the side number.
- The "Next step" card. It's replaced by the summary's status strip and Upcoming payments.

**Why**
- **Insights on the phone, not AI:** they work offline, keep figures private, are explainable (every claim shows its numbers) and give the same answer each time. An AI-written version could be a later opt-in.
- **Taps over typing:** easier for low vision and people new to budgeting, and fewer mistakes.
- **"What matters most" changes the order, not the maths:** the money figures stay identical for everyone.

**Checked:** 50 unit tests and 110 browser checks. Week and month windows, the groceries-vs-plan and takeaway patterns, focus changing the order, quick add keeping today's figure, Paid in Upcoming, About you and Insights at 200% text, all offline.

**Bug found and fixed:** the month average divided by 30 days even when the logs covered only 28, which made spending look lower. It now divides by the days the logs actually cover.

**Open questions**
- Should insights also give a monthly "pay-cycle report" when a new pay period starts?
- Should Quick add learn amounts (for example, suggest your usual coffee price)?
