function parseDateRangeString(dateRange) {
  if (!dateRange) return null;
  const parts = dateRange.split('—').map(s => s.trim());
  if (parts.length !== 2) return null;
  const from = new Date(parts[0] + ' GMT-0500');
  const toDate = new Date(parts[1] + ' GMT-0500');
  if (isNaN(from.getTime()) || isNaN(toDate.getTime())) return null;
  const toEndOfDay = new Date(toDate.getTime() + (23 * 3600 + 59 * 60 + 59) * 1000);
  return {
    from: Math.floor(from.getTime() / 1000),
    to: Math.floor(toEndOfDay.getTime() / 1000),
  };
}
const r = parseDateRangeString('Jan 20, 2026 — Mar 6, 2026');
console.log('from:', new Date(r.from * 1000).toISOString(), 'unix:', r.from);
console.log('to:  ', new Date(r.to * 1000).toISOString(), 'unix:', r.to);
