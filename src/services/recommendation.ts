import { Bean, BeanDefaultSetting, BrewLog } from '../types/models';
import { daysBetween, todayDate } from '../utils';

export interface DialInRecommendation {
  title: string;
  summary: string;
  action: string;
  target: string;
  reason: string;
  confidence: '낮음' | '보통' | '높음';
  nextGrindSize: string | null;
  beginnerTip: string;
  warnings: string[];
}

const n = (value: number | null | undefined) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const optionalSeconds = (value: number | null | undefined) => value == null ? '시간 미입력' : `${value.toFixed(1)}초`;
const optionalRating = (value: number | null | undefined) => value == null ? '평점 미입력' : `${value}점`;
const optionalGrind = (value: string | number | null | undefined) => value == null || value === '' ? '분쇄도 미입력' : `분쇄도 ${value}`;

const numericGrindStep = (grindSize: string | null | undefined, direction: 'finer' | 'coarser') => {
  const parsed = Number(String(grindSize ?? '').trim());
  if (!Number.isFinite(parsed)) return null;
  const next = direction === 'finer' ? parsed - 1 : parsed + 1;
  return `${next}`;
};

const timeSignal = (brewTime: number | null) => {
  if (brewTime == null) return 'unknown';
  if (brewTime < 23) return 'fast';
  if (brewTime > 33) return 'slow';
  return 'target';
};

const tasteSignal = (log: BrewLog) => {
  const sour = (n(log.acidity) ?? 0) >= 4 && (n(log.sweetness) ?? 0) <= 3;
  const bitter = (n(log.bitterness) ?? 0) >= 4;
  const thin = (n(log.body) ?? 0) > 0 && (n(log.body) ?? 0) <= 2;
  const good = (n(log.rating) ?? 0) >= 4;
  return { sour, bitter, thin, good };
};

export const getOpenAgeDays = (bean: Bean) => {
  if (!bean.openedDate) return null;
  const days = daysBetween(bean.openedDate, todayDate());
  return Number.isFinite(days) ? days : null;
};

export const getRestAgeDays = (bean: Bean) => {
  if (!bean.roastDate) return null;
  const days = daysBetween(bean.roastDate, todayDate());
  return Number.isFinite(days) ? days : null;
};

