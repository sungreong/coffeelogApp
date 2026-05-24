import * as Clipboard from 'expo-clipboard';
import { getBrewLogDoseGram, roundGram } from './beanInventory';
import { Bean, BeanDefaultSetting, BrewLog, CoffeeProduct, CoffeePurchaseLot } from '../types/models';

type BuildAiCopyOptions = {
  bean: Bean;
  setting?: BeanDefaultSetting | null;
  selectedLog?: BrewLog | null;
  logs?: BrewLog[];
  question?: string | null;
};

type BuildPurchaseLotAiCopyOptions = {
  product: CoffeeProduct;
  lot: CoffeePurchaseLot;
  logs?: BrewLog[];
  currentRemainingGram?: number | null;
  question?: string | null;
};

const missing = '미입력';

const value = (input: string | number | boolean | null | undefined, suffix = '') => {
  if (input == null) return missing;
  if (typeof input === 'boolean') return input ? '예' : '아니오';
  const text = String(input).trim();
  return text.length ? `${text}${suffix}` : missing;
};

const dateTime = (iso: string | null | undefined) => {
  if (!iso) return missing;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return date.toLocaleString('ko-KR');
};

const yesNo = (input: string | null | undefined) => input ? '있음' : '없음';

const channelingLabel = (input: string | null | undefined) => {
  if (input === 'none') return '없음';
  if (input === 'suspected') return '의심';
  if (input === 'visible') return '보임';
  return value(input);
};

const servingLabel = (input: string | null | undefined) => {
  if (input === 'hot') return '핫';
  if (input === 'iced') return '아이스';
  return value(input);
};

const rows = (items: Array<[string, string | number | boolean | null | undefined, string?]>) =>
  items.map(([label, item, suffix]) => `- ${label}: ${value(item, suffix)}`).join('\n');

const compactLog = (log: BrewLog) => {
  const core = [
    dateTime(log.brewedAt),
    value(log.drinkType),
    `분쇄 ${value(log.grindSizeExternal ?? log.grindSize)}`,
    `${value(log.actualDoseGram ?? log.doseGram, 'g')} in`,
    `${value(log.yieldGram, 'g')} out`,
    `${value(log.brewSeconds, '초')}`,
    `평점 ${value(log.rating, '/5')}`,
  ];
  return `- ${core.join(' / ')}${log.shotResult ? ` / 결과 ${log.shotResult}` : ''}${log.resultMemo ? ` / 메모 ${log.resultMemo}` : ''}`;
};

const selectedLogSection = (log: BrewLog) => `## 선택한 추출 기록
${rows([
  ['추출일', dateTime(log.brewedAt)],
  ['음료', log.drinkType],
  ['분쇄도', log.grindSizeExternal ?? log.grindSize],
  ['속도', log.speed],
  ['분쇄 시간', log.grindSeconds, '초'],
  ['실측 도징량', log.actualDoseGram ?? log.doseGram, 'g'],
  ['추출량', log.yieldGram, 'g'],
  ['추출 시간', log.brewSeconds, '초'],
  ['도징 모드', log.doseMode],
  ['도즈 레벨', log.doseLevel],
  ['압력 구간', log.pressureZone],
  ['물 온도', log.waterTemperature, '도'],
  ['프리인퓨전', log.preinfusion ? `예 (${value(log.preinfusionSeconds, '초')})` : '아니오'],
  ['바스켓/필터', log.basket],
  ['퍽 준비', log.puckPrep],
  ['탬핑', log.tamping],
  ['채널링', channelingLabel(log.channeling)],
  ['샷 결과', log.shotResult],
  ['물', log.waterMl, 'ml'],
  ['우유', log.milkMl, 'ml'],
  ['제공 온도', servingLabel(log.servingTemperature)],
  ['전체 평점', log.rating, '/5'],
  ['산미', log.acidity, '/5'],
  ['단맛', log.sweetness, '/5'],
  ['쓴맛', log.bitterness, '/5'],
  ['바디', log.body, '/5'],
  ['메모', log.resultMemo],
  ['사진', yesNo(log.photoUri)],
])}`;

const recentSummary = (logs: BrewLog[], selectedLog?: BrewLog | null) => {
  const sorted = [...logs].sort((a, b) => b.brewedAt.localeCompare(a.brewedAt));
  const recent = sorted.slice(0, 3);
  const best = sorted
    .filter(log => log.id !== selectedLog?.id)
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return (b.rating ?? -1) - (a.rating ?? -1);
    })[0];
  const lines = recent.map(compactLog);
  if (best) lines.push(`- 참고할 만한 좋은 기록: ${compactLog(best).replace(/^- /, '')}`);
  return lines.length ? lines.join('\n') : '- 같은 원두의 추출 기록이 아직 없습니다.';
};

