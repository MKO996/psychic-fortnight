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

---

## 4. Always-on game style (21 Nov 2026)

**Ask:** make the UI and UX feel like a game, all the time.

**Added**
- `src/game.ts`: the game layer. **Everything is derived** from what the person actually did (logged entries plus check-in, "nothing spent" and insight-view days). Nothing is stored as a running score.
  - **XP:** checking in +10 a day; logging spending or income +5 (counts up to 3 a day); bill or debt payment paid +15; money moved to a goal +20; plan finished +50; each badge +25; all 3 daily quests done +30.
  - **Levels:** 100, 250, 450, 700… XP. Titles: Rookie → Tracker → Planner → Steady Hand → Bill Boss → Pot Master → Money Captain → Legend.
  - **Streak:** consecutive days with any money action. It stays alive until the end of today, and is shown "at risk" if today isn't done yet.
  - **11 badges:** for example First look, On a roll (3 days), Full week, Bill boss, Pot filler, Quarter way, Debt dent and Curious mind.
  - **3 daily quests:** Check your money, Log today's spending (or "Nothing spent today"), plus one that fits the plan: mark a bill paid when one is due within 3 days, otherwise move money to a goal, otherwise read your insights.
- **Status bar** under the top bar on every main screen: level shield, title, XP bar and streak flame. Tapping it opens Trophies.
- **Trophies tab** (4th tab): level card, streak and best streak, badge grid with locked badges showing how to win them, level path, and "How you earn XP".
- **XP pop-up** "+10 XP" after every habit, and a short **Level up!** card with the coin.
- **Goal stars:** 4 stars at 25, 50, 75 and 100% of the target, plus "next star at £…".
- **Visual style:**
  - chunky buttons that press down;
  - a green primary colour (6:1 contrast with white) and purple for levels and selections;
  - game-panel cards and striped progress bars;
  - the system rounded font on iPhone (`ui-rounded`);
  - emoji tab icons.

**Changed**
- The Daily money check-in card became the **Daily quests** card. It keeps its "Checked today" button and the coin.
- The coin now celebrates after every confirmed money action, not only when reminders are on, because the game is always on.
- Check-ins are now recorded in the plan (`plan.game`), so the sample and your own plan keep separate progress, and Reset sample resets the game.

**Removed:** nothing user-facing. The plain check-in card was replaced by Daily quests.

**Why (design rules we chose)**
1. **Never reward spending.** XP ignores amounts (logging £2 = logging £200), logging XP is capped per day, and spending more can never earn more. Unit tests prove both.
2. **Undo takes XP back**, because XP is derived from the real log. You can't cheat it, and mistakes aren't punished.
3. **No penalties.** Missing a day only resets the streak. There's no lost XP and no shame.
4. **XP, not coins.** A points currency in a money app would be confused with real pounds.
5. **The game sits on top of the maths, never inside it.** The Safe to spend figure is the same with or without the game.
6. **Accessibility kept:** every game element is also text, Reduce motion stops all game animation, and controls stay at least 48px. Tested at 200% text.

**Checked:** 59 unit tests and 129 browser checks: status bar wording, quests following the plan, XP pop-up, streak lighting up, all quests done, undo taking XP back, locked and earned badges, insights unlocking a badge, goal stars, 200% text, reduced motion, offline.

**Open questions**
- Should a missed day be forgiven once a week (a "rest day"), so streaks feel less stressful?
- Should levels unlock something useful, such as new coin outfits or themes, rather than only titles?

**Housekeeping (same session):** while this work was in progress, another project, **Rungs** (a word-ladder game in `rungs/`), was merged into this branch. I put this session's commit on top of it; no LEFT files were touched. Because Vitest then also ran Rungs' Jest tests, `vite.config.ts` now limits LEFT's unit tests to `src/**/*.test.ts`.

---

## 5. Game redesign: RPG character sheet (21 Nov 2026)

**Feedback:** "I don't like the first design." I offered four directions with mock-ups (journey map, arcade, cosy pet, character sheet). **Mahdi chose the character sheet (RPG).**

