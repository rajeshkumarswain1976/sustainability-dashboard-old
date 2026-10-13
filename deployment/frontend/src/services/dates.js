const IST_OFFSET = 19800000;
export const istDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value);

export function snapshotLabel(offsetDays = 0, now = new Date()) {
  const date = new Date(now.getTime() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short',
    day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
}

export function snapshotAsOf(label, now = new Date()) {
  const selected = new Date(/^\d{4}-\d{2}-\d{2}$/.test(label)
    ? `${label}T23:00:00+05:30`
    : `${label.replace(/^[A-Za-z]{3} /, '')} 23:00:00 GMT+0530`);
  if (Number.isNaN(selected.getTime()) || istDate(selected) === istDate(now)) return now.toISOString();
  return selected.toISOString();
}

export function periodWindow(asOf, period) {
  const cutoff = new Date(asOf);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(cutoff);
  const year = Number(parts.find(item => item.type === 'year').value);
  const month = Number(parts.find(item => item.type === 'month').value) - 1;
  const midnight = (y, m, d) => new Date(Date.UTC(y, m, d) - IST_OFFSET);
  let start = new Date(cutoff.getTime() - 7 * 86400000), end = cutoff;
  if (period === 'Last week') { start = new Date(cutoff.getTime() - 14 * 86400000); end = new Date(cutoff.getTime() - 7 * 86400000); }
  else if (period === 'This month') start = midnight(year, month, 1);
  else if (period === 'Last month') { start = midnight(year, month - 1, 1); end = new Date(midnight(year, month, 1).getTime() - 1); }
  else if (period === 'This quarter') start = midnight(year, Math.floor(month / 3) * 3, 1);
  else if (period.startsWith('Year to date')) start = midnight(year, 0, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
