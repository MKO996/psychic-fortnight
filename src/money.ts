/** All money in LEFT is stored as integer pence. */
export type Pence = number;

const gbp2 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Format pence as GBP. Whole pounds drop ".00" unless `pennies` is true. */
export function money(p: Pence, opts: { pennies?: boolean } = {}): string {
  const v = Math.round(p);
  const neg = v < 0;
  const abs = Math.abs(v);
  const s = opts.pennies || abs % 100 !== 0 ? gbp2.format(abs / 100) : gbp0.format(abs / 100);
  return neg ? `−${s}` : s;
}

export function pounds(n: number): Pence {
  return Math.round(n * 100);
}

/** Parse what someone typed into a money field: "£1,200.50", "25", "25.5". Returns null when empty/invalid. */
export function parseMoneyInput(raw: string): Pence | null {
  const s = raw.replace(/[£,\s]/g, '').replace(/^gbp/i, '');
  if (s === '') return null;
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  return parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
}

/** Value for an input field (no £ sign, no trailing .00). */
export function moneyInputValue(p: Pence | null | undefined): string {
  if (p === null || p === undefined) return '';
  return p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2);
}
