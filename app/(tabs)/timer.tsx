import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { BottomSheetModal, CoffeeLotSelectorSheet, CompactSelectionBar, Field, TermHelpIcon, TermLabel, createCommonStyles } from '../../src/components';
import { ThemeColors, darkColors, lightColors } from '../../src/constants/theme';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { beanStatus, formatSeconds, parseOptionalNumber, todayDate } from '../../src/utils';

const drinkPresets = ['에스프레소', '아메리카노', '라떼'];
const puckPrepOptions = ['WDT', '레벨링', '퍽스크린', '바텀리스 확인'];
const channelingOptions = [
  ['none', '없음'],
  ['suspected', '의심'],
  ['visible', '보임'],
] as const;

const isBes876Equipment = (equipment?: { name?: string | null; model?: string | null; brand?: string | null } | null) => {
  const text = [equipment?.name, equipment?.model, equipment?.brand].filter(Boolean).join(' ').toUpperCase();
  return text.includes('BES876') || text.includes('876') || text.includes('BARISTA EXPRESS IMPRESS');
};

const blankShot = {
  drinkType: '',
  doseMode: 'auto',
  basketType: 'single_wall_2cup',
  shotButton: '2cup',
  grindSize: '',
  grindSizeExternal: '',
  innerBurrSetting: '',
  speed: '',
  grindSeconds: '',
  actualDoseGram: '',
  doseGram: '',
  yieldGram: '',
  targetBrewSeconds: '',
  firstDripSeconds: '',
  waterTemperature: '',
  temperatureOffset: '',
  preinfusionSeconds: '',
  basket: '',
  puckPrep: [] as string[],
  tamping: '',
  channeling: '',
  doseLevel: 'unknown',
  pressureZone: 'unknown',
  usedABitMore: false,
  usedRazorTrim: false,
  autoDoseResetDone: false,
  programmedVolumeChanged: false,
  nextAction: 'keep',
  shotResult: '',
  waterMl: '',
  milkMl: '',
  servingTemperature: '',
  rating: '',
  acidity: '',
  sweetness: '',
  bitterness: '',
  body: '',
  memo: '',
};