**Added**
- `src/components/CharacterSheet.tsx`: Today is now your **character sheet**, a dark navy panel with a gold trim:
  - Header: coin avatar (wearing its outfit), name, "Lv 5 · Bill Boss", XP bar, streak flame. Tap → Trophies.
  - **Safe to spend today**, still the single big figure at the top, with £ left until payday and the payday date.
  - **Your £600, split into 4 stats**, each showing its plain name first and its game name second:
    - 🛡 Bills & essentials (Shield)
    - ⚔ Debt (Attack)
    - 💎 Savings (Treasure)
    - ⚡ Spending (Stamina)

    The bars fill to each stat's share of your cash. Tapping a stat opens its breakdown, the same as tapping a pot before. In a shortfall, the shield shows "cracked" and "£50 short".
  - 🍞 **Groceries left** (Supplies), its own labelled amount.
  - **Next encounter:** the next payment due.
- **Coin outfits** that unlock with levels: headband (Lv 2), hero's cape (Lv 3), golden crown (Lv 5), legend's glow (Lv 7). Shown in the avatar, the strip and a new **Outfits** section in Trophies.
- **Quest cards:** the three daily quests are now cards labelled "Quest". They **flip over** to a gold ✓ side when done. With Reduce motion they switch with no flip.
- **Compact character strip** at the top of Plan, Goals and Trophies.
- **Theme:** parchment background, storybook serif headings, gold primary buttons, a dark navy tab bar with gold for the active tab, and a purple insights card styled as an oracle.

**Removed**
- The first game look: the plain XP bar across the top of Today, the green chunky buttons, and the vertical quest checklist.
- `Pots.tsx` (four jars) and `Summary.tsx` (ring + bars): the four stats now do both jobs, so Today has less repetition. Their old CSS was deleted too.

**Why**
- **Plain words before game words** ("Bills & essentials" before "Shield"), so someone new to budgeting is never confused by the metaphor.
- **One panel instead of three** (sheet replaces hero + summary + pots): less scrolling and one clear place to look.
- **The maths is untouched.** Every figure and test from the spec table still matches.

**Bug found:** an old `.pot-fill` rule (absolute positioning) pushed the new stat bars over the sample banner and blocked its buttons. Deleting the leftover pot CSS fixed it.

**Checked:** 59 unit tests and 130 browser checks: stats add up to £600, next encounter, outfits unlocked or locked, the cards flipping, shortfall, 200% text, reduced motion, offline.

**Open questions**
- Should the stats use game names first once someone has used LEFT for a while?
- Should outfits be choosable (wear any unlocked one) rather than automatic?

---

## 6. A/B test: plain names first vs game names first (21 Nov 2026)

**Idea (Mahdi):** game names may be easy for Mahdi but hard for others, so test both with people.

**Added**
- Setting `statNames`: **Version A** shows plain names first ("Bills & essentials", with "Shield" small underneath). **Version B** shows game names first ("Shield", with "Bills & essentials" underneath). It also switches "Groceries left"/"Supplies left" and "Next payment"/"Next encounter".
- **Link switch:** `?v=a` or `?v=b`, so one link can be shared per version. It applies once and is then removed from the address.
- Settings → *Usability test: stat names*.
- The top chip shows **Sample · A** or **Sample · B**, so the facilitator always knows which version is on screen.
- Screen readers hear both names in either version, for example "Shield, Bills & essentials: £350".
- `docs/ab-test.md`: 5-minute script, 5 task questions, 3 follow-up questions, a record sheet and a decision rule.

**Changed:** the top bar is a little tighter, so "Sample · B" and ⚙ still fit on one line at 360px.

**Why:** a real test with 5+ people per version replaces our guesswork. Plain-first stays the default until the results say otherwise.

**Bug found:** after switching in Settings, a refresh brought the link's version back. Fixed by removing `?v=` from the address once it's been applied.

**Checked:** 59 unit tests and 136 browser checks, including both versions, same figures in each, switching, and surviving refresh.
