import type { Pence } from './money';
import type { ISODate } from './dates';

export type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'irregular';
/** filled = has items; none = person said None; later = "I'll add this later"; open = not answered yet. */
export type SectionState = 'filled' | 'none' | 'later' | 'open';
export type SectionKey = 'income' | 'bills' | 'essentials' | 'debts' | 'goals';

export interface Income {
  id: string;
  name: string;
  amount: Pence | null;
  frequency: PayFrequency;
  nextDate: ISODate | null;
}

export interface Bill {
  id: string;
  name: string;
  amount: Pence | null;
  dueDate: ISODate | null;
  /** Paid so far in this pay period (base value; logged payments are added on top). */
  paid: Pence;
  /** For a bill due after payday: how much to put aside from this pay. */
  reserveNow: Pence | null;
  /** Money already put aside for this bill in earlier pay periods (still in your cash). */
  heldSoFar: Pence;
}

export interface Essential {
  id: string; // 'groceries' | 'transport' | custom
  name: string;
  budget: Pence | null;
  spent: Pence;
}

export type Known = 'none' | 'charged' | 'unknown';

export interface Debt {
  id: string;
  name: string;
  kind: 'card' | 'loan' | 'mortgage' | 'other';
  balance: Pence | null;
  minimum: Pence | null;
  dueDate: ISODate | null;
  minimumPaid: Pence;
  /** Optional extra payment (or mortgage overpayment) wanted from this pay. */
  extraRequested: Pence;
  extraPaid: Pence;
  interest: Known;
  fees: Known;
}

export interface Goal {
  id: string;
  name: string;
  target: Pence | null;
  /** Saved already and held separately (not part of cash). */
  saved: Pence;
  priority: number; // 1 = first
  deadline: ISODate | null;
  /** Wanted from this pay. */
  contribution: Pence;
  /** Already moved in this pay period (base value). */
  savedThisPeriod: Pence;
}

export type Entry =
  | { id: string; at: string; kind: 'spend'; amount: Pence; category: string; note: string }
  | { id: string; at: string; kind: 'income'; amount: Pence; note: string }
  | { id: string; at: string; kind: 'billPaid'; amount: Pence; billId: string }
  | { id: string; at: string; kind: 'debtPaid'; amount: Pence; debtId: string; part: 'minimum' | 'extra' }
  | { id: string; at: string; kind: 'goalSaved'; amount: Pence; goalId: string };

export interface Plan {
  version: 1;
  kind: 'sample' | 'personal';
  /** Sample plans keep their dates relative to this date and shift them to today. */
  anchor: ISODate;
  /** Cash the person confirms they can use now (no credit limits, no savings pots). */
  cash: Pence | null;
  frequency: PayFrequency | null;
  nextPayday: ISODate | null;
  paydayUnknown: boolean;
  reviewDate: ISODate | null;
  /** If false (default), bills due ON payday are covered from this money. */
  payArrivesBeforeBills: boolean;
  incomes: Income[];
  bills: Bill[];
  essentials: Essential[];
  debts: Debt[];
  goals: Goal[];
  sections: Record<SectionKey, SectionState>;
  entries: Entry[];
  confirmed: boolean;
  /** Logged entries from earlier pay periods, kept for insights (about 4 months). */
  history?: Entry[];
  profile?: Profile;
}

export type Focus = 'runningOut' | 'bills' | 'debt' | 'saving' | 'whereItGoes';

/** What LEFT knows about the person, all chosen by tapping. Used to personalise insights. */
export interface Profile {
  name: string;
  focus: Focus | null;
  household: 'alone' | 'partner' | 'children' | 'sharing' | null;
  /** Things they often spend on: become one-tap choices in Quick add. */
  spendsOn: string[];
  detail: 'simple' | 'detailed';
}
