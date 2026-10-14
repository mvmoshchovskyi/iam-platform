const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const formatDateTime = (value: string | Date | null | undefined): string =>
  value ? dateTime.format(new Date(value)) : '—';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export const formatRelative = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'just now';
};

export const displayName = (user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

export const initials = (user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) => {
  const fromName = [user.firstName, user.lastName].filter(Boolean).map((n) => n![0]);
  return (fromName.length ? fromName.join('') : user.email.slice(0, 2)).toUpperCase();
};
