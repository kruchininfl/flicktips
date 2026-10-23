// Date formatting that replaces moment (+ 'ru' locale) of the legacy site, same output strings.
// Everything is computed in TIME_ZONE so the server render and the hydrated client render match.
import { TIME_ZONE } from './config';

const MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const MONTHS = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

interface Parts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
}

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

function parts(ms: number): Parts {
  const out: Record<string, number> = {};
  for (const p of partsFormat.formatToParts(new Date(ms))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { year: out.year!, month: out.month!, day: out.day!, hour: out.hour!, minute: out.minute! };
}

const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Parts, b: Parts) => a.year === b.year && a.month === b.month && a.day === b.day;

// Unix seconds (number or PDO string) to ms; 0 for empty values.
export function unixToMs(timestamp: number | string | null | undefined): number {
  const n = Number(timestamp);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 0;
}

// The year of a 'YYYY-MM-DD' / 'YYYY' date column, '' when there is none (moment(date).format('YYYY')).
export function yearOf(date: string | null | undefined): string {
  const match = date ? /^(\d{4})/.exec(date) : null;
  return match && Number(match[1]) > 0 ? match[1]! : '';
}

// "сегодня в 14:32", "вчера в 09:05", "12 окт. в 21:10", with the year once it's not the current one
export function formatVoteTime(timestamp: number, now = Date.now()): string {
  if (!timestamp) return '';
  const t = parts(timestamp * 1000);
  const today = parts(now);
  const time = `${pad(t.hour)}:${pad(t.minute)}`;

  if (sameDay(t, today)) return `сегодня в ${time}`;
  if (sameDay(t, parts(now - 24 * 3600 * 1000))) return `вчера в ${time}`;

  const date = `${t.day} ${MONTHS_SHORT[t.month - 1]}`;
  return t.year === today.year ? `${date} в ${time}` : `${date} ${t.year} в ${time}`;
}

const MONTHS_CARD = ['янв', 'февр', 'мар', 'апр', 'мая', 'июня', 'июля', 'авг', 'сент', 'окт', 'нояб', 'дек'];

// The redesign's vote time on cards: "сегодня, 21:40", "вчера, 18:05", "18 окт, 22:31", "3 мая 2025";
// `short` (phones) drops «сегодня»
export function formatCardTime(timestamp: number, now = Date.now(), short = false): string {
  if (!timestamp) return '';
  const t = parts(timestamp * 1000);
  const today = parts(now);
  const time = `${pad(t.hour)}:${pad(t.minute)}`;

  if (sameDay(t, today)) return short ? time : `сегодня, ${time}`;
  if (sameDay(t, parts(now - 24 * 3600 * 1000))) return `вчера, ${time}`;

  const date = `${t.day} ${MONTHS_CARD[t.month - 1]}`;
  return t.year === today.year ? `${date}, ${time}` : `${date} ${t.year}`;
}

// 'DD.MM.YY'
export function formatShortDate(ms: number): string {
  const t = parts(ms);
  return `${pad(t.day)}.${pad(t.month)}.${String(t.year).slice(-2)}`;
}

// moment 'LL' in ru: "12 октября 2020 г."
export function formatLongDate(ms: number): string {
  const t = parts(ms);
  return `${t.day} ${MONTHS[t.month - 1]} ${t.year} г.`;
}

// moment.duration(minutes, 'minutes').format('HH:mm') (moment-duration-format)
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// «2 ч 46 мин», «46 мин»
export function formatHoursMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

function plural(forms: [string, string, string], n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return forms[0];
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return forms[1];
  return forms[2];
}

// moment(time).from(now) in ru: "несколько секунд назад", "5 минут назад", "месяц назад", "через 2 дня"
export function timeAgo(ms: number, now = Date.now()): string {
  const diff = now - ms;
  const abs = Math.abs(diff);
  const seconds = Math.round(abs / 1000);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const months = Math.round(abs / (86_400_000 * 30.436875));
  const years = Math.round(abs / (86_400_000 * 365.2425));

  let text: string;
  // moment's thresholds: 45 s, 45 min, 22 h, 26 days, 11 months
  if (seconds < 45) text = 'несколько секунд';
  else if (minutes <= 1) text = 'минуту';
  else if (minutes < 45) text = `${minutes} ${plural(['минуту', 'минуты', 'минут'], minutes)}`;
  else if (hours <= 1) text = 'час';
  else if (hours < 22) text = `${hours} ${plural(['час', 'часа', 'часов'], hours)}`;
  else if (days <= 1) text = 'день';
  else if (days < 26) text = `${days} ${plural(['день', 'дня', 'дней'], days)}`;
  else if (months <= 1) text = 'месяц';
  else if (months < 11) text = `${months} ${plural(['месяц', 'месяца', 'месяцев'], months)}`;
  else if (years <= 1) text = 'год';
  else text = `${years} ${plural(['год', 'года', 'лет'], years)}`;

  return diff >= 0 ? `${text} назад` : `через ${text}`;
}
