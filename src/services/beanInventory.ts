import { Bean, BeanDefaultSetting, BrewLog, CoffeePurchaseLot } from '../types/models';
import { daysBetween, isValidDateString, todayDate } from '../utils';

export type FreshnessBand = 'unknown' | 'resting' | 'stabilizing' | 'peak' | 'consume' | 'urgent' | 'old';
export type FreshnessTone = 'danger' | 'warning' | 'good' | 'neutral';

export type RoastWindow = { start: number; end: number; label: string };

export interface FreshnessInfo {
  band: FreshnessBand;
  title: string;
  detail: string;
  daysSinceRoast: number | null;
  daysSinceOpen: number | null;
  freshUntilDate: string | null;
  daysUntilFreshEnd: number | null;
  priority: number;
  label: string;
  shortLabel: string;
  compactMeta: string;
  tone: FreshnessTone;
  actionText: string;
  window: RoastWindow;
}

const roastWindow = (roastLevel: string | null | undefined): RoastWindow => {
  const text = (roastLevel ?? '').toLowerCase();
  if (text.includes('light') || text.includes('약')) return { start: 10, end: 28, label: '약배전 10-28일' };
  if (text.includes('dark') || text.includes('강')) return { start: 4, end: 14, label: '강배전 4-14일' };
  return { start: 7, end: 21, label: '중배전 기준 7-21일' };
};

