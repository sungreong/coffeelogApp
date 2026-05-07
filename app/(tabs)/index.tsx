import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BeanInventoryStatusWidget, CompactSelectionBar, LogSummary, MetricChip, QuickBeanRegisterWidget, RecommendationCard, createCommonStyles } from '../../src/components';
import { ThemeColors, darkColors, lightColors } from '../../src/constants/theme';
import { getFreshnessInfo } from '../../src/services/beanInventory';
import { getDialInRecommendation } from '../../src/services/recommendation';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Bean, BrewLog, CoffeePurchaseLot } from '../../src/types/models';
import { formatSeconds, todayDate } from '../../src/utils';

const recentCutoff = (days: number) => Date.now() - days * 86400000;

const countTop = <T extends string>(items: T[]) => {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
};

const average = (values: Array<number | null | undefined>) => {
  const nums = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

function RecentPatternCard({ logs, beans, colors }: { logs: BrewLog[]; beans: Bean[]; colors: ThemeColors }) {
  const styles = createCommonStyles(colors);
  const beanNames = new Map(beans.map(bean => [bean.id, bean.name]));
  const recent = [...logs]
    .filter(log => new Date(log.brewedAt).getTime() >= recentCutoff(30))
    .sort((a, b) => b.brewedAt.localeCompare(a.brewedAt));
  const topBeans = countTop(recent.map(log => log.beanName ?? beanNames.get(log.beanId) ?? '원두 미입력')).slice(0, 3);
  const topDrinks = countTop(recent.map(log => log.drinkType ?? '종류 미입력')).slice(0, 3);
  const avgRating = average(recent.map(log => log.rating));
  const best = recent.find(log => log.isFavorite) ?? recent.find(log => (log.rating ?? 0) >= 4);

  const rows = [
    ['30일 기록', `${recent.length}회`],
    ['평균 평점', avgRating == null ? '-' : `${avgRating.toFixed(1)}/5`],
    ['최다 음료', topDrinks[0] ? `${topDrinks[0][0]} ${topDrinks[0][1]}회` : '-'],
    ['최다 원두', topBeans[0] ? `${topBeans[0][0]} ${topBeans[0][1]}회` : '-'],
  ];

  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View style={styles.between}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', flex: 1 }}>최근 30일 소비 패턴</Text>
        <Text style={{ color: colors.primary, fontWeight: '900' }}>{recent.length}잔</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={{ flex: 1, minWidth: 120, backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10 }}>
            <Text style={styles.small}>{label}</Text>
            <Text style={{ color: colors.text, fontWeight: '900', marginTop: 3 }}>{value}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        {topDrinks.map(([name, count]) => {
          const barWidth = recent.length ? `${Math.max(12, Math.round((count / recent.length) * 100))}%` : '0%';
          return (
            <View key={name}>
              <View style={styles.between}>
                <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>{name}</Text>
                <Text style={styles.small}>{count}회</Text>
              </View>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: colors.badge, overflow: 'hidden', marginTop: 4 }}>
                <View style={{ width: barWidth as any, height: '100%', backgroundColor: colors.accent }} />
              </View>
            </View>
          );
        })}
      </View>
      {best ? (
        <Text style={{ color: colors.textSecondary }}>
          최근 좋은 기록: {best.beanName ?? beanNames.get(best.beanId) ?? '원두'} / {best.drinkType ?? '커피'} / 분쇄 {best.grindSize ?? '-'} / {best.brewSeconds ?? '-'}초 / {best.rating ?? '-'}점
        </Text>
      ) : (
        <Text style={styles.subtitle}>최근 30일 기록이 쌓이면 자주 마신 원두와 커피 종류가 여기에 표시됩니다.</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;
  const colors = useSettingsStore(s => s.isDarkMode) ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  const { beans, coffeeProducts, purchaseLots, logs, selectedBeanId, stats, settingsByBean, equipment, selectedEquipmentId, saveCoffeeProduct, savePurchaseLot, selectBean } = useCoffeeStore();
  const [quickRegisterBusy, setQuickRegisterBusy] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const selectedBean = beans.find(bean => bean.id === selectedBeanId) ?? beans[0];
  const selectedLogs = useMemo(() => logs.filter(log => (log.purchaseLotId ?? log.beanId) === selectedBean?.id), [logs, selectedBean?.id]);
  const selectedFreshness = selectedBean ? getFreshnessInfo(selectedBean) : null;
  const favorite = selectedLogs.find(log => log.isFavorite) ?? selectedLogs.find(log => (log.rating ?? 0) >= 4);
  const recommendation = getDialInRecommendation(selectedBean, logs, selectedBean ? settingsByBean[selectedBean.id] : null);
  const selectedTopDrink = countTop(selectedLogs.map(log => log.drinkType ?? '종류 미입력'))[0];
  const selectedEquipment = equipment.find(item => item.id === selectedEquipmentId) ?? equipment[0] ?? null;

  const createQuickBean = async (name: string) => {
    if (!name.trim()) return;
    setQuickRegisterBusy(true);
    try {
      const product = await saveCoffeeProduct({ name: name.trim(), userStatus: 'normal' });
      const lot = await savePurchaseLot({ productId: product.id, lotStatus: 'unopened' });
      selectBean(lot.id);
      router.push('/beans');
    } finally {
      setQuickRegisterBusy(false);
    }
  };

  const changeLotStatus = async (lot: CoffeePurchaseLot, status: CoffeePurchaseLot['lotStatus']) => {
    const saved = await savePurchaseLot({
      ...lot,
      lotStatus: status,
      openedDate: status === 'open' && !lot.openedDate ? todayDate() : lot.openedDate,
      remainingWeightGram: status === 'finished' ? 0 : lot.remainingWeightGram,
    });
    selectBean(saved.id);
  };

  const goToLot = (lot: CoffeePurchaseLot, target: '/beans' | '/log') => {
    selectBean(lot.id);
    router.push(target);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CoffeeLog</Text>
          <Text style={styles.subtitle}>사용 장비: {selectedEquipment ? [selectedEquipment.brand, selectedEquipment.model || selectedEquipment.name].filter(Boolean).join(' ') : '장비 미선택'}</Text>
        </View>
        <TouchableOpacity style={styles.ghostButton} onPress={() => router.push('/settings')}>
          <MaterialIcons name="settings" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 14, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>오늘의 추출</Text>
          <View style={[styles.card, { gap: 12 }]}>
            <CompactSelectionBar
              title={selectedBean?.name}
              subtitle={selectedBean ? `${selectedBean.roastery || '로스터리 미입력'} · ${selectedFreshness?.label ?? '신선도 확인 필요'}` : '원두 탭에서 첫 원두를 등록하세요'}
              meta={selectedBean ? `구매 ${selectedBean.purchaseDate ?? '-'} · 로스팅 ${selectedBean.roastDate ?? '-'} · 개봉 ${selectedBean.openedDate ?? '-'}` : null}
              colors={colors}
              onChange={() => router.push('/beans')}
              onDetail={() => router.push('/beans')}
            />
            {favorite ? (
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>좋았던 설정</Text>
                <Text style={styles.small}>
                  분쇄 {favorite.grindSizeExternal ?? favorite.grindSize ?? '-'} · {favorite.doseMode === 'manual' ? 'MANUAL' : 'AUTO'} · 도징 {favorite.actualDoseGram ?? favorite.doseGram ?? '-'}g · 수율 {favorite.yieldGram ?? '-'}g · {formatSeconds(favorite.brewSeconds)}
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>첫 샷 기준값</Text>
                <Text style={styles.small}>18g in / 36g out / 25-30초로 먼저 기록해보세요.</Text>
              </View>
            )}
            <Text style={{ color: colors.accent, fontWeight: '800' }} numberOfLines={2}>{recommendation.action}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity style={[styles.button, { flexGrow: 1 }]} onPress={() => router.push('/log')}>
                <MaterialIcons name="edit-note" size={20} color="#fff" />
                <Text style={styles.buttonText}>추출 기록</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ghostButton, { flexGrow: 1 }]} onPress={() => router.push('/timer')}>
                <MaterialIcons name="timer" size={20} color={colors.text} />
                <Text style={styles.ghostText}>타이머 시작</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start', minHeight: 38 }]} onPress={() => router.push('/beans')}>
              <MaterialIcons name="coffee" size={18} color={colors.text} />
              <Text style={styles.ghostText}>원두/봉투 관리</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <MetricChip label="원두" value={stats?.beanCount ?? 0} colors={colors} />
            <MetricChip label="기록" value={stats?.logCount ?? 0} colors={colors} />
            <MetricChip label="7일" value={stats?.recent7DaysCount ?? 0} colors={colors} />
            <MetricChip label="평균" value={stats?.averageRating?.toFixed(1) ?? '-'} colors={colors} />
          </View>

          <Text style={styles.sectionTitle}>빠른 관리</Text>
          <QuickBeanRegisterWidget colors={colors} busy={quickRegisterBusy} onCreate={createQuickBean} />
          <View style={{ height: 12 }} />
          <BeanInventoryStatusWidget
            products={coffeeProducts}
            lots={purchaseLots}
            logs={logs}
            colors={colors}
            onOpenLot={lot => void changeLotStatus(lot, 'open')}
            onEditLot={lot => goToLot(lot, '/beans')}
            onFinishLot={lot => void changeLotStatus(lot, 'finished')}
            onLogLot={lot => goToLot(lot, '/log')}
          />
        </View>

        <View style={{ flex: 1.25 }}>
          <View style={styles.between}>
            <Text style={styles.sectionTitle}>상세 인사이트</Text>
            <TouchableOpacity style={styles.ghostButton} onPress={() => setInsightsOpen(prev => !prev)}>
              <Text style={styles.ghostText}>{insightsOpen ? '접기' : '보기'}</Text>
            </TouchableOpacity>
          </View>
          {insightsOpen ? (
            <>
              <RecommendationCard recommendation={recommendation} colors={colors} />
              <View style={{ height: 12 }} />
              <RecentPatternCard logs={logs} beans={beans} colors={colors} />
            </>
          ) : (
            <View style={styles.card}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{recommendation.action}</Text>
              <Text style={styles.small}>상세 분석과 30일 패턴은 필요할 때만 펼쳐봅니다.</Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>최근 기록</Text>
          {logs.slice(0, 3).map(log => <LogSummary key={log.id} log={log} colors={colors} />)}
          {logs.length === 0 && <View style={styles.card}><Text style={styles.subtitle}>아직 추출 기록이 없습니다.</Text></View>}
        </View>
      </View>
    </ScrollView>
  );
}