export const getDialInRecommendation = (
  bean: Bean | null | undefined,
  logs: BrewLog[],
  defaultSetting?: BeanDefaultSetting | null
): DialInRecommendation => {
  if (!bean) {
    return {
      title: '원두를 먼저 선택하세요',
      summary: '추천은 원두의 최근 샷과 개봉일을 기준으로 계산합니다.',
      action: '원두를 등록하고 첫 샷을 기록하세요.',
      target: '18g in / 36g out / 25-30초',
      reason: '초보자는 변수를 하나씩만 바꾸는 것이 가장 안전합니다.',
      confidence: '낮음',
      nextGrindSize: null,
      beginnerTip: '처음에는 도징량과 추출량을 고정하고 분쇄도만 움직여 보세요.',
      warnings: [],
    };
  }

  const sorted = logs.filter(log => (log.purchaseLotId ?? log.beanId) === bean.id).sort((a, b) => b.brewedAt.localeCompare(a.brewedAt));
  const last = sorted[0];
  const best = sorted.find(log => log.isFavorite) ?? sorted.find(log => (log.rating ?? 0) >= 4);
  const openAge = getOpenAgeDays(bean);
  const restAge = getRestAgeDays(bean);
  const baseGrind = last?.grindSize ?? defaultSetting?.grindSize ?? null;
  const dose = n(last?.doseGram) ?? n(defaultSetting?.doseGram) ?? 18;
  const targetYield = Math.round(dose * 2 * 10) / 10;
  const targetText = `${dose}g in / ${targetYield}g out / 25-30초`;
  const warnings: string[] = [];

  if (!last) {
    const restHint = restAge == null ? '로스팅일을 입력하면 디개싱 상태까지 같이 봅니다.' : restAge < 7 ? '로스팅 후 7일 전이면 가스가 많아 결과가 출렁일 수 있습니다.' : '로스팅 휴지 기간은 충분해 보입니다.';
    return {
      title: '첫 샷 기준값',
      summary: `${bean.name}은 아직 추출 기록이 없습니다.`,
      action: `기본값으로 ${targetText}를 먼저 기록하세요.`,
      target: targetText,
      reason: restHint,
      confidence: '낮음',
      nextGrindSize: baseGrind,
      beginnerTip: '첫 샷은 맛보다 흐름을 봅니다. 너무 빠르면 곱게, 너무 느리면 굵게 한 칸만 바꾸세요.',
      warnings,
    };
  }

  const brewTime = n(last.brewSeconds);
  const yieldGram = n(last.yieldGram);
  const ratio = yieldGram && dose ? yieldGram / dose : null;
  const taste = tasteSignal(last);
  const flow = timeSignal(brewTime);
  const channelingIssue = last.channeling === 'suspected' || last.channeling === 'visible' || last.shotResult === '채널링 의심';
  const underTaste = taste.sour || taste.thin;
  const overTaste = taste.bitter || (ratio != null && ratio < 1.7 && brewTime != null && brewTime > 30);
  const conflictingSignals = (flow === 'fast' && overTaste) || (flow === 'slow' && underTaste) || (underTaste && overTaste);
  let direction: 'finer' | 'coarser' | 'hold' = 'hold';
  let action = '현재 세팅을 유지하고 같은 조건으로 한 번 더 재현하세요.';
  let reason = '최근 샷이 목표 범위에 가깝습니다.';
  let title = '세팅 유지';
  let confidence: DialInRecommendation['confidence'] = sorted.length >= 3 ? '높음' : '보통';

  if (channelingIssue) {
    title = '퍽 준비 먼저 확인';
    action = '분쇄도를 바로 바꾸지 말고 같은 세팅으로 재현하면서 WDT, 탬핑 수평, 바스켓 안쪽 뭉침을 먼저 확인하세요.';
    reason = last.shotResult === '채널링 의심'
      ? '최근 기록이 채널링 의심으로 저장되었습니다. 이 경우 분쇄도 조정보다 재현성과 퍽 준비 확인이 먼저입니다.'
      : `최근 기록의 채널링 상태가 ${last.channeling === 'visible' ? '보임' : '의심'}입니다. 시간과 맛이 흔들려도 원인이 분쇄도만은 아닐 수 있습니다.`;
    confidence = '보통';
    direction = 'hold';
    warnings.push('채널링 신호가 있으면 같은 분쇄도에서 WDT/탬핑/도징 분포를 먼저 안정화하세요.');
  } else if (conflictingSignals) {
    title = '같은 세팅으로 한 번 더 확인';
    action = '분쇄도를 바로 바꾸지 말고 같은 세팅으로 재현하면서 채널링, 탬핑 수평, 도징 뭉침을 먼저 확인하세요.';
    reason = brewTime != null
      ? `시간 신호(${brewTime.toFixed(1)}초)와 맛 신호가 서로 다릅니다. 초보 단계에서는 이럴 때 분쇄도보다 재현성 확인이 먼저입니다.`
      : '맛 신호가 추출 부족/과추출 양쪽으로 섞여 있어 한 번 더 재현하는 편이 안전합니다.';
    confidence = '낮음';
  } else if (flow === 'fast') {
    direction = 'finer';
    title = '다음 샷은 조금 더 곱게';
    action = '브레빌 숫자 기준이라면 분쇄도를 1 낮추고, 다른 값은 그대로 두세요.';
    reason = `최근 추출 시간이 ${brewTime?.toFixed(1)}초로 빠릅니다. 맛 평가는 보조로만 보고, 시간부터 목표 범위에 맞춥니다.`;
  } else if (flow === 'slow') {
    direction = 'coarser';
    title = '다음 샷은 조금 더 굵게';
    action = '브레빌 숫자 기준이라면 분쇄도를 1 올리고, 도징량과 추출량은 유지하세요.';
    reason = `최근 추출 시간이 ${brewTime?.toFixed(1)}초로 느립니다. 맛 평가는 보조로만 보고, 시간부터 목표 범위에 맞춥니다.`;
  } else if (flow === 'target' && underTaste) {
    direction = 'finer';
    title = '시간은 괜찮고 맛은 살짝 부족';
    action = '추출 시간이 이미 안정권이라면 분쇄도를 아주 작게만 곱게 하거나, 같은 세팅을 한 번 더 재현하세요.';
    reason = '시간은 목표 범위지만 산미/묽음 신호가 있어 맛 기준의 미세 조정 후보입니다.';
    confidence = '보통';
  } else if (flow === 'target' && overTaste) {
    direction = 'coarser';
    title = '시간은 괜찮고 맛은 살짝 과함';
    action = '추출 시간이 이미 안정권이라면 분쇄도를 아주 작게만 굵게 하거나, 같은 세팅을 한 번 더 재현하세요.';
    reason = '시간은 목표 범위지만 쓴맛/텁텁함 신호가 있어 맛 기준의 미세 조정 후보입니다.';
    confidence = '보통';
  } else if (flow === 'unknown' && underTaste) {
    direction = 'finer';
    title = '추출 시간을 함께 기록하세요';
    action = '다음 샷은 시간을 꼭 재고, 맛이 계속 시거나 묽으면 한 단계 곱게 조정하세요.';
    reason = '시간이 없어서 맛 신호만 참고했습니다. 추천 신뢰도는 낮습니다.';
    confidence = '낮음';
  } else if (flow === 'unknown' && overTaste) {
    direction = 'coarser';
    title = '추출 시간을 함께 기록하세요';
    action = '다음 샷은 시간을 꼭 재고, 맛이 계속 쓰거나 텁텁하면 한 단계 굵게 조정하세요.';
    reason = '시간이 없어서 맛 신호만 참고했습니다. 추천 신뢰도는 낮습니다.';
    confidence = '낮음';
  }

  if (taste.good && brewTime != null && brewTime >= 24 && brewTime <= 32 && ratio != null && ratio >= 1.8 && ratio <= 2.3) {
    direction = 'hold';
    title = '좋은 세팅 저장';
    action = '이 기록을 즐겨찾기로 두고, 다음 샷은 같은 세팅으로 재현해 보세요.';
    reason = '평점, 시간, 비율이 모두 안정권입니다.';
    confidence = '높음';
  }

  if (openAge != null) {
    if (openAge <= 3) {
      warnings.push(`개봉 ${openAge}일차: 초반에는 가스와 보관 상태 때문에 샷 편차가 큽니다. 큰 폭 조정보다 1칸만 움직이세요.`);
    } else if (openAge >= 14 && openAge < 30) {
      if (best?.brewSeconds != null && brewTime != null) {
        const delta = Math.round((brewTime - best.brewSeconds) * 10) / 10;
        const label = delta === 0 ? '거의 같습니다' : delta > 0 ? `${delta.toFixed(1)}초 느립니다` : `${Math.abs(delta).toFixed(1)}초 빠릅니다`;
        warnings.push(`개봉 ${openAge}일차: 좋았던 기록과 비교해 현재 샷이 ${label}. 같은 세팅에서 점점 빨라지면 한 단계 곱게 보정하세요.`);
      } else {
        warnings.push(`개봉 ${openAge}일차: 원두가 점점 빨리 흐를 수 있습니다. 같은 세팅에서 시간이 줄면 곱게 조정하세요.`);
      }
    } else if (openAge >= 30) {
      warnings.push(`개봉 ${openAge}일차: 분쇄도만으로 맛을 되돌리기 어려울 수 있습니다. 우유 음료나 짧은 보관 주기를 고려하세요.`);
      confidence = confidence === '높음' ? '보통' : confidence;
    }
  } else {
    warnings.push('개봉일을 입력하면 원두 노화에 따른 분쇄도 변화 힌트를 더 정확히 표시합니다.');
  }

  if (restAge != null && restAge < 5) {
    warnings.push(`로스팅 후 ${restAge}일: 너무 신선하면 채널링/거품이 커질 수 있어 하루 이틀 뒤 다시 비교하세요.`);
  }

  const nextGrindSize = direction === 'hold' ? baseGrind : numericGrindStep(baseGrind, direction);
  const ratioText = ratio == null ? '비율 미입력' : `1:${ratio.toFixed(1)}`;

  return {
    title,
    summary: `최근 샷: ${optionalSeconds(brewTime)} · ${ratioText} · ${optionalRating(last.rating)}`,
    action,
    target: best ? `좋았던 기록: ${optionalGrind(best.grindSizeExternal ?? best.grindSize)} / ${optionalSeconds(best.brewSeconds)} / ${optionalRating(best.rating)}` : targetText,
    reason,
    confidence,
    nextGrindSize,
    beginnerTip: '한 번에 하나만 바꾸세요. 분쇄도를 바꿨다면 도징량, 추출량, 탬핑은 그대로 두고 비교합니다.',
    warnings,
  };
};