const addDays = (dateText: string | null | undefined, days: number) => {
  if (!isValidDateString(dateText)) return null;
  const [year, month, day] = String(dateText).split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const minDate = (dates: Array<string | null | undefined>) => {
  const valid = dates.filter((date): date is string => isValidDateString(date));
  if (!valid.length) return null;
  return valid.sort()[0];
};

const freshnessDueLabel = (daysUntilFreshEnd: number | null) => {
  if (daysUntilFreshEnd == null) return null;
  if (daysUntilFreshEnd > 0) return `신선일 D-${daysUntilFreshEnd}`;
  if (daysUntilFreshEnd === 0) return '신선일 오늘';
  return `신선일 지남 +${Math.abs(daysUntilFreshEnd)}일`;
};

const openAgeLabel = (daysSinceOpen: number | null) => daysSinceOpen == null ? null : `개봉 +${daysSinceOpen}일`;

const freshnessCompactDueLabel = (daysUntilFreshEnd: number | null) => {
  if (daysUntilFreshEnd == null) return null;
  if (daysUntilFreshEnd > 0) return `신선일 ${daysUntilFreshEnd}일 남음`;
  if (daysUntilFreshEnd === 0) return '신선일 오늘';
  return `신선일 +${Math.abs(daysUntilFreshEnd)}일 지남`;
};

const freshnessSummary = (band: FreshnessBand, priority: number): { shortLabel: string; tone: FreshnessTone } => {
  if (band === 'old') return { shortLabel: '정리 필요', tone: 'danger' };
  if (priority >= 82) return { shortLabel: '우선 소비', tone: 'danger' };
  if (priority >= 58 || band === 'consume') return { shortLabel: '곧 소비', tone: 'warning' };
  if (band === 'peak') return { shortLabel: '피크', tone: 'good' };
  if (band === 'resting' || band === 'stabilizing') return { shortLabel: '휴지 중', tone: 'neutral' };
  return { shortLabel: '날짜 확인', tone: 'neutral' };
};

export const getFreshnessInfo = (bean: Bean, today = todayDate()): FreshnessInfo => {
  const window = roastWindow(bean.roastLevel);
  const daysSinceRoastRaw = bean.roastDate && isValidDateString(bean.roastDate) ? daysBetween(bean.roastDate, today) : Number.NaN;
  const daysSinceOpenRaw = bean.openedDate && isValidDateString(bean.openedDate) ? daysBetween(bean.openedDate, today) : Number.NaN;
  const daysSinceRoast = Number.isFinite(daysSinceRoastRaw) && daysSinceRoastRaw >= 0 ? daysSinceRoastRaw : null;
  const daysSinceOpen = Number.isFinite(daysSinceOpenRaw) && daysSinceOpenRaw >= 0 ? daysSinceOpenRaw : null;
  const roastFreshEnd = bean.roastDate && isValidDateString(bean.roastDate) ? addDays(bean.roastDate, window.end) : null;
  const openFreshEnd = bean.openedDate && isValidDateString(bean.openedDate) ? addDays(bean.openedDate, 21) : null;
  const freshUntilDate = minDate([roastFreshEnd, openFreshEnd, bean.expiryDate]);
  const daysUntilFreshEndRaw = freshUntilDate ? daysBetween(today, freshUntilDate) : Number.NaN;
  const daysUntilFreshEnd = Number.isFinite(daysUntilFreshEndRaw) ? daysUntilFreshEndRaw : null;
  const dueLabel = freshnessDueLabel(daysUntilFreshEnd);
  const openLabel = openAgeLabel(daysSinceOpen);
  const label = [dueLabel, openLabel].filter(Boolean).join(' · ') || (daysSinceRoast == null ? '신선도 확인 필요' : `로스팅 +${daysSinceRoast}일`);

  let band: FreshnessBand = 'unknown';
  let title = '로스팅일 미입력';
  let detail = `맛있는 기간은 보통 ${window.label}을 참고합니다.`;
  let actionText = '로스팅일과 개봉일을 입력하면 소비 우선순위를 계산합니다.';
  let priority = 10;

  if (bean.expiryDate && isValidDateString(bean.expiryDate) && daysBetween(today, bean.expiryDate) < 0) {
    band = 'old';
    title = '유통기한 만료';
    detail = '유통기한이 지났습니다. 상태를 확인하고 정리하거나 빠르게 소비하세요.';
    actionText = '상태 확인 후 정리';
    priority = 100;
  } else if (daysSinceOpen != null && daysSinceOpen >= 30) {
    band = 'old';
    title = `개봉 +${daysSinceOpen}일`;
    detail = '개봉 후 시간이 많이 지나 향 감소가 체감될 수 있습니다.';
    actionText = '우유 음료나 빠른 소비';
    priority = 98;
  } else if (daysSinceRoast != null && daysSinceRoast >= 40) {
    band = 'old';
    title = `로스팅 +${daysSinceRoast}일`;
    detail = '로스팅 후 시간이 많이 지나 향 감소가 체감될 수 있습니다.';
    actionText = '빠르게 소비하거나 보관 상태 확인';
    priority = 96;
  } else if (daysSinceOpen != null && daysSinceOpen >= 21) {
    band = 'urgent';
    title = `개봉 +${daysSinceOpen}일`;
    detail = '개봉 후 우선 소비 구간입니다.';
    actionText = '이번 주 안에 먼저 마시기';
    priority = 90;
  } else if (daysUntilFreshEnd != null && daysUntilFreshEnd < 0) {
    band = 'consume';
    title = dueLabel ?? '신선일 지남';
    detail = '권장 신선일을 지났습니다. 같은 세팅에서 추출 시간이 빨라지는지 보세요.';
    actionText = '다음 원두보다 먼저 소비';
    priority = 82;
  } else if (daysSinceOpen != null && daysSinceOpen >= 14) {
    band = 'consume';
    title = `개봉 +${daysSinceOpen}일`;
    detail = '개봉 후 소비 권장 구간입니다.';
    actionText = '열린 원두부터 마시기';
    priority = 78;
  } else if (daysUntilFreshEnd != null && daysUntilFreshEnd <= 7 && freshUntilDate === bean.expiryDate) {
    band = 'consume';
    title = dueLabel ?? '신선일 임박';
    detail = '유통기한이 가까워졌습니다.';
    actionText = '곧 소비';
    priority = 68;
  } else if (daysSinceRoast == null) {
    band = 'unknown';
  } else if (daysSinceRoast <= 3) {
    band = 'resting';
    title = `로스팅 +${daysSinceRoast}일`;
    detail = '디개싱 초기라 샷 편차가 클 수 있습니다.';
    actionText = '하루 이틀 쉬고 비교';
    priority = 20;
  } else if (daysSinceRoast <= 7) {
    band = 'stabilizing';
    title = `로스팅 +${daysSinceRoast}일`;
    detail = '안정화 중입니다. 같은 세팅 반복 기록이 도움이 됩니다.';
    actionText = '세팅 변화 작게';
    priority = 30;
  } else if (daysSinceRoast >= window.start && daysSinceRoast <= window.end) {
    band = 'peak';
    title = `로스팅 +${daysSinceRoast}일`;
    detail = `맛있는 구간 후보입니다. 참고값: ${window.label}.`;
    actionText = daysUntilFreshEnd != null && daysUntilFreshEnd <= 7 ? '피크 구간 먼저 즐기기' : '좋은 세팅 기록';
    priority = daysUntilFreshEnd != null && daysUntilFreshEnd <= 7 ? 62 : 45;
  } else if (daysUntilFreshEnd != null && daysUntilFreshEnd <= 7) {
    band = 'consume';
    title = dueLabel ?? '신선일 임박';
    detail = '맛있게 마시기 좋은 마지막 구간에 가까워졌습니다.';
    actionText = '곧 소비';
    priority = 68;
  } else {
    band = 'consume';
    title = `로스팅 +${daysSinceRoast}일`;
    detail = '소비 권장 구간입니다. 같은 세팅에서 추출 시간이 빨라지는지 보세요.';
    actionText = '먼저 소비 후보';
    priority = 58;
  }

  const { shortLabel, tone } = freshnessSummary(band, priority);
  const compactMeta = [
    freshnessCompactDueLabel(daysUntilFreshEnd),
    daysSinceOpen == null ? null : `개봉 ${daysSinceOpen}일차`,
    daysSinceOpen == null && daysSinceRoast != null ? `로스팅 ${daysSinceRoast}일차` : null,
  ].filter(Boolean).slice(0, 2).join(' · ') || title;

  return {
    band,
    title,
    detail,
    daysSinceRoast,
    daysSinceOpen,
    freshUntilDate,
    daysUntilFreshEnd,
    priority,
    label,
    shortLabel,
    compactMeta,
    tone,
    actionText,
    window,
  };
};

export const getFreshnessPriority = (bean: Bean, today = todayDate()) => getFreshnessInfo(bean, today).priority;

export const roundGram = (value: number) => Math.round(value * 10) / 10;

export const getBrewLogDoseGram = (log: BrewLog | Pick<BrewLog, 'actualDoseGram' | 'doseGram'>) => {
  const parsed = Number(log.actualDoseGram ?? log.doseGram ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getLotDisplayRemainingGram = (lot: Pick<CoffeePurchaseLot, 'initialWeightGram' | 'remainingWeightGram'>, logsForLot: Array<Pick<BrewLog, 'actualDoseGram' | 'doseGram'>>) => {
  if (lot.remainingWeightGram != null) return roundGram(Math.max(0, Number(lot.remainingWeightGram)));
  if (lot.initialWeightGram == null) return null;
  const usedGram = logsForLot.reduce((sum, log) => sum + getBrewLogDoseGram(log), 0);
  return roundGram(Math.max(0, Number(lot.initialWeightGram) - usedGram));
};

export const getUsageInfo = (bean: Bean, logs: BrewLog[], setting?: BeanDefaultSetting | null) => {
  const beanLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === bean.id);
  const usedGram = beanLogs.reduce((sum, log) => sum + getBrewLogDoseGram(log), 0);
  const calculatedRemaining = bean.initialWeightGram == null ? null : Math.max(0, bean.initialWeightGram - usedGram);
  const displayRemaining = getLotDisplayRemainingGram(bean, beanLogs);
  const recentLog = [...beanLogs].sort((a, b) => b.brewedAt.localeCompare(a.brewedAt))[0];
  const recentDose = recentLog?.actualDoseGram
    ?? recentLog?.doseGram
    ?? setting?.doseGram
    ?? 18;
  const estimatedCups = displayRemaining == null || recentDose <= 0 ? null : Math.floor(displayRemaining / recentDose);
  return {
    usedGram: roundGram(usedGram),
    calculatedRemaining: calculatedRemaining == null ? null : roundGram(calculatedRemaining),
    displayRemaining,
    estimatedCups,
    doseBasis: recentDose,
    manualOverride: bean.remainingWeightGram != null,
    logCount: beanLogs.length,
  };
};

export const getRepeatPurchaseInfo = (bean: Bean, beans: Bean[]) => {
  const group = beans
    .filter(item => item.productId && item.productId === bean.productId)
    .sort((a, b) => (a.purchaseDate ?? a.createdAt).localeCompare(b.purchaseDate ?? b.createdAt));
  const index = group.findIndex(item => item.id === bean.id);
  return { index: index >= 0 ? index + 1 : 1, count: group.length || 1 };
};
