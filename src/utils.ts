import * as Crypto from 'expo-crypto';

export const nowIso = () => new Date().toISOString();

export const todayDate = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const createId = () => Crypto.randomUUID();

export const emptyToNull = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim();
  return trimmed.length ? trimmed : null;
};

export const parseOptionalNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = (value ?? '').trim();
  if (!trimmed.length) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isValidDateString = (value: string | null | undefined) => {
  const text = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export type NormalizedDateInput = {
  value: string | null;
  error: string | null;
  changed: boolean;
};

const buildDate = (year: number, month: number, day: number) => {
  const fullYear = year < 100 ? 2000 + year : year;
  const normalized = `${String(fullYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDateString(normalized) ? normalized : null;
};

export const normalizeDateInput = (value: string | null | undefined): NormalizedDateInput => {
  const raw = (value ?? '').trim();
  if (!raw) return { value: null, error: null, changed: false };
  if (raw === '오늘') return { value: todayDate(), error: null, changed: raw !== todayDate() };
  if (isValidDateString(raw)) return { value: raw, error: null, changed: false };

  const korean = raw.match(/^(\d{2,4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
  if (korean) {
    const normalized = buildDate(Number(korean[1]), Number(korean[2]), Number(korean[3]));
    return normalized ? { value: normalized, error: null, changed: normalized !== raw } : { value: null, error: '존재하지 않는 날짜입니다.', changed: false };
  }

  const separated = raw.match(/^(\d{2,4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (separated) {
    const normalized = buildDate(Number(separated[1]), Number(separated[2]), Number(separated[3]));
    return normalized ? { value: normalized, error: null, changed: normalized !== raw } : { value: null, error: '존재하지 않는 날짜입니다.', changed: false };
  }

  const compact = raw.match(/^(\d{2}|\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const normalized = buildDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    return normalized ? { value: normalized, error: null, changed: normalized !== raw } : { value: null, error: '존재하지 않는 날짜입니다.', changed: false };
  }

  return { value: null, error: '날짜 형식을 확인해주세요.', changed: false };
};

export const dateAtHour = (value: string | null | undefined, hour = 9) => {
  if (!isValidDateString(value)) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day, hour, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const formatSeconds = (seconds: number | null | undefined) => {
  const safe = Math.max(0, seconds ?? 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

export const daysBetween = (fromDate: string, toDate: string) => {
  if (!isValidDateString(fromDate) || !isValidDateString(toDate)) return Number.NaN;
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
};

export const beanStatus = (expiryDate?: string | null, openedDate?: string | null) => {
  const today = todayDate();
  if (expiryDate) {
    const left = daysBetween(today, expiryDate);
    if (!Number.isFinite(left)) return '날짜 확인 필요';
    if (left < 0) return '유통기한 만료';
    if (left <= 7) return `유통기한 ${left}일`;
    if (left <= 30) return `임박 ${left}일`;
  }
  if (openedDate) {
    const days = daysBetween(openedDate, today);
    if (Number.isFinite(days) && days >= 0) return `개봉 후 ${days}일`;
    if (!Number.isFinite(days)) return '날짜 확인 필요';
  }
  return '신선함';
};
