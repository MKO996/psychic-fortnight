/**
 * A small local parser for LEFT's talk-or-type box. No network, no AI.
 * Turns plain sentences into proposed changes that the person checks before applying.
 */
import type { Pence } from './money';
import type { Plan } from './types';

export type Change =
  | { type: 'setCash'; amount: Pence | null }
  | { type: 'setEssential'; id: string; name: string; amount: Pence | null }
  | { type: 'addBill'; name: string; amount: Pence | null }
  | { type: 'billPaid'; billId: string | null; name: string; amount: Pence | null }
  | { type: 'spend'; amount: Pence | null; category: string | null; note: string }
  | { type: 'income'; amount: Pence | null; note: string }
  | { type: 'afford'; amount: Pence | null; note: string }
  | { type: 'goalSaved'; goalId: string | null; name: string; amount: Pence | null }
  | { type: 'addGoal'; name: string; amount: Pence | null }
  | { type: 'addDebt'; name: string; amount: Pence | null };

export interface ParseResult {
  changes: Change[];
  /** Short follow-up question when something is missing or unclear. */
  followUp: string | null;
  understood: boolean;
}

const UNITS: Record<string, number> = {
  zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, grand: 1000 };

function isNumWord(w: string) {
  return w in UNITS || w in TENS || w in SCALES || w === 'and';
}

/** "twenty-five" → "25", "two hundred and fifty" → "250", "a thousand" → "1000". */
export function wordsToDigits(text: string): string {
  const tokens = text.replace(/-/g, ' ').split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const w = tokens[i].toLowerCase().replace(/[^a-z]/g, '');
    const trail = tokens[i].match(/[^a-zA-Z]+$/)?.[0] ?? '';
    const startsNumber = (w in UNITS && !(w === 'a' || w === 'an')) || w in TENS || ((w === 'a' || w === 'an') && nextWordIs(tokens, i, ['hundred', 'thousand', 'grand']));
    if (!startsNumber) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    let total = 0;
    let current = 0;
    let j = i;
    let lastTrail = '';
    let consumedUntil = i;
    while (j < tokens.length) {
      if (/^\s+$/.test(tokens[j])) { j++; continue; }
      const word = tokens[j].toLowerCase().replace(/[^a-z]/g, '');
      if (!isNumWord(word)) break;
      if (word === 'and') {
        // only part of the number if a number word follows
        if (!nextWordIs(tokens, j, Object.keys(UNITS).concat(Object.keys(TENS)))) break;
      } else if (word in UNITS) current += UNITS[word];
      else if (word in TENS) current += TENS[word];
      else if (word === 'hundred') current = (current || 1) * 100;
      else { total += (current || 1) * SCALES[word]; current = 0; }
      lastTrail = tokens[j].match(/[^a-zA-Z]+$/)?.[0] ?? '';
      consumedUntil = j;
      j++;
      if (lastTrail) break; // punctuation ends the number
    }
    out.push(String(total + current) + (lastTrail || (consumedUntil === i ? trail : '')));
    i = consumedUntil + 1;
  }
  return out.join('');
}

function nextWordIs(tokens: string[], i: number, words: string[]): boolean {
  for (let k = i + 1; k < tokens.length; k++) {
    if (/^\s+$/.test(tokens[k])) continue;
    return words.includes(tokens[k].toLowerCase().replace(/[^a-z]/g, ''));
  }
  return false;
}

interface Amount { pence: Pence; index: number; end: number }

