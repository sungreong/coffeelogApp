import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LogSummary, createCommonStyles } from '../../src/components';
import { darkColors, lightColors } from '../../src/constants/theme';
import { exportCsv, exportJson, exportZip } from '../../src/services/exporter';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';

export function ExportContent({ compact = false }: { compact?: boolean }) {
  const settings = useSettingsStore();
  const colors = settings.isDarkMode ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  const { beans, logs, stats } = useCoffeeStore();
  const [busy, setBusy] = useState(false);
  const [beanFilter, setBeanFilter] = useState('all');
  const [drinkFilter, setDrinkFilter] = useState('all');
  const [beanQuery, setBeanQuery] = useState('');
  const [dateRange, setDateRange] = useState<'all' | '30d' | '365d'>('all');
  const [exportFormat, setExportFormat] = useState<'excel_csv' | 'csv' | 'json' | 'zip'>('excel_csv');
  const [scopeOpen, setScopeOpen] = useState(false);

  const drinkTypes = useMemo(() => {
    const names = logs.map(log => log.drinkType?.trim()).filter(Boolean) as string[];
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [logs]);

  const filteredLogs = useMemo(() => logs.filter(log => {
    const beanOk = beanFilter === 'all' || (log.purchaseLotId ?? log.beanId) === beanFilter;
    const drinkOk = drinkFilter === 'all' || log.drinkType === drinkFilter;
    const brewedAt = Date.parse(log.brewedAt);
    const rangeOk = dateRange === 'all'
      || (Number.isFinite(brewedAt) && brewedAt >= Date.now() - (dateRange === '30d' ? 30 : 365) * 86400000);
    return beanOk && drinkOk && rangeOk;
  }), [logs, beanFilter, drinkFilter, dateRange]);

  const scopedBeans = useMemo(() => {
    if (beanFilter !== 'all') return beans.filter(bean => bean.id === beanFilter);
    if (drinkFilter !== 'all' || dateRange !== 'all') {
      const ids = new Set(filteredLogs.map(log => log.purchaseLotId ?? log.beanId));
      return beans.filter(bean => ids.has(bean.id));
    }
    return beans;
  }, [beans, beanFilter, drinkFilter, dateRange, filteredLogs]);

  const beanLabel = beanFilter === 'all' ? '전체 원두' : beans.find(bean => bean.id === beanFilter)?.name ?? '선택 원두';
  const drinkLabel = drinkFilter === 'all' ? '전체 종류' : drinkFilter;
  const rangeLabel = dateRange === 'all' ? '전체 기간' : dateRange === '30d' ? '최근 30일' : '최근 1년';
  const scopeLabel = `${beanLabel}_${drinkLabel}_${rangeLabel}`;
  const visibleBeans = useMemo(() => {
    const query = beanQuery.trim().toLowerCase();
    if (!query) return beans.slice(0, 20);
    return beans.filter(bean => [bean.name, bean.roastery, bean.origin, bean.seller].filter(Boolean).join(' ').toLowerCase().includes(query));
  }, [beans, beanQuery]);

  const formatOptions = [
    ['excel_csv', '엑셀용 CSV', 'Windows Excel에서 한글 깨짐을 줄입니다.'],
    ['csv', '일반 CSV', 'UTF-8 BOM CSV로 추출 기록을 공유합니다.'],
    ['json', 'JSON 백업', '다른 도구 연동이나 백업에 적합합니다.'],
    ['zip', 'ZIP 백업', '사진을 포함해 현재 범위를 묶습니다.'],
  ] as const;

  const run = async (task: () => Promise<unknown>, done: string) => {
    try {
      setBusy(true);
      await task();
      Alert.alert('완료', done);
    } catch (error: any) {
      Alert.alert('실패', error?.message ?? '작업 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const runSelectedExport = () => {
    if (exportFormat === 'excel_csv') {
      return run(() => exportCsv(filteredLogs, 'cp949', { scopeLabel }), `${beanLabel} / ${drinkLabel} 엑셀용 CSV를 공유했습니다.`);
    }
    if (exportFormat === 'csv') {
      return run(() => exportCsv(filteredLogs, 'utf8-bom', { scopeLabel }), `${beanLabel} / ${drinkLabel} CSV를 공유했습니다.`);
    }
    if (exportFormat === 'json') {
      return run(() => exportJson(scopedBeans, filteredLogs, { scopeLabel }), `${beanLabel} / ${drinkLabel} JSON 백업을 공유했습니다.`);
    }
    return run(() => exportZip(scopedBeans, filteredLogs, { scopeLabel }), `${beanLabel} / ${drinkLabel} 사진 포함 ZIP 백업을 공유했습니다.`);
  };

  return (
    <>
      {!compact && <Text style={styles.title}>내보내기 / 백업</Text>}
      <Text style={styles.subtitle}>현재 선택한 원두/커피 종류 범위만 내보낼 수 있습니다. API Key는 포함하지 않습니다.</Text>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        {[
          ['원두', stats?.beanCount ?? beans.length],
          ['기록', stats?.logCount ?? logs.length],
          ['7일 기록', stats?.recent7DaysCount ?? 0],
          ['최다 원두', stats?.topBeanName ?? '아직 없음'],
        ].map(([label, value]) => (
          <View key={label} style={[styles.card, { minWidth: 130, flexGrow: 1 }]}>
            <Text style={styles.small}>{label}</Text>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>내보낼 범위</Text>
      <View style={styles.card}>
        <View style={styles.between}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>{beanLabel} / {drinkLabel} / {rangeLabel}</Text>
            <Text style={styles.small}>내보낼 기록 {filteredLogs.length}개 · 포함 원두 {scopedBeans.length}개</Text>
          </View>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setScopeOpen(prev => !prev)}>
            <Text style={styles.ghostText}>세부 조건 {scopeOpen ? '접기' : '열기'}</Text>
          </TouchableOpacity>
        </View>
        {scopeOpen && <>
        <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 8 }}>원두별</Text>
        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          value={beanQuery}
          onChangeText={setBeanQuery}
          placeholder="원두명, 로스터리, 구매처 검색"
          placeholderTextColor={colors.textTertiary}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <TouchableOpacity style={[styles.ghostButton, beanFilter === 'all' && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setBeanFilter('all')}>
            <Text style={styles.ghostText}>전체 원두</Text>
          </TouchableOpacity>
          {visibleBeans.map(bean => (
            <TouchableOpacity key={bean.id} style={[styles.ghostButton, beanFilter === bean.id && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setBeanFilter(bean.id)}>
              <Text style={styles.ghostText}>{bean.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!beanQuery.trim() && beans.length > visibleBeans.length && <Text style={[styles.small, { marginBottom: 12 }]}>원두가 많아 최근 20개만 표시합니다. 검색하면 전체에서 찾습니다.</Text>}

        <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 8 }}>커피 종류별</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity style={[styles.ghostButton, drinkFilter === 'all' && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setDrinkFilter('all')}>
            <Text style={styles.ghostText}>전체 종류</Text>
          </TouchableOpacity>
          {drinkTypes.map(type => (
            <TouchableOpacity key={type} style={[styles.ghostButton, drinkFilter === type && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setDrinkFilter(type)}>
              <Text style={styles.ghostText}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: colors.text, fontWeight: '900', marginTop: 14, marginBottom: 8 }}>기간</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {([
            ['all', '전체 기간'],
            ['30d', '최근 30일'],
            ['365d', '최근 1년'],
          ] as Array<[typeof dateRange, string]>).map(([value, label]) => (
            <TouchableOpacity key={value} style={[styles.ghostButton, dateRange === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setDateRange(value)}>
              <Text style={styles.ghostText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        </>}
      </View>

      <Text style={styles.sectionTitle}>파일 생성</Text>
      <View style={[styles.card, { gap: 10 }]}>
        <Text style={styles.subtitle}>파일 형식을 먼저 고르고, 현재 범위를 한 번에 내보냅니다.</Text>
        {formatOptions.map(([value, label, description]) => (
          <TouchableOpacity
            key={value}
            style={{ borderWidth: 1, borderColor: exportFormat === value ? colors.primary : colors.border, backgroundColor: exportFormat === value ? colors.badge : colors.surfaceAlt, borderRadius: 8, padding: 12 }}
            onPress={() => setExportFormat(value)}
          >
            <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
            <Text style={styles.small}>{description}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity disabled={busy} style={[styles.button, { marginTop: 4 }]} onPress={runSelectedExport}>
          <MaterialIcons name="ios-share" size={20} color="#fff" />
          <Text style={styles.buttonText}>{busy ? '생성 중...' : '내보내기'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>최근 기록 미리보기</Text>
      {filteredLogs.slice(0, 3).map(log => <LogSummary key={log.id} log={log} colors={colors} />)}
      {filteredLogs.length === 0 && <Text style={styles.subtitle}>현재 범위에 해당하는 기록이 없습니다.</Text>}
    </>
  );
}

export default function ExportScreen() {
  const settings = useSettingsStore();
  const colors = settings.isDarkMode ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <ExportContent />
    </ScrollView>
  );
}
