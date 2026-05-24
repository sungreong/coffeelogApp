import { NativeModules, Platform } from 'react-native';
import { getFreshnessInfo, getUsageInfo } from './beanInventory';
import { Bean, BrewLog, CoffeeProduct, CoffeePurchaseLot } from '../types/models';

type WidgetBridgeModule = {
  updateWidgets?: (payload: string) => Promise<void>;
};

const widgetBridge = NativeModules.WidgetBridge as WidgetBridgeModule | undefined;

const statusLabel: Record<string, string> = {
  unopened: '미개봉',
  open: '사용중',
  finished: '소진',
  archived: '보관',
};

const formatGram = (value: number | null | undefined) => value == null ? '미입력' : `${Math.round(value * 10) / 10}g`;
const formatSeconds = (value: number | null | undefined) => value == null ? '시간 미입력' : `${value}초`;
const formatRating = (value: number | null | undefined) => value == null ? '평점 미입력' : `${Math.round(value * 10) / 10}점`;

const sortByDateDesc = <T extends { updatedAt?: string; createdAt?: string }>(items: T[]) =>
  [...items].sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''));

const activeBeanFromState = (beans: Bean[], selectedBeanId: string | null) => {
  const selected = beans.find(bean => bean.id === selectedBeanId);
  if (selected) return selected;
  return beans.find(bean => bean.lotStatus === 'open')
    ?? beans.find(bean => bean.lotStatus === 'unopened')
    ?? sortByDateDesc(beans)[0]
    ?? null;
};

export const syncCoffeeWidgets = async (state: {
  beans: Bean[];
  coffeeProducts: CoffeeProduct[];
  purchaseLots: CoffeePurchaseLot[];
  logs: BrewLog[];
  selectedBeanId: string | null;
}) => {
  if (Platform.OS !== 'android' || !widgetBridge?.updateWidgets) return;

  const activeBean = activeBeanFromState(state.beans, state.selectedBeanId);
  const activeLogs = activeBean
    ? state.logs.filter(log => (log.purchaseLotId ?? log.beanId) === activeBean.id)
    : [];
  const recentLog = state.logs[0] ?? null;
  const usage = activeBean ? getUsageInfo(activeBean, state.logs) : null;
  const freshness = activeBean ? getFreshnessInfo(activeBean) : null;
  const activeProduct = activeBean?.productId
    ? state.coffeeProducts.find(product => product.id === activeBean.productId)
    : null;

  const payload = {
    updatedAt: new Date().toISOString(),
    counts: {
      products: state.coffeeProducts.length,
      lots: state.purchaseLots.length || state.beans.length,
      brews: state.logs.length,
    },
    activeBean: activeBean ? {
      id: activeBean.id,
      name: activeBean.name,
      roastery: activeBean.roastery ?? activeProduct?.roastery ?? '',
      status: statusLabel[activeBean.lotStatus] ?? activeBean.lotStatus,
      freshness: freshness?.title ?? '로스팅일 미입력',
      freshnessDetail: freshness?.detail ?? '',
      remaining: formatGram(usage?.displayRemaining),
      estimatedCups: usage?.estimatedCups == null ? '입력값 부족' : `${usage.estimatedCups}잔`,
      logCount: activeLogs.length,
    } : null,
    recentBrew: recentLog ? {
      beanName: recentLog.beanName ?? activeBean?.name ?? '원두',
      brewedAt: recentLog.brewedAt,
      drinkType: recentLog.drinkType ?? '추출',
      brewSeconds: formatSeconds(recentLog.brewSeconds),
      yieldGram: formatGram(recentLog.yieldGram),
      doseGram: formatGram(recentLog.actualDoseGram ?? recentLog.doseGram),
      rating: formatRating(recentLog.rating),
    } : null,
    recentBrews: state.logs.slice(0, 3).map(log => ({
      id: log.id,
      beanName: log.beanName ?? '원두',
      line: `${log.drinkType ?? '추출'} · ${formatSeconds(log.brewSeconds)} · ${formatRating(log.rating)}`,
    })),
  };

  try {
    await widgetBridge.updateWidgets(JSON.stringify(payload));
  } catch (error) {
    console.warn('CoffeeLog widget sync failed', error);
  }
};