/** Find money amounts: "£25", "£1,200.50", "25 pounds", "25 quid", "25 pounds 50", "50p", "£25.50". */
export function findAmounts(raw: string): Amount[] {
  const text = wordsToDigits(raw);
  const re = /£\s?(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(pounds?|quid|gbp|p\b|pence)(?:\s+(?:and\s+)?(\d{1,2})(?:\s*(?:p|pence))?\b)?|(\d[\d,]*(?:\.\d{1,2})?)/gi;
  const out: Amount[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let pence: number;
    if (m[1] !== undefined) pence = toPence(m[1]);
    else if (m[2] !== undefined) {
      const unit = m[3].toLowerCase();
      if (unit === 'p' || unit === 'pence') pence = Math.round(parseFloat(m[2].replace(/,/g, '')));
      else pence = toPence(m[2]) + (m[4] ? parseInt(m[4], 10) : 0);
    } else {
      // bare number: only accept if it looks like money in context (handled by caller via `bare`)
      pence = toPence(m[5]);
      (out as (Amount & { bare?: boolean })[]).push({ pence, index: m.index, end: m.index + m[0].length, bare: true } as Amount & { bare: boolean });
      continue;
    }
    out.push({ pence, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

function toPence(s: string): Pence {
  const [w, f = ''] = s.replace(/,/g, '').split('.');
  return parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
}

const GROCERY = /\b(groceries|grocery|food shop|food|shopping|supermarket|tesco|aldi|lidl|asda|sainsbury'?s?)\b/i;
const TRANSPORT = /\b(transport|travel|bus|buses|train|trains|fuel|petrol|diesel|fares?|taxi|uber|tube|metro|oyster)\b/i;
const BILL_WORDS = /\b(rent|phone|mobile|electric(ity)?|gas|energy|water|council tax|internet|broadband|wifi|insurance|tv licen[cs]e|childcare|subscription)\b/i;
const DEBT_WORDS = /\b(credit card|card|loan|overdraft|klarna|catalogue|debt|mortgage)\b/i;

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanNote(s: string) {
  return s.replace(/^(a|an|the|my|some)\s+/i, '').replace(/[?.!,]+$/, '').trim();
}

/** Match a name against existing items by shared meaningful words. */
function matchItem<T extends { id: string; name: string }>(items: T[], text: string): T | null {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const stop = new Set(['my', 'the', 'a', 'an', 'for', 'to', 'into', 'in', 'on', 'bill', 'pot', 'i', 'paid', 'saved', 'moved', 'put', 'and', 'of', 'savings', 'fund']);
  let best: T | null = null;
  let bestScore = 0;
  for (const it of items) {
    const nameWords = (it.name.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => !stop.has(w));
    const score = nameWords.filter((w) => words.some((x) => x === w || (x.length > 3 && w.startsWith(x)) || (w.length > 3 && x.startsWith(w)))).length;
    if (score > bestScore) { best = it; bestScore = score; }
  }
  return best;
}

type Verb = 'have' | 'need' | 'spent' | 'paidIncome' | 'afford' | 'paidBill' | 'saved' | 'owe' | 'savingFor' | null;

function detectVerb(c: string): Verb {
  const s = c.toLowerCase();
  if (/\b(can|could|should) i (spend|afford|buy|get|have)\b|\bafford\b|\bis it ok(ay)? to (spend|buy)\b/.test(s)) return 'afford';
  if (/\b(got paid|been paid|i was paid|received|earned|got my (wage|wages|pay)|pay(day)? came|paid me|wages? (came|arrived))\b/.test(s)) return 'paidIncome';
  if (/\b(spent|spend|bought|paid for|cost me)\b/.test(s) && !/\bbill\b/.test(s) && !BILL_WORDS.test(s)) return 'spent';
  if (/\b(saved|moved|put|transferred|added)\b/.test(s) && /\b(to|into|in|towards)\b/.test(s)) return 'saved';
  if (/\b(paid|pay off|cleared)\b/.test(s)) return 'paidBill';
  if (/\b(saving for|save for|saving up|want to save|goal)\b/.test(s)) return 'savingFor';
  if (/\b(owe|in debt|balance)\b/.test(s)) return 'owe';
  if (/\b(i have|i've got|ive got|i got|have got|there is|there's|in my (account|bank)|available|left in)\b/.test(s)) return 'have';
  if (/\b(need|budget|set aside|for groceries|for food|for travel|for transport)\b/.test(s)) return 'need';
  return null;
}

/** Split into clauses on sentence ends, "and", "but", commas and "then". */
function clauses(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|,\s*|\s+(?:and|but|then|plus|also)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseUtterance(input: string, plan: Plan): ParseResult {
  const text = input.trim();
  const changes: Change[] = [];
  if (!text) return { changes, followUp: 'Say or type what changed, for example “I spent £25 on groceries”.', understood: false };

  const whole = detectVerb(text);
  if (whole === 'afford') {
    const a = findAmounts(text)[0];
    const what = text.match(/\bon (.+?)\??$/i)?.[1] ?? text.match(/\b(?:buy|get|have) (?:a |an |some )?(.+?)(?: for| \?|\?|$)/i)?.[1] ?? '';
    changes.push({ type: 'afford', amount: a ? a.pence : null, note: cleanNote(what) });
    return { changes, followUp: a ? null : 'How much would it cost?', understood: true };
  }

  let verb: Verb = null;
  for (const c of clauses(text)) {
    const v: Verb = detectVerb(c) ?? verb;
    verb = v;
    const amts = findAmounts(c);
    const strong = amts.filter((a) => !(a as Amount & { bare?: boolean }).bare);
    const amount = (strong[0] ?? amts[0])?.pence ?? null;
    const lower = c.toLowerCase();

    if (v === 'paidIncome') {
      const note = c.match(/\bfor (?:a |an |my |the )?(.+?)[.!?]?$/i)?.[1] ?? c.match(/\bfrom (.+?)[.!?]?$/i)?.[1] ?? 'Income';
      changes.push({ type: 'income', amount, note: cleanNote(note) });
      continue;
    }
    if (v === 'spent') {
      let category: string | null = null;
      if (GROCERY.test(c)) category = 'groceries';
      else if (TRANSPORT.test(c)) category = 'transport';
      else {
        const ess = matchItem(plan.essentials, c);
        if (ess) category = ess.id;
      }
      const onWhat = c.match(/\b(?:on|for) (.+?)[.!?]?$/i)?.[1];
      if (!category && onWhat && !/^\d/.test(onWhat)) category = 'other';
      changes.push({ type: 'spend', amount, category, note: onWhat && !/^£?\d/.test(onWhat) ? cleanNote(onWhat) : '' });
      continue;
    }
    if (v === 'saved') {
      const g = matchItem(plan.goals, c);
      changes.push({ type: 'goalSaved', goalId: g?.id ?? null, name: g?.name ?? '', amount });
      continue;
    }
    if (v === 'paidBill') {
      const b = matchItem(plan.bills, c);
      if (b) { changes.push({ type: 'billPaid', billId: b.id, name: b.name, amount }); continue; }
      changes.push({ type: 'billPaid', billId: null, name: '', amount });
      continue;
    }
    if (v === 'savingFor') {
      const name = c.match(/\b(?:saving for|save for|saving up for|goal is|goal) (?:a |an |my |the )?(.+?)(?: of| target| £| \d|[.!?]|$)/i)?.[1];
      changes.push({ type: 'addGoal', name: name ? titleCase(cleanNote(name)) : 'Savings goal', amount });
      continue;
    }
    if (v === 'owe' && DEBT_WORDS.test(c)) {
      const name = c.match(DEBT_WORDS)?.[0] ?? 'Debt';
      changes.push({ type: 'addDebt', name: titleCase(name), amount });
      continue;
    }
    // Essentials and bills mentioned with an amount ("£80 for groceries", "rent is £220")
    if (GROCERY.test(c) && amount !== null) { changes.push({ type: 'setEssential', id: 'groceries', name: 'Groceries', amount }); continue; }
    if (TRANSPORT.test(c) && amount !== null) { changes.push({ type: 'setEssential', id: 'transport', name: 'Transport', amount }); continue; }
    if (BILL_WORDS.test(c) && amount !== null) {
      const existing = matchItem(plan.bills, c);
      const word = c.match(BILL_WORDS)![0];
      changes.push(existing ? { type: 'addBill', name: existing.name, amount } : { type: 'addBill', name: titleCase(word) + (/rent|council/i.test(word) ? '' : ' bill'), amount });
      continue;
    }
    if (v === 'have' && amount !== null) { changes.push({ type: 'setCash', amount }); continue; }
    if (v === 'have' && /\bnow\b/.test(lower)) { changes.push({ type: 'setCash', amount: null }); continue; }
  }

  const followUp = followUpFor(changes);
  return { changes, followUp, understood: changes.length > 0 };
}

export function followUpFor(changes: Change[]): string | null {
  if (!changes.length) return 'Sorry, I didn’t catch that. Try “I spent £25 on groceries” or pick an example.';
  for (const c of changes) {
    if (c.amount === null) {
      if (c.type === 'spend') return 'How much did you spend?';
      if (c.type === 'income') return 'How much did you get paid?';
      if (c.type === 'setCash') return 'How much money do you have now?';
      if (c.type === 'goalSaved') return 'How much did you move into savings?';
      if (c.type === 'billPaid') return null; // pays the rest of the bill
      return 'How much is it?';
    }
    if (c.type === 'spend' && c.category === null) return 'What was it for?';
    if (c.type === 'billPaid' && c.billId === null) return 'Which bill did you pay?';
    if (c.type === 'goalSaved' && c.goalId === null) return 'Which pot did you put it in?';
  }
  return null;
}

export const EXAMPLES = [
  'Can I spend £25 on a takeaway?',
  'I spent twenty-five pounds on groceries',
  'I got paid £200 for a shift',
  'I paid my phone bill',
  'I have £600 now. I need £80 for groceries and £20 for travel',
];