const lotUsageRows = (lot: CoffeePurchaseLot, logs: BrewLog[], currentRemainingGram?: number | null) => {
  const usedGram = logs.reduce((sum, log) => sum + getBrewLogDoseGram(log), 0);
  const latest = [...logs].sort((a, b) => b.brewedAt.localeCompare(a.brewedAt))[0];
  return rows([
    ['시작 중량', lot.initialWeightGram, 'g'],
    ['현재 남은 양', currentRemainingGram ?? lot.remainingWeightGram, 'g'],
    ['수동 보정값', lot.remainingWeightGram, 'g'],
    ['기록 사용량 합계', roundGram(usedGram), 'g'],
    ['추출 기록 수', logs.length, '회'],
    ['최근 추출일', latest ? dateTime(latest.brewedAt) : null],
  ]);
};

export const buildAiCopyText = ({ bean, setting, selectedLog, logs = [], question }: BuildAiCopyOptions) => {
  const userQuestion = question?.trim() || '다음 추출에서 무엇을 한 가지 우선 조정하면 좋을지 알려줘.';
  return `커피 추출 조언을 받고 싶습니다. 아래 CoffeeLog 데이터를 보고 다음 샷에서 수정할 부분을 제안해주세요.

## 원두 정보
${rows([
  ['원두명', bean.name],
  ['로스터리', bean.roastery],
  ['산지', bean.origin],
  ['품종', bean.variety],
  ['가공 방식', bean.process],
  ['로스팅 정도', bean.roastLevel],
  ['구매일', bean.purchaseDate],
  ['로스팅일', bean.roastDate],
  ['개봉일', bean.openedDate],
  ['유통기한', bean.expiryDate],
  ['보관 위치', bean.storageType],
  ['메모', bean.memo],
  ['사진', yesNo(bean.mainPhotoUri)],
])}

## 기본 세팅
${rows([
  ['음료', setting?.drinkType],
  ['분쇄도', setting?.grindSize],
  ['속도', setting?.speed],
  ['분쇄 시간', setting?.grindSeconds, '초'],
  ['도징량', setting?.doseGram, 'g'],
  ['추출량', setting?.yieldGram, 'g'],
  ['목표 시간', setting?.targetBrewSeconds, '초'],
  ['메모', setting?.memo],
])}

${selectedLog ? selectedLogSection(selectedLog) : '## 선택한 추출 기록\n- 선택한 기록 없음'}

## 최근 같은 원두 기록 요약
${recentSummary(logs, selectedLog)}

## 질문
${userQuestion}

## 답변 형식
1. 현재 기록에서 문제가 될 가능성이 큰 지점을 1-2개만 짚어줘.
2. 다음 샷에서 바꿀 값 하나를 우선 추천해줘. 예: 분쇄도 +1/-1, 도징량 +/-0.5g, 추출량 +/-2g, 목표 시간 조정.
3. 왜 그 수정이 먼저인지 원두 상태와 최근 기록을 근거로 짧게 설명해줘.
4. 확실하지 않은 값은 추측하지 말고 "추가로 확인할 사진/값"으로 분리해줘.`;
};

export const copyAiText = async (options: BuildAiCopyOptions) => {
  const text = buildAiCopyText(options);
  await Clipboard.setStringAsync(text);
  return text;
};

export const buildPurchaseLotPrompt = ({ product, lot, logs = [], currentRemainingGram, question }: BuildPurchaseLotAiCopyOptions) => {
  const userQuestion = question?.trim() || '이 구매분을 앞으로 어떻게 소비하고 다음 추출에서 무엇을 먼저 확인하면 좋을지 알려줘.';
  return `커피 원두 구매분에 대한 조언을 받고 싶습니다. 아래 CoffeeLog 데이터를 보고 신선도, 소비 우선순위, 다음 기록에서 확인할 값을 제안해주세요.

## 원두 제품 정보
${rows([
  ['원두명', product.name],
  ['로스터리', product.roastery],
  ['산지', product.origin],
  ['품종', product.variety],
  ['가공 방식', product.process],
  ['로스팅 정도', product.roastLevel],
  ['테이스팅 노트', product.tastingNotes],
  ['제품 메모', product.memo],
])}

## 구매분 정보
${rows([
  ['구매일', lot.purchaseDate],
  ['로스팅일', lot.roastDate],
  ['개봉일', lot.openedDate],
  ['유통기한', lot.expiryDate],
  ['상태', lot.lotStatus],
  ['보관 위치', lot.storageType],
  ['구매처', lot.seller],
  ['가격', lot.price],
  ['구매분 메모', lot.lotMemo],
  ['사진', yesNo(lot.mainPhotoUri)],
])}

## 잔량과 사용 현황
${lotUsageRows(lot, logs, currentRemainingGram)}

## 최근 이 구매분 추출 기록 요약
${recentSummary(logs)}

## 질문
${userQuestion}

## 답변 형식
1. 이 구매분의 현재 상태와 소비 우선순위를 짧게 판단해줘.
2. 다음 추출에서 먼저 확인할 값 1-2개를 추천해줘.
3. 날짜/잔량/최근 기록 기준으로 왜 그렇게 보는지 설명해줘.
4. 부족한 정보나 추가로 찍으면 좋은 사진을 분리해서 알려줘.`;
};

export const copyPurchaseLotAiText = async (options: BuildPurchaseLotAiCopyOptions) => {
  const text = buildPurchaseLotPrompt(options);
  await Clipboard.setStringAsync(text);
  return text;
};