function Chip({ label, active, colors, onPress }: { label: string; active: boolean; colors: ThemeColors; onPress: () => void }) {
  const styles = createCommonStyles(colors);
  return (
    <TouchableOpacity style={[styles.ghostButton, active && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={onPress}>
      <Text style={styles.ghostText}>{label}</Text>
    </TouchableOpacity>
  );
}

const splitTags = (value: string | null | undefined) => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

export default function TimerScreen() {
  const colors = useSettingsStore(s => s.isDarkMode) ? darkColors : lightColors;
  const router = useRouter();
  const styles = createCommonStyles(colors);
  const { beans, logs, equipment, selectedEquipmentId, selectedBeanId, selectBean, settingsByBean, savePurchaseLot, setPendingTimerResult } = useCoffeeStore();
  const bean = beans.find(b => b.id === selectedBeanId) ?? null;
  const selectedEquipment = equipment.find(item => item.id === selectedEquipmentId) ?? equipment[0] ?? null;
  const isBes876 = isBes876Equipment(selectedEquipment);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const [firstDripLap, setFirstDripLap] = useState<number | null>(null);
  const [preinfusionLap, setPreinfusionLap] = useState<number | null>(null);
  const [shot, setShot] = useState(blankShot);
  const [beanPickerOpen, setBeanPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerAdvancedOpen, setTimerAdvancedOpen] = useState(false);
  const [lapsOpen, setLapsOpen] = useState(false);
  const startedAt = useRef<number | null>(null);
  const base = useRef(0);
  const setting = bean ? settingsByBean[bean.id] : null;
  useEffect(() => {
    if (!bean) {
      setShot(blankShot);
      return;
    }
    const last = logs.find(log => (log.purchaseLotId ?? log.beanId) === bean.id);
    setShot({
      drinkType: setting?.drinkType ?? last?.drinkType ?? '',
      doseMode: last?.doseMode ?? 'auto',
      basketType: last?.basketType ?? 'single_wall_2cup',
      shotButton: last?.shotButton ?? '2cup',
      grindSize: setting?.grindSize ?? last?.grindSize ?? '',
      grindSizeExternal: last?.grindSizeExternal != null ? String(last.grindSizeExternal) : setting?.grindSize ?? '',
      innerBurrSetting: last?.innerBurrSetting != null ? String(last.innerBurrSetting) : '',
      speed: setting?.speed ?? last?.speed ?? '',
      grindSeconds: setting?.grindSeconds != null ? String(setting.grindSeconds) : last?.grindSeconds != null ? String(last.grindSeconds) : '',
      actualDoseGram: last?.actualDoseGram != null ? String(last.actualDoseGram) : setting?.doseGram != null ? String(setting.doseGram) : '',
      doseGram: setting?.doseGram != null ? String(setting.doseGram) : last?.doseGram != null ? String(last.doseGram) : '',
      yieldGram: setting?.yieldGram != null ? String(setting.yieldGram) : last?.yieldGram != null ? String(last.yieldGram) : '',
      targetBrewSeconds: setting?.targetBrewSeconds != null ? String(setting.targetBrewSeconds) : last?.brewSeconds != null ? String(last.brewSeconds) : '',
      firstDripSeconds: last?.firstDripSeconds != null ? String(last.firstDripSeconds) : '',
      waterTemperature: last?.waterTemperature != null ? String(last.waterTemperature) : '',
      temperatureOffset: last?.temperatureOffset != null ? String(last.temperatureOffset) : '',
      preinfusionSeconds: last?.preinfusionSeconds != null ? String(last.preinfusionSeconds) : '',
      basket: last?.basket ?? '',
      puckPrep: splitTags(last?.puckPrep),
      tamping: last?.tamping ?? '',
      channeling: last?.channeling ?? '',
      doseLevel: last?.doseLevel ?? 'unknown',
      pressureZone: last?.pressureZone ?? 'unknown',
      usedABitMore: last?.usedABitMore ?? false,
      usedRazorTrim: last?.usedRazorTrim ?? false,
      autoDoseResetDone: last?.autoDoseResetDone ?? false,
      programmedVolumeChanged: last?.programmedVolumeChanged ?? false,
      nextAction: last?.nextAction ?? 'keep',
      shotResult: last?.shotResult ?? '',
      waterMl: last?.waterMl != null ? String(last.waterMl) : '',
      milkMl: last?.milkMl != null ? String(last.milkMl) : '',
      servingTemperature: last?.servingTemperature ?? ((last?.drinkType ?? '').includes('아이스') ? 'iced' : ''),
      rating: last?.rating != null ? String(last.rating) : '',
      acidity: last?.acidity != null ? String(last.acidity) : '',
      sweetness: last?.sweetness != null ? String(last.sweetness) : '',
      bitterness: last?.bitterness != null ? String(last.bitterness) : '',
      body: last?.body != null ? String(last.body) : '',
      memo: '',
    });
    setFirstDripLap(null);
    setPreinfusionLap(null);
  }, [bean?.id, setting?.id]);

  useEffect(() => {
    if (!isBes876 && shot.doseMode !== 'manual') setShot(prev => ({ ...prev, doseMode: 'manual', doseLevel: 'unknown', usedABitMore: false, usedRazorTrim: false, autoDoseResetDone: false }));
  }, [isBes876, shot.doseMode]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (startedAt.current) setElapsed(base.current + (Date.now() - startedAt.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [running]);

  const targetInput = parseOptionalNumber(shot.targetBrewSeconds);
  const target = targetInput ?? 28;
  const progress = useMemo(() => Math.min(1, elapsed / target), [elapsed, target]);
  const patchShot = (key: keyof typeof blankShot, value: string) => setShot(prev => ({ ...prev, [key]: value }));
  const togglePuckPrep = (tag: string) => {
    setShot(prev => ({
      ...prev,
      puckPrep: prev.puckPrep.includes(tag) ? prev.puckPrep.filter(item => item !== tag) : [...prev.puckPrep, tag],
    }));
  };

  const beginTiming = () => {
    setSettingsOpen(false);
    setBeanPickerOpen(false);
    startedAt.current = Date.now();
    base.current = elapsed;
    setRunning(true);
  };

  const start = () => {
    if (running) return;
    if (!bean) {
      Alert.alert('원두/구매분 선택 필요', '타이머를 시작하기 전에 오늘 사용할 원두의 구매분을 선택하세요.', [
        { text: '취소' },
        { text: '선택하기', onPress: () => setBeanPickerOpen(true) },
      ]);
      return;
    }
    if (bean.lotStatus === 'finished' || bean.lotStatus === 'archived') {
      Alert.alert('사용할 수 없는 구매분', '소진되었거나 보관 처리된 구매분입니다. 사용중 또는 미개봉 구매분을 선택하세요.', [
        { text: '확인' },
        { text: '다른 구매분 선택', onPress: () => setBeanPickerOpen(true) },
      ]);
      return;
    }
    if (bean.lotStatus === 'unopened') {
      Alert.alert(
        '미개봉 구매분입니다',
        '이 구매분으로 타이머를 시작하면 실제로 봉투를 연 것으로 볼 수 있어요. 상태를 사용중으로 바꾸고 개봉일을 오늘로 저장할까요?',
        [
          { text: '취소' },
          {
            text: '개봉하고 시작',
            onPress: () => {
              void (async () => {
                if (!bean.productId) {
                  Alert.alert('구매분 정보 필요', '이 원두는 제품 연결 정보가 없어 자동 개봉 처리할 수 없습니다. 원두 탭에서 구매분 정보를 확인해 주세요.');
                  return;
                }
                await savePurchaseLot({
                  id: bean.id,
                  productId: bean.productId,
                  purchaseDate: bean.purchaseDate,
                  roastDate: bean.roastDate,
                  openedDate: bean.openedDate ?? todayDate(),
                  expiryDate: bean.expiryDate,
                  storageType: bean.storageType,
                  initialWeightGram: bean.initialWeightGram,
                  remainingWeightGram: bean.remainingWeightGram,
                  lotStatus: 'open',
                  seller: bean.seller,
                  price: bean.price,
                  lotMemo: bean.lotMemo,
                  mainPhotoUri: bean.mainPhotoUri,
                });
                beginTiming();
              })();
            },
          },
        ]
      );
      return;
    }
    beginTiming();
  };

  const stop = () => {
    if (running) {
      base.current = elapsed;
      startedAt.current = null;
      setRunning(false);
    }
  };

  const reset = () => {
    stop();
    base.current = 0;
    setElapsed(0);
    setLaps([]);
    setFirstDripLap(null);
    setPreinfusionLap(null);
  };

  const useInNewLog = () => {
    if (elapsed <= 0) {
      Alert.alert('타이머 필요', '추출 시간을 잰 뒤 Log에 적용하세요.');
      return;
    }
    stop();
    setPendingTimerResult({
      brewSeconds: Number(elapsed.toFixed(1)),
      firstDripSeconds: firstDripLap == null ? parseOptionalNumber(shot.firstDripSeconds) : Number(firstDripLap.toFixed(1)),
      preinfusionSeconds: preinfusionLap == null ? parseOptionalNumber(shot.preinfusionSeconds) : Number(preinfusionLap.toFixed(1)),
      measuredAt: new Date().toISOString(),
      source: 'in_app_timer',
    });
    router.push('/log');
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>추출 타이머</Text>
      <Text style={styles.subtitle}>시간만 재고, 저장은 기록 화면에서 합니다.</Text>
      <View style={{ marginTop: 16, gap: 10 }}>
        <CompactSelectionBar
          title={bean?.name}
          subtitle={bean ? `${bean.roastery || '로스터리 미입력'} · ${beanStatus(bean.expiryDate, bean.openedDate)}` : '타이머 시작 전에 원두/구매분을 선택하세요'}
          meta={bean ? `구매 ${bean.purchaseDate ?? '-'} · 로스팅 ${bean.roastDate ?? '-'} · 개봉 ${bean.openedDate ?? '-'}` : null}
          colors={colors}
          onChange={running ? undefined : () => setBeanPickerOpen(true)}
          onDetail={bean && !running ? () => setSettingsOpen(true) : undefined}
        />
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>
            기준 레시피 · 분쇄 {shot.grindSizeExternal || shot.grindSize || '-'} · 도징 {shot.actualDoseGram || shot.doseGram ? `${shot.actualDoseGram || shot.doseGram}g` : '-'} · 수율 {shot.yieldGram ? `${shot.yieldGram}g` : '-'} · 목표 {targetInput == null ? `${target}초` : `${targetInput}초`}
          </Text>
        </View>
        {!running && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity style={styles.ghostButton} onPress={() => setSettingsOpen(true)}>
              <MaterialIcons name="tune" size={18} color={colors.text} />
              <Text style={styles.ghostText}>세팅 편집</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <CoffeeLotSelectorSheet
        visible={beanPickerOpen}
        colors={colors}
        beans={beans}
        logs={logs}
        selectedLotId={bean?.id}
        title="타이머 원두 선택"
        subtitle="이번에 실제로 사용할 구매분을 선택하세요. 미개봉 구매분은 시작할 때 개봉 처리 여부를 묻습니다."
        onClose={() => setBeanPickerOpen(false)}
        onSelect={selected => {
          selectBean(selected.id);
          setBeanPickerOpen(false);
        }}
      />

      <BottomSheetModal visible={settingsOpen} title="이번 샷 세팅" subtitle="타이머 위에는 핵심만 보이고, 자세한 값은 여기서 조정합니다." colors={colors} onClose={() => setSettingsOpen(false)}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{bean?.name ?? '원두 없음'}</Text>
        <Text style={styles.subtitle}>원두 기본 세팅과 최근 기록만 불러옵니다. 모르는 값은 빈칸으로 두면 저장 시 모름으로 남습니다.</Text>
        {isBes876 ? (
          <>
            <TermLabel label="BES876 도징 모드" glossaryId="auto_manual_dosing" recordingMode="guided" colors={colors} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <Chip label="AUTO 도징" active={shot.doseMode === 'auto'} colors={colors} onPress={() => patchShot('doseMode', 'auto')} />
              <Chip label="MANUAL 도징" active={shot.doseMode === 'manual'} colors={colors} onPress={() => patchShot('doseMode', 'manual')} />
            </View>
          </>
        ) : (
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>일반 장비 타이머</Text>
            <Text style={styles.small}>BES876이 아닌 장비는 MANUAL 기준으로 시간과 기본 레시피만 기록합니다.</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <Field label="커피 종류" value={shot.drinkType} onChangeText={v => patchShot('drinkType', v)} colors={colors} />
          <Field label="분쇄도 1-25" glossaryId="grind_size" recordingMode="quick" value={shot.grindSizeExternal} onChangeText={v => patchShot('grindSizeExternal', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="도징량 g" glossaryId="dose" recordingMode="quick" value={shot.actualDoseGram || shot.doseGram} onChangeText={v => { patchShot('actualDoseGram', v); patchShot('doseGram', v); }} colors={colors} keyboardType="decimal-pad" />
          <Field label="목표 추출량 g" glossaryId="yield" recordingMode="quick" value={shot.yieldGram} onChangeText={v => patchShot('yieldGram', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="목표 시간 s" glossaryId="brew_time" recordingMode="quick" value={shot.targetBrewSeconds} onChangeText={v => patchShot('targetBrewSeconds', v)} colors={colors} keyboardType="decimal-pad" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {drinkPresets.map(type => (
            <Chip key={type} label={type} active={shot.drinkType === type} colors={colors} onPress={() => setShot(prev => ({ ...prev, drinkType: type, servingTemperature: type.includes('아이스') ? 'iced' : prev.servingTemperature }))} />
          ))}
        </View>
        <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start', marginTop: 12 }]} onPress={() => setTimerAdvancedOpen(prev => !prev)}>
          <MaterialIcons name="tune" size={18} color={colors.text} />
          <Text style={styles.ghostText}>고급 세팅 {timerAdvancedOpen ? '접기' : '보기'}</Text>
        </TouchableOpacity>
        {timerAdvancedOpen && <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
          <Field label="분쇄도 메모" value={shot.grindSize} onChangeText={v => patchShot('grindSize', v)} colors={colors} />
          <Field label="내부 버" value={shot.innerBurrSetting} onChangeText={v => patchShot('innerBurrSetting', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="분쇄 시간 s" value={shot.grindSeconds} onChangeText={v => patchShot('grindSeconds', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="첫 방울 s" glossaryId="first_drip" recordingMode="precision" value={shot.firstDripSeconds} onChangeText={v => patchShot('firstDripSeconds', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="프리인퓨전 s" glossaryId="preinfusion" recordingMode="precision" value={shot.preinfusionSeconds} onChangeText={v => patchShot('preinfusionSeconds', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="물 온도" value={shot.waterTemperature} onChangeText={v => patchShot('waterTemperature', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="온도 오프셋" value={shot.temperatureOffset} onChangeText={v => patchShot('temperatureOffset', v)} colors={colors} keyboardType="decimal-pad" />
          <Field label="바스켓" value={shot.basket} onChangeText={v => patchShot('basket', v)} colors={colors} />
        </View>
        <TermLabel
          label="퍽 준비"
          glossaryIds={['wdt', 'leveling', 'tamping', 'puck_screen', 'bottomless_check']}
          recordingMode="precision"
          colors={colors}
          textStyle={{ color: colors.text, fontSize: 20, fontWeight: '800' }}
          containerStyle={{ marginTop: 22, marginBottom: 10 }}
        />
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {puckPrepOptions.map(tag => <Chip key={tag} label={tag} active={shot.puckPrep.includes(tag)} colors={colors} onPress={() => togglePuckPrep(tag)} />)}
          </View>
          <TermLabel label="채널링" glossaryId="channeling" recordingMode="precision" colors={colors} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {channelingOptions.map(([value, label]) => <Chip key={value} label={label} active={shot.channeling === value} colors={colors} onPress={() => patchShot('channeling', value)} />)}
          </View>
          {isBes876 && (
            <>
              <TermLabel label="BES876 게이지" glossaryIds={['dose_gauge', 'a_bit_more']} recordingMode="guided" colors={colors} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['under', 'Under'],
                  ['ideal', 'Ideal'],
                  ['a_bit_more', 'A Bit More'],
                  ['over', 'Over'],
                  ['unknown', '모름'],
                ].map(([value, label]) => <Chip key={value} label={label} active={shot.doseLevel === value} colors={colors} onPress={() => patchShot('doseLevel', value)} />)}
              </View>
            </>
          )}
          <TermLabel label="압력 게이지" glossaryId="pressure_gauge" recordingMode="precision" colors={colors} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['low', '압력 낮음'],
              ['espresso_range', '정상 범위'],
              ['high', '압력 높음'],
              ['unknown', '압력 모름'],
            ].map(([value, label]) => <Chip key={value} label={label} active={shot.pressureZone === value} colors={colors} onPress={() => patchShot('pressureZone', value)} />)}
          </View>
          <Text style={styles.label}>음료 레시피</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Field label="물 ml" value={shot.waterMl} onChangeText={v => patchShot('waterMl', v)} colors={colors} keyboardType="numeric" />
            <Field label="우유 ml" value={shot.milkMl} onChangeText={v => patchShot('milkMl', v)} colors={colors} keyboardType="numeric" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip label="핫" active={shot.servingTemperature === 'hot'} colors={colors} onPress={() => patchShot('servingTemperature', 'hot')} />
            <Chip label="아이스" active={shot.servingTemperature === 'iced'} colors={colors} onPress={() => patchShot('servingTemperature', 'iced')} />
          </View>
        </View>
        </>}
      </BottomSheetModal>

      <View style={[styles.card, { alignItems: 'center', marginTop: 18 }]}>
        <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>{shot.drinkType || '종류 모름'} · 분쇄 {shot.grindSize || '모름'} · 목표 {targetInput == null ? '모름' : `${targetInput}초`}</Text>
        <Text style={{ color: colors.text, fontSize: 72, fontWeight: '900', marginVertical: 16 }}>{formatSeconds(elapsed)}</Text>
        <View style={{ width: '100%', height: 12, borderRadius: 8, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%` as any, height: '100%', backgroundColor: progress >= 1 ? colors.danger : colors.primary }} />
        </View>
        <View style={{ width: '100%', marginTop: 18, gap: 10 }}>
          {!running ? (
            <TouchableOpacity style={[styles.button, { width: '100%', minHeight: 54 }]} onPress={start}>
              <MaterialIcons name={bean ? 'play-arrow' : 'coffee'} size={24} color="#fff" />
              <Text style={styles.buttonText}>{bean ? bean.lotStatus === 'unopened' ? '개봉 후 시작' : elapsed > 0 ? '계속' : '시작' : '원두 선택'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, { width: '100%', minHeight: 54, backgroundColor: colors.danger }]} onPress={stop}><MaterialIcons name="pause" size={22} color="#fff" /><Text style={styles.buttonText}>정지</Text></TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.ghostButton, { flex: 1, minHeight: 42 }]} onPress={() => setFirstDripLap(elapsed)}>
              <MaterialIcons name="flag" size={18} color={colors.text} />
              <Text style={styles.ghostText}>첫 방울</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghostButton, { flex: 1, minHeight: 42 }]} onPress={() => setPreinfusionLap(elapsed)}>
              <MaterialIcons name="timer" size={18} color={colors.text} />
              <Text style={styles.ghostText}>프리 종료</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ width: '100%', backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 10, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>랩 버튼 설명</Text>
            <TermHelpIcon glossaryIds={['first_drip', 'preinfusion']} recordingMode="precision" colors={colors} />
          </View>
          <Text style={styles.small}>처음엔 첫 방울만 눌러도 충분합니다. 프리 종료는 본격 추출 전 적시는 구간이 끝났다고 알 때만 누르세요. 모르면 비워둬도 됩니다.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <TouchableOpacity style={styles.ghostButton} onPress={() => { setLaps(prev => [...prev, elapsed]); setLapsOpen(true); }}><Text style={styles.ghostText}>구간 기록</Text></TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={reset}><Text style={styles.ghostText}>리셋</Text></TouchableOpacity>
        </View>
        <Text style={[styles.small, { marginTop: 10 }]}>첫 방울 {firstDripLap == null ? shot.firstDripSeconds || '-' : formatSeconds(firstDripLap)} · 프리 종료 {preinfusionLap == null ? shot.preinfusionSeconds || '-' : formatSeconds(preinfusionLap)}</Text>
      </View>

      {!running && elapsed > 0 ? (
        <>
          <Text style={styles.sectionTitle}>기록에 적용</Text>
          <View style={styles.card}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>측정값만 넘기기</Text>
            <Text style={styles.subtitle}>총 추출 시간과 첫 방울을 새 Log에 채웁니다. 프리인퓨전은 알고 있을 때만 함께 넘어가는 선택값입니다.</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginTop: 12 }}>
              총 {formatSeconds(elapsed)} · 첫 방울 {firstDripLap == null ? shot.firstDripSeconds || '-' : formatSeconds(firstDripLap)} · 프리 {preinfusionLap == null ? shot.preinfusionSeconds || '-' : formatSeconds(preinfusionLap)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.button, { flexGrow: 1 }]} onPress={useInNewLog}>
                <MaterialIcons name="open-in-new" size={20} color="#fff" />
                <Text style={styles.buttonText}>Log에 적용</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={reset}>
                <MaterialIcons name="delete-outline" size={20} color={colors.text} />
                <Text style={styles.ghostText}>버리기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <Text style={[styles.subtitle, { marginTop: 14 }]}>정지하면 이 시간을 기록 화면으로 넘길 수 있습니다.</Text>
      )}

      <TouchableOpacity style={[styles.ghostButton, { marginTop: 14 }]} onPress={() => setLapsOpen(prev => !prev)}>
        <Text style={styles.ghostText}>구간 기록 {laps.length}개 {lapsOpen ? '접기' : '보기'}</Text>
      </TouchableOpacity>
      {lapsOpen && (
        <View style={[styles.card, { marginTop: 8 }]}>
          {laps.length === 0 ? <Text style={styles.subtitle}>구간 기록이 없습니다.</Text> : laps.map((lap, index) => <Text key={`${lap}-${index}`} style={{ color: colors.text, fontSize: 16, marginBottom: 8 }}>#{index + 1} {formatSeconds(lap)}</Text>)}
        </View>
      )}
    </ScrollView>
  );
}
