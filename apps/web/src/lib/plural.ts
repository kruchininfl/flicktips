// The Russian plural form for a count: plural(3, ['друг', 'друга', 'друзей']) -> 'друга'.
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// A big count the short Russian way: 940, 310 тыс., 1,2 млн.
export function compactCount(count: number): string {
  const short = (value: number) => (Math.round(value * 10) / 10).toString().replace('.', ',');
  if (count >= 1_000_000) return `${short(count / 1_000_000)} млн`;
  if (count >= 10_000) return `${Math.round(count / 1000)} тыс.`;
  if (count >= 1000) return `${short(count / 1000)} тыс.`;
  return String(count);
}
