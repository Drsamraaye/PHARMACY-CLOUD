/** Calendar-day helpers for the pharmacy's East Africa business timezone. */
export function businessDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function businessDateRecord(dateKey: string): Date { return new Date(`${dateKey}T00:00:00.000Z`); }

export function businessDateBounds(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Use a valid business date");
  const record = businessDateRecord(dateKey);
  if (Number.isNaN(record.getTime()) || record.toISOString().slice(0, 10) !== dateKey) throw new Error("Use a valid business date");
  // Nairobi stays at UTC+03:00 year-round. Keep the stored @db.Date key at UTC midnight.
  const start = new Date(`${dateKey}T00:00:00+03:00`);
  return { dateKey, record, start, end: new Date(start.getTime() + 86_400_000) };
}
