import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BottomSheetModal, CoffeeLotSelectorSheet, LogSummary, MetricChip, RecommendationCard, TermHelpIcon, TermLabel, createCommonStyles } from '../../src/components';
import { ThemeColors, darkColors, lightColors } from '../../src/constants/theme';
import { GlossaryId } from '../../src/constants/glossary';
import { BeanAnalysisPhotoInput, analyzeBrewLogPhotos } from '../../src/services/ai';
import { copyAiText } from '../../src/services/aiCopy';
import { getUsageInfo } from '../../src/services/beanInventory';
import { persistPhoto } from '../../src/services/photos';
import { getDialInRecommendation } from '../../src/services/recommendation';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { Bean, BrewLog, BrewPhotoType, CoffeePurchaseLot, RecordingMode, TimeMeasurementSource } from '../../src/types/models';
import { daysBetween, emptyToNull, formatSeconds, isValidDateString, todayDate } from '../../src/utils';

const defaults = {
  drinkType: '',
  doseMode: 'auto' as 'auto' | 'manual',
  basketType: 'single_wall_2cup',
  shotButton: '2cup',
  grindSize: '',
  grindSizeExternal: null as number | null,
  innerBurrSetting: null as number | null,
  speed: '',
  grindSeconds: null as number | null,
  actualDoseGram: null as number | null,
  doseGram: null as number | null,
  yieldGram: null as number | null,
  brewSeconds: null as number | null,
  firstDripSeconds: null as number | null,
  timeMeasurementSource: 'manual' as TimeMeasurementSource,
  waterTemperature: null as number | null,
  temperatureOffset: null as number | null,
  preinfusionSeconds: null as number | null,
  basket: '',
  doseLevel: 'unknown',
  pressureZone: 'unknown',
  usedABitMore: false,
  usedRazorTrim: false,
  autoDoseResetDone: false,
  programmedVolumeChanged: false,
  nextAction: 'keep',
  puckPrep: [] as string[],
  tamping: '',
  channeling: '',
  shotResult: '',
  waterMl: null as number | null,
  milkMl: null as number | null,
  servingTemperature: '',
  rating: null as number | null,
  acidity: null as number | null,
  sweetness: null as number | null,
  bitterness: null as number | null,
  body: null as number | null,
  resultMemo: '',
};

const drinkPresets = ['에스프레소', '아메리카노', '라떼', '아이스 아메리카노', '아이스 라떼'];
const puckPrepOptions = ['WDT', '레벨링', '퍽스크린', '바텀리스 확인'];
const shotResults = ['좋음', '빠름', '느림', '시큼', '씀', '묽음', '채널링 의심', '기타'];
const basketOptions = [
  ['single_wall_1cup', '싱글월 1컵'],
  ['single_wall_2cup', '싱글월 2컵'],
  ['dual_wall_1cup', '듀얼월 1컵'],
  ['dual_wall_2cup', '듀얼월 2컵'],
] as const;
const shotButtonOptions = [
  ['1cup', '1 CUP'],
  ['2cup', '2 CUP'],
  ['manual', '수동 정지'],
] as const;
const doseLevelOptions = [
  ['under', 'Under'],
  ['ideal', 'Ideal'],
  ['a_bit_more', 'A Bit More'],
  ['over', 'Over'],
  ['unknown', '모름'],
] as const;
const pressureOptions = [
  ['low', '낮음'],
  ['espresso_range', '에스프레소 범위'],
  ['high', '높음'],
  ['unknown', '모름'],
] as const;
const nextActionOptions = [
  ['keep', '유지'],
  ['grind_finer', '더 곱게'],
  ['grind_coarser', '더 굵게'],
  ['increase_yield', '수율 증가'],
  ['decrease_yield', '수율 감소'],
  ['increase_dose', '도징 증가'],
  ['decrease_dose', '도징 감소'],
] as const;
const timeSourceOptions = [
  ['manual', '직접 입력'],
  ['in_app_timer', '앱 타이머'],
  ['external_scale', '저울 타이머'],
  ['external_timer', '외부 스톱워치'],
  ['estimated', '추정'],
] as const;
const timeSourceLabel = (source: TimeMeasurementSource) => timeSourceOptions.find(([value]) => value === source)?.[1] ?? '직접 입력';
const timeSourceAfterManualEdit = (source: TimeMeasurementSource) => source === 'in_app_timer' || source === 'estimated' ? 'manual' : source;
const compactSeconds = (value: number | null) => value == null ? '-' : `${value}초`;

const isBes876Equipment = (equipment?: { name?: string | null; model?: string | null; brand?: string | null } | null) => {
  const text = [equipment?.name, equipment?.model, equipment?.brand].filter(Boolean).join(' ').toUpperCase();
  return text.includes('BES876') || text.includes('876') || text.includes('BARISTA EXPRESS IMPRESS');
};

const externalAiTargets = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
};
const photoGuide = [
  { type: 'bean_label', stage: 'Before Shot', label: '원두 라벨', need: '권장', place: '원두 봉투 전면', why: '원두명과 로스터를 나중에 확인합니다.' },
  { type: 'roast_date_label', stage: 'Before Shot', label: '날짜 라벨', need: '권장', place: '로스팅일/유통기한 스티커', why: '원두 나이에 따른 흐름 변화를 비교합니다.' },
  { type: 'grind_dial', stage: 'Before Shot', label: '분쇄도 다이얼', need: '권장', place: '오른쪽 그라인드 다이얼 숫자', why: 'BES876 1-25 위치를 눈으로 재확인합니다.' },
  { type: 'dose_gauge', stage: 'After Dosing', label: '도즈 게이지', need: '추천', place: '탬핑 후 Under/Ideal/A Bit More 표시', why: 'AUTO 도징 판단의 핵심입니다.' },
  { type: 'tamped_puck', stage: 'After Dosing', label: '탬핑 후 퍽', need: '선택', place: '포터필터 안 퍽 표면', why: 'Razor 트리밍과 수평 탬핑을 봅니다.' },
  { type: 'pressure_gauge', stage: 'Extraction', label: '압력 게이지', need: '추천', place: '추출 피크 때 중앙 게이지', why: '낮음/정상/높음 압력을 비교합니다.' },
  { type: 'espresso_result', stage: 'Extraction', label: '추출 컵', need: '추천', place: '컵의 크레마와 양', why: '색, 흐름, 수율 변화를 비교합니다.' },
  { type: 'spent_puck', stage: 'After Shot', label: '사용 후 퍽', need: '선택', place: '추출 후 퍽 표면', why: '균열, 물기, 채널링 흔적이 있을 때 남깁니다.' },
  { type: 'clean_descale_light', stage: 'Maintenance', label: 'CLEAN/DESCALE 등', need: '선택', place: '머신 전면 상태등', why: '세척/디스케일 알림을 헷갈릴 때 남깁니다.' },
] as const;
const recordingModes = [
  ['quick', 'Quick', '도징량/수율/시간만 빠르게'],
  ['guided', 'Guided', 'BES876 핵심 게이지까지'],
  ['precision', 'Precision', '모든 변수 열기'],
] as const;
const channelingOptions = [
  ['none', '없음'],
  ['suspected', '의심'],
  ['visible', '보임'],
] as const;
const tampingOptions = ['안정', '약함', '강함'];

type NumberKey = 'grindSizeExternal' | 'innerBurrSetting' | 'grindSeconds' | 'actualDoseGram' | 'doseGram' | 'yieldGram' | 'brewSeconds' | 'firstDripSeconds' | 'waterTemperature' | 'temperatureOffset' | 'preinfusionSeconds' | 'waterMl' | 'milkMl' | 'rating' | 'acidity' | 'sweetness' | 'bitterness' | 'body';

const suggestedStart: Record<NumberKey, number> = {
  grindSeconds: 12.5,
  grindSizeExternal: 12,
  innerBurrSetting: 6,
  actualDoseGram: 18,
  doseGram: 18,
  yieldGram: 36,
  brewSeconds: 28,
  firstDripSeconds: 9,
  waterTemperature: 93,
  temperatureOffset: 0,
  preinfusionSeconds: 0,
  waterMl: 120,
  milkMl: 150,
  rating: 3,
  acidity: 3,
  sweetness: 3,
  bitterness: 2,
  body: 3,
};

const displayNumber = (value: number | null, unit: string) => value == null ? '모름' : `${value}${unit}`;

type PhotoSource = 'camera' | 'library';
type PendingPhoto = { uri: string; type: BrewPhotoType | 'etc'; createdAt: string; isPrimary?: boolean };

const brewPhotoLabel = (type: BrewPhotoType | 'etc') => photoGuide.find(item => item.type === type)?.label ?? (type === 'etc' ? '기타' : type);
const normalizeBrewPhotoType = (type?: string): BrewPhotoType | 'etc' => {
  if (!type) return 'etc';
  return photoGuide.some(item => item.type === type) ? type as BrewPhotoType : 'etc';
};

function Chip({ label, active, colors, onPress }: { label: string; active: boolean; colors: ThemeColors; onPress: () => void }) {
  const styles = createCommonStyles(colors);
  return (
    <TouchableOpacity style={[styles.ghostButton, active && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={onPress}>
      <Text style={styles.ghostText}>{label}</Text>
    </TouchableOpacity>
  );
}

const modeRank: Record<RecordingMode, number> = { quick: 0, guided: 1, precision: 2 };
const includesMode = (mode: RecordingMode, min: RecordingMode) => modeRank[mode] >= modeRank[min];

const splitTags = (value: string | null | undefined) => (value ?? '').split(',').map(item => item.trim()).filter(Boolean);

const lotStatusLabel: Record<string, string> = {
  unopened: '미개봉',
  open: '사용중',
  finished: '소진',
  archived: '보관',
};

const lotAge = (label: string, date?: string | null) => {
  if (!date || !isValidDateString(date)) return `${label} -`;
  const days = daysBetween(date, todayDate());
  return Number.isFinite(days) ? `${label} +${days}일` : `${label} ${date}`;
};

const expiryText = (date?: string | null) => {
  if (!date || !isValidDateString(date)) return '유통기한 미입력';
  const days = daysBetween(todayDate(), date);
  if (!Number.isFinite(days)) return `유통기한 ${date}`;
  if (days < 0) return `유통기한 ${Math.abs(days)}일 지남`;
  if (days === 0) return '유통기한 오늘';
  return `유통기한 D-${days}`;
};

const gramText = (value: number | null | undefined) => value == null ? '-' : `${value}g`;

const formatGram = (value: number | null | undefined) => value == null ? '-' : `${Math.round(value * 10) / 10}g`;

const lotIndexText = (bean: Bean, beans: Bean[]) => {
  if (!bean.productId) return '구매분';
  const group = beans
    .filter(item => item.productId === bean.productId)
    .sort((a, b) => (a.purchaseDate ?? a.createdAt).localeCompare(b.purchaseDate ?? b.createdAt));
  const index = group.findIndex(item => item.id === bean.id);
  return `${index >= 0 ? index + 1 : 1}번째 구매분`;
};

function CoreNumberInput({
  label,
  value,
  unit,
  colors,
  onChange,
  glossaryId,
  recordingMode,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
}: {
  label: string;
  value: number | null;
  unit?: string;
  colors: ThemeColors;
  onChange: (value: number | null) => void;
  glossaryId?: GlossaryId;
  recordingMode?: RecordingMode;
  inputRef?: React.RefObject<any>;
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
}) {
  const styles = createCommonStyles(colors);
  return (
    <View style={{ flex: 1, minWidth: 130 }}>
      <TermLabel label={label} glossaryId={glossaryId} recordingMode={recordingMode} colors={colors} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { flex: 1, minHeight: 44, paddingVertical: 8 }]}
          keyboardType="decimal-pad"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          value={value == null ? '' : String(value)}
          onChangeText={text => {
            const trimmed = text.trim();
            if (!trimmed) {
              onChange(null);
              return;
            }
            const parsed = Number(trimmed);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          placeholder="-"
          placeholderTextColor={colors.textTertiary}
        />
        {!!unit && <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>{unit}</Text>}
      </View>
    </View>
  );
}

type BrewPhotoSlot = {
  key: string;
  label: string;
  primaryType: BrewPhotoType;
  types: Array<BrewPhotoType | 'etc'>;
};

function BrewPhotoSlotStrip({
  slots,
  photos,
  colors,
  onCamera,
  onLibrary,
  onOpen,
  onRemove,
}: {
  slots: BrewPhotoSlot[];
  photos: PendingPhoto[];
  colors: ThemeColors;
  onCamera: (type: BrewPhotoType) => void;
  onLibrary: (type: BrewPhotoType) => void;
  onOpen: (uri: string) => void;
  onRemove: (uri: string) => void;
}) {
  const styles = createCommonStyles(colors);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {slots.map(slot => {
          const attached = photos.filter(photo => slot.types.includes(photo.type));
          const first = attached[0];
          return (
            <View key={slot.key} style={{ width: 132, minHeight: 184, borderWidth: 1, borderColor: first ? colors.primary : colors.border, backgroundColor: first ? colors.badge : colors.surfaceAlt, borderRadius: 8, padding: 9, gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{slot.label}</Text>
              {first ? (
                <TouchableOpacity onPress={() => onOpen(first.uri)}>
                  <Image source={{ uri: first.uri }} style={{ width: '100%', height: 82, borderRadius: 8, backgroundColor: colors.surface }} />
                </TouchableOpacity>
              ) : (
                <View style={{ height: 82, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="add-a-photo" size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity accessibilityLabel={`${slot.label} 촬영`} style={[styles.ghostButton, { flex: 1, minHeight: 32, paddingHorizontal: 0 }]} onPress={() => onCamera(slot.primaryType)}>
                  <MaterialIcons name="photo-camera" size={16} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel={`${slot.label} 앨범 선택`} style={[styles.ghostButton, { flex: 1, minHeight: 32, paddingHorizontal: 0 }]} onPress={() => onLibrary(slot.primaryType)}>
                  <MaterialIcons name="photo-library" size={16} color={colors.text} />
                </TouchableOpacity>
              </View>
              {first && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={[styles.ghostButton, { flex: 1, minHeight: 30, paddingHorizontal: 0 }]} onPress={() => onOpen(first.uri)}>
                    <Text style={styles.ghostText}>보기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { flex: 1, minHeight: 30, paddingHorizontal: 0, borderColor: colors.danger }]} onPress={() => attached.forEach(photo => onRemove(photo.uri))}>
                    <Text style={[styles.ghostText, { color: colors.danger }]}>삭제</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const beanToPurchaseLot = (bean: Bean): CoffeePurchaseLot | null => {
  if (!bean.productId) return null;
  return {
    id: bean.id,
    productId: bean.productId,
    purchaseDate: bean.purchaseDate,
    roastDate: bean.roastDate,
    openedDate: bean.openedDate,
    expiryDate: bean.expiryDate,
    storageType: bean.storageType,
    initialWeightGram: bean.initialWeightGram,
    remainingWeightGram: bean.remainingWeightGram,
    lotStatus: bean.lotStatus,
    seller: bean.seller,
    price: bean.price,
    lotMemo: bean.lotMemo,
    mainPhotoUri: bean.mainPhotoUri,
    createdAt: bean.createdAt,
    updatedAt: bean.updatedAt,
  };
};

export default function LogScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const params = useLocalSearchParams<{ action?: string; ts?: string }>();
  const handledWidgetAction = useRef<string | null>(null);
  const isDarkMode = useSettingsStore(s => s.isDarkMode);
  const defaultRecordingMode = useSettingsStore(s => s.recordingMode);
  const aiProvider = useSettingsStore(s => s.aiProvider);
  const openAiModel = useSettingsStore(s => s.openAiModel);
  const geminiModel = useSettingsStore(s => s.geminiModel);
  const showDebugInfo = useSettingsStore(s => s.showDebugInfo);
  const collapsedSections = useSettingsStore(s => s.logCollapsedSections);
  const setLogSectionCollapsed = useSettingsStore(s => s.setLogSectionCollapsed);
  const colors = isDarkMode ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  const { beans, purchaseLots, logs, photosByLog, equipment, selectedEquipmentId, selectedBeanId, selectBean, settingsByBean, savePurchaseLot, saveLog, removeLog, loadBrewLogPhotos, attachBrewLogPhoto, removeBrewLogPhoto, pendingTimerResult, consumePendingTimerResult } = useCoffeeStore();
  const bean = beans.find(b => b.id === selectedBeanId) ?? beans[0] ?? null;
  const selectedEquipment = equipment.find(item => item.id === selectedEquipmentId) ?? equipment[0] ?? null;
  const isBes876 = isBes876Equipment(selectedEquipment);
  const beanLogs = useMemo(() => logs.filter(log => !bean || (log.purchaseLotId ?? log.beanId) === bean.id), [logs, bean?.id]);
  const recommendation = getDialInRecommendation(bean, logs, bean ? settingsByBean[bean.id] : null);
  const usageInfo = useMemo(() => bean ? getUsageInfo(bean, logs, settingsByBean[bean.id]) : null, [bean, logs, settingsByBean]);
  const [form, setForm] = useState(defaults);
  const [favorite, setFavorite] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(defaultRecordingMode);
  const [timerOpen, setTimerOpen] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFirstDrip, setTimerFirstDrip] = useState<number | null>(null);
  const [timerPreinfusion, setTimerPreinfusion] = useState<number | null>(null);
  const [timeDetailOpen, setTimeDetailOpen] = useState(false);
  const [pendingOpenLotId, setPendingOpenLotId] = useState<string | null>(null);
  const [lotPickerOpen, setLotPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [lotDetailOpen, setLotDetailOpen] = useState(false);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(false);
  const [balanceDraft, setBalanceDraft] = useState('');
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const [photoAiBusy, setPhotoAiBusy] = useState(false);
  const [aiAdviceQuestion, setAiAdviceQuestion] = useState('다음 샷에서 분쇄도, 도징량, 수율, 시간 중 무엇을 먼저 바꾸면 좋을까?');
  const [filter, setFilter] = useState<'all' | 'favorite' | 'high'>('all');
  const [drinkFilter, setDrinkFilter] = useState('all');
  const [visibleLogCount, setVisibleLogCount] = useState(10);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [inlineEditorLogId, setInlineEditorLogId] = useState<string | null>(null);
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const [aiSheetLog, setAiSheetLog] = useState<BrewLog | null>(null);
  const timerStartedAt = useRef<number | null>(null);
  const timerBase = useRef(0);
  const grindInputRef = useRef<any>(null);
  const doseInputRef = useRef<any>(null);
  const yieldInputRef = useRef<any>(null);
  const timeInputRef = useRef<any>(null);
  const showGuided = includesMode(recordingMode, 'guided');
  const showPrecision = includesMode(recordingMode, 'precision');
  const sectionOpen = (key: string, defaultOpen = true) => collapsedSections[key] == null ? defaultOpen : !collapsedSections[key];
  const toggleSection = (key: string, open: boolean) => setLogSectionCollapsed(key, open);
  const primaryQuickPhotoType = isBes876 && form.doseMode === 'auto' ? 'dose_gauge' : 'tamped_puck';
  const brewPhotoSlots: BrewPhotoSlot[] = [
    {
      key: 'dose_puck',
      label: isBes876 && form.doseMode === 'auto' ? '도즈/퍽' : '퍽',
      primaryType: primaryQuickPhotoType as BrewPhotoType,
      types: ['dose_gauge', 'tamped_puck'],
    },
    {
      key: 'pressure',
      label: '압력',
      primaryType: 'pressure_gauge',
      types: ['pressure_gauge'],
    },
    {
      key: 'cup_result',
      label: '결과 컵',
      primaryType: 'espresso_result',
      types: ['espresso_result'],
    },
  ];
  const editingLog = editingLogId ? logs.find(log => log.id === editingLogId) ?? null : null;
  const currentDoseForUsage = form.actualDoseGram ?? form.doseGram ?? usageInfo?.doseBasis ?? 18;
  const previousDoseForEdit = editingLog?.actualDoseGram ?? editingLog?.doseGram ?? 0;
  const usageDelta = editingLog ? (currentDoseForUsage ?? 0) - previousDoseForEdit : (currentDoseForUsage ?? 0);
  const remainingAfterThisShot = usageInfo?.displayRemaining == null ? null : Math.max(0, usageInfo.displayRemaining - usageDelta);
  const estimatedCupsAfterThisShot = remainingAfterThisShot == null || !currentDoseForUsage ? null : Math.floor(remainingAfterThisShot / currentDoseForUsage);
  const effectiveProductKey = selectedProductKey ?? bean?.productId ?? bean?.id ?? null;
  const productLots = useMemo(
    () => effectiveProductKey ? beans.filter(item => (item.productId ?? item.id) === effectiveProductKey) : [],
    [beans, effectiveProductKey]
  );
  const selectedProductLogCount = useMemo(
    () => logs.filter(log => productLots.some(lot => lot.id === (log.purchaseLotId ?? log.beanId))).length,
    [logs, productLots]
  );
  const draftPhotoUris = useMemo(() => new Set([...pendingPhotos.map(photo => photo.uri), ...(photoUri ? [photoUri] : [])]), [pendingPhotos, photoUri]);
  const photoCount = draftPhotoUris.size;
  const primaryPhotoUri = pendingPhotos.find(photo => photo.isPrimary)?.uri ?? pendingPhotos[0]?.uri ?? photoUri;
  const markLotOpen = async (selectedLot: Bean) => {
    const source = purchaseLots.find(lot => lot.id === selectedLot.id) ?? beanToPurchaseLot(selectedLot);
    if (!source) return selectedLot;
    const saved = await savePurchaseLot({
      ...source,
      openedDate: source.openedDate ?? todayDate(),
      lotStatus: 'open',
    });
    return beans.find(item => item.id === saved.id) ?? selectedLot;
  };
  const selectLotForLog = (id: string) => {
    const lot = beans.find(item => item.id === id);
    if (!lot) return;
    setSelectedProductKey(lot.productId ?? lot.id);
    selectBean(lot.id);
    setPendingOpenLotId(lot.lotStatus === 'unopened' ? lot.id : null);
    setLotPickerOpen(false);
  };

  const selectProductForLog = (productKey: string) => {
    const lots = beans.filter(item => (item.productId ?? item.id) === productKey);
    const recommended = lots.find(item => item.lotStatus === 'open') ?? lots.find(item => item.lotStatus === 'unopened') ?? lots[0];
    setSelectedProductKey(productKey);
    if (recommended) {
      selectBean(recommended.id);
      setPendingOpenLotId(recommended.lotStatus === 'unopened' ? recommended.id : null);
    }
    setProductPickerOpen(false);
    setLotPickerOpen(true);
  };
  useEffect(() => {
    setRecordingMode(defaultRecordingMode);
  }, [defaultRecordingMode]);

  useEffect(() => {
    if (!isBes876 && form.doseMode !== 'manual') {
      setForm(prev => ({ ...prev, doseMode: 'manual', doseLevel: 'unknown', usedABitMore: false, usedRazorTrim: false, autoDoseResetDone: false }));
    }
  }, [isBes876, form.doseMode]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      if (timerStartedAt.current) setTimerElapsed(timerBase.current + (Date.now() - timerStartedAt.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (!bean) return;
    if (editingLogId) return;
    const setting = settingsByBean[bean.id];
    const last = logs.find(log => (log.purchaseLotId ?? log.beanId) === bean.id);
    setForm(prev => ({
      ...prev,
      drinkType: setting?.drinkType ?? last?.drinkType ?? '에스프레소',
      doseMode: last?.doseMode ?? 'auto',
      basketType: last?.basketType ?? 'single_wall_2cup',
      shotButton: last?.shotButton ?? '2cup',
      grindSize: setting?.grindSize ?? last?.grindSize ?? '',
      grindSizeExternal: last?.grindSizeExternal ?? (setting?.grindSize ? Number(setting.grindSize) || null : null),
      innerBurrSetting: last?.innerBurrSetting ?? null,
      speed: setting?.speed ?? last?.speed ?? '',
      grindSeconds: setting?.grindSeconds ?? last?.grindSeconds ?? null,
      actualDoseGram: last?.actualDoseGram ?? setting?.doseGram ?? last?.doseGram ?? null,
      doseGram: setting?.doseGram ?? last?.doseGram ?? null,
      yieldGram: setting?.yieldGram ?? last?.yieldGram ?? null,
      brewSeconds: setting?.targetBrewSeconds ?? last?.brewSeconds ?? null,
      firstDripSeconds: last?.firstDripSeconds ?? null,
      timeMeasurementSource: last?.timeMeasurementSource ?? 'manual',
      waterTemperature: last?.waterTemperature ?? null,
      temperatureOffset: last?.temperatureOffset ?? null,
      preinfusionSeconds: last?.preinfusionSeconds ?? null,
      basket: last?.basket ?? '',
      doseLevel: last?.doseLevel ?? 'unknown',
      pressureZone: last?.pressureZone ?? 'unknown',
      usedABitMore: last?.usedABitMore ?? false,
      usedRazorTrim: last?.usedRazorTrim ?? false,
      autoDoseResetDone: last?.autoDoseResetDone ?? false,
      programmedVolumeChanged: last?.programmedVolumeChanged ?? false,
      nextAction: last?.nextAction ?? 'keep',
      puckPrep: splitTags(last?.puckPrep),
      tamping: last?.tamping ?? '',
      channeling: last?.channeling ?? '',
      shotResult: last?.shotResult ?? '',
      waterMl: last?.waterMl ?? null,
      milkMl: last?.milkMl ?? null,
      servingTemperature: last?.servingTemperature ?? ((last?.drinkType ?? '').includes('아이스') ? 'iced' : ''),
    }));
  }, [bean?.id]);

  useEffect(() => {
    if (!pendingTimerResult) return;
    const result = consumePendingTimerResult();
    if (!result) return;
    setForm(prev => ({
      ...prev,
      brewSeconds: Number(result.brewSeconds.toFixed(1)),
      firstDripSeconds: result.firstDripSeconds == null ? prev.firstDripSeconds : Number(result.firstDripSeconds.toFixed(1)),
      preinfusionSeconds: result.preinfusionSeconds == null ? prev.preinfusionSeconds : Number(result.preinfusionSeconds.toFixed(1)),
      timeMeasurementSource: result.source,
    }));
  }, [pendingTimerResult, consumePendingTimerResult]);

  const drinkTypes = useMemo(() => {
    const names = beanLogs.map(log => log.drinkType?.trim()).filter(Boolean) as string[];
    return [...new Set([...drinkPresets, ...names])];
  }, [beanLogs]);

  const adjust = (key: NumberKey, delta: number, min = 0, max = 999) => {
    setForm(prev => {
      const base = prev[key] ?? suggestedStart[key];
      return { ...prev, [key]: Math.min(max, Math.max(min, Number((base + delta).toFixed(1)))) };
    });
  };

  const markUnknown = (key: NumberKey) => setForm(prev => ({ ...prev, [key]: null }));

  const setTimingValue = (key: 'brewSeconds' | 'firstDripSeconds' | 'preinfusionSeconds', value: number | null) => {
    setForm(prev => ({ ...prev, [key]: value, timeMeasurementSource: timeSourceAfterManualEdit(prev.timeMeasurementSource) }));
  };

  const startLogTimer = () => {
    if (timerRunning) return;
    timerStartedAt.current = Date.now();
    timerBase.current = timerElapsed;
    setTimerRunning(true);
  };

  const stopLogTimer = () => {
    if (!timerRunning) return;
    timerBase.current = timerElapsed;
    timerStartedAt.current = null;
    setTimerRunning(false);
  };

  const resetLogTimer = () => {
    setTimerRunning(false);
    timerStartedAt.current = null;
    timerBase.current = 0;
    setTimerElapsed(0);
    setTimerFirstDrip(null);
    setTimerPreinfusion(null);
  };

  const applyLogTimer = () => {
    if (timerElapsed <= 0) {
      Alert.alert('타이머 필요', '시간을 잰 뒤 적용하세요.');
      return;
    }
    stopLogTimer();
    setForm(prev => ({
      ...prev,
      brewSeconds: Number(timerElapsed.toFixed(1)),
      firstDripSeconds: timerFirstDrip == null ? prev.firstDripSeconds : Number(timerFirstDrip.toFixed(1)),
      preinfusionSeconds: timerPreinfusion == null ? prev.preinfusionSeconds : Number(timerPreinfusion.toFixed(1)),
      timeMeasurementSource: 'in_app_timer',
    }));
    setTimerOpen(false);
  };

  const togglePuckPrep = (tag: string) => {
    setForm(prev => ({
      ...prev,
      puckPrep: prev.puckPrep.includes(tag) ? prev.puckPrep.filter(item => item !== tag) : [...prev.puckPrep, tag],
    }));
  };

  const formFromLog = (source: BrewLog) => ({
    drinkType: source.drinkType ?? '',
    doseMode: source.doseMode ?? 'auto',
    basketType: source.basketType ?? 'single_wall_2cup',
    shotButton: source.shotButton ?? '2cup',
    grindSize: source.grindSize ?? '',
    grindSizeExternal: source.grindSizeExternal ?? null,
    innerBurrSetting: source.innerBurrSetting ?? null,
    speed: source.speed ?? '',
    grindSeconds: source.grindSeconds ?? null,
    actualDoseGram: source.actualDoseGram ?? source.doseGram ?? null,
    doseGram: source.doseGram ?? null,
    yieldGram: source.yieldGram ?? null,
    brewSeconds: source.brewSeconds ?? null,
    firstDripSeconds: source.firstDripSeconds ?? null,
    timeMeasurementSource: source.timeMeasurementSource ?? 'manual',
    waterTemperature: source.waterTemperature ?? null,
    temperatureOffset: source.temperatureOffset ?? null,
    preinfusionSeconds: source.preinfusionSeconds ?? null,
    basket: source.basket ?? '',
    doseLevel: source.doseLevel ?? 'unknown',
    pressureZone: source.pressureZone ?? 'unknown',
    usedABitMore: source.usedABitMore ?? false,
    usedRazorTrim: source.usedRazorTrim ?? false,
    autoDoseResetDone: source.autoDoseResetDone ?? false,
    programmedVolumeChanged: source.programmedVolumeChanged ?? false,
    nextAction: source.nextAction ?? 'keep',
    puckPrep: splitTags(source.puckPrep),
    tamping: source.tamping ?? '',
    channeling: source.channeling ?? '',
    shotResult: source.shotResult ?? '',
    waterMl: source.waterMl ?? null,
    milkMl: source.milkMl ?? null,
    servingTemperature: source.servingTemperature ?? ((source.drinkType ?? '').includes('아이스') ? 'iced' : ''),
    rating: source.rating ?? null,
    acidity: source.acidity ?? null,
    sweetness: source.sweetness ?? null,
    bitterness: source.bitterness ?? null,
    body: source.body ?? null,
    resultMemo: source.resultMemo ?? '',
  });

  const resetDraft = () => {
    setForm(defaults);
    setFavorite(false);
    setPhotoUri(null);
    setPendingPhotos([]);
    setEditingLogId(null);
    setEditorOpen(false);
    setInlineEditorLogId(null);
    setPendingOpenLotId(null);
    setEditorOpen(false);
    setInlineEditorLogId(null);
  };

  const startEditLog = (source: BrewLog) => {
    const targetLotId = source.purchaseLotId ?? source.beanId;
    const targetLot = beans.find(item => item.id === targetLotId);
    if (targetLot) setSelectedProductKey(targetLot.productId ?? targetLot.id);
    if (targetLotId && targetLotId !== selectedBeanId) selectBean(targetLotId);
    setForm(formFromLog(source));
    setFavorite(source.isFavorite);
    setPhotoUri(source.photoUri ?? null);
    setPendingPhotos([]);
    setEditingLogId(source.id);
    setEditorOpen(true);
    setInlineEditorLogId(source.id);
    setExpandedLogIds(prev => ({ ...prev, [source.id]: true }));
    void loadBrewLogPhotos(source.id);
  };

  const duplicateLog = (source: BrewLog) => {
    const targetLotId = source.purchaseLotId ?? source.beanId;
    const targetLot = beans.find(item => item.id === targetLotId);
    if (targetLot) setSelectedProductKey(targetLot.productId ?? targetLot.id);
    if (targetLotId && targetLotId !== selectedBeanId) selectBean(targetLotId);
    setForm(formFromLog(source));
    setFavorite(false);
    setPhotoUri(source.photoUri ?? null);
    setPendingPhotos([]);
    setEditingLogId(null);
    setEditorOpen(true);
    setInlineEditorLogId(null);
  };

  const confirmDeleteLog = (source: BrewLog) => {
    const lot = beans.find(item => item.id === (source.purchaseLotId ?? source.beanId));
    const usage = lot ? getUsageInfo(lot, logs, settingsByBean[lot.id]) : null;
    const dose = source.actualDoseGram ?? source.doseGram ?? 0;
    const after = usage?.displayRemaining == null ? null : usage.displayRemaining + dose;
    Alert.alert('기록 삭제', '이 기록을 삭제할까요?', [
      { text: '취소' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await removeLog(source.id);
            Alert.alert(
              '기록 삭제 완료',
              `${lot ? `${lot.name} · ${lotIndexText(lot, beans)}` : '연결된 구매분'}\n잔량 복원: ${formatGram(usage?.displayRemaining)} -> ${formatGram(after)} (+${formatGram(dose)})`
            );
          })();
        },
      },
    ]);
  };

  const toggleLogExpanded = (source: BrewLog) => {
    const nextOpen = !expandedLogIds[source.id];
    setExpandedLogIds(prev => ({ ...prev, [source.id]: nextOpen }));
    if (nextOpen && !photosByLog[source.id]) void loadBrewLogPhotos(source.id);
  };

  const confirmDeleteSavedPhoto = (logId: string, photoId: string) => {
    Alert.alert('사진 삭제', '이 사진을 기록에서 삭제할까요?', [
      { text: '취소' },
      { text: '삭제', style: 'destructive', onPress: () => void removeBrewLogPhoto(logId, photoId) },
    ]);
  };

  const copyPrevious = () => {
    const source = beanLogs.find(log => log.isFavorite) ?? beanLogs[0];
    if (!source) {
      Alert.alert('복사할 기록 없음', '먼저 기록을 하나 저장하세요.');
      return;
    }
    setForm(formFromLog(source));
    setFavorite(false);
    setPhotoUri(source.photoUri ?? null);
    setPendingPhotos([]);
    setEditingLogId(null);
  };

  const copyLogForAi = async (log: BrewLog, target?: keyof typeof externalAiTargets) => {
    if (!bean) {
      Alert.alert('원두 필요', '먼저 원두를 선택하세요.');
      return;
    }
    try {
      await copyAiText({ bean, setting: settingsByBean[bean.id], selectedLog: log, logs: beanLogs, question: aiAdviceQuestion });
      if (target) {
        await Linking.openURL(externalAiTargets[target]);
        Alert.alert('AI 질문 복사 완료', `${target === 'chatgpt' ? 'ChatGPT' : 'Gemini'}가 열리면 입력창에 붙여넣으세요.`);
        return;
      }
      Alert.alert('AI 질문 복사 완료', '원두 상태, 선택 기록, 최근 기록, 질문을 클립보드에 복사했습니다.');
    } catch (error: any) {
      Alert.alert('복사 실패', error?.message ?? '클립보드 복사 중 오류가 발생했습니다.');
    }
  };

  const pickPhoto = async (photoType?: string, source: PhotoSource = 'library') => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', source === 'camera' ? '사진 촬영을 위해 카메라 권한을 허용해주세요.' : '사진 선택을 위해 사진 접근 권한을 허용해주세요.');
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true });
    if (!result.canceled && result.assets.length) {
      const type = normalizeBrewPhotoType(photoType);
      const stored = await Promise.all(result.assets.map(asset => persistPhoto(asset.uri, 'brew')));
      const createdAt = new Date().toISOString();
      setPendingPhotos(prev => [
        ...prev,
        ...stored.map((uri, index) => ({ uri, type, createdAt, isPrimary: prev.length === 0 && index === 0 && !photoUri })),
      ]);
      if (!photoType && !photoUri && stored[0]) setPhotoUri(stored[0]);
    }
  };

  const removePendingPhoto = (uri: string) => setPendingPhotos(prev => prev.filter(photo => photo.uri !== uri));

  const copySupportInfo = async (payload: Record<string, unknown>) => {
    await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
    Alert.alert('지원 정보 복사 완료', '문제 해결용 정보를 클립보드에 복사했습니다.');
  };

  const openBalanceAdjustment = () => {
    if (!bean) return;
    setBalanceDraft(bean.remainingWeightGram == null ? '' : String(bean.remainingWeightGram));
    setBalanceSheetOpen(true);
  };

  const saveBalanceAdjustment = async () => {
    if (!bean) return;
    const source = purchaseLots.find(lot => lot.id === bean.id) ?? beanToPurchaseLot(bean);
    if (!source) {
      Alert.alert('구매분 오류', '남은 양을 보정할 구매분을 찾지 못했습니다.');
      return;
    }
    const trimmed = balanceDraft.trim();
    const parsed = trimmed ? Number(trimmed) : null;
    if (trimmed && (parsed == null || !Number.isFinite(parsed) || parsed < 0)) {
      Alert.alert('값 확인', '남은 양은 0 이상의 숫자로 입력하세요.');
      return;
    }
    const saved = await savePurchaseLot({ ...source, remainingWeightGram: parsed });
    selectBean(saved.id);
    setBalanceSheetOpen(false);
  };

  const applyPhotoAnalysis = async () => {
    const entries = pendingPhotos.slice(0, 8);
    if (entries.length === 0) {
      Alert.alert('사진 필요', '분석할 샷 사진을 먼저 첨부하세요.');
      return;
    }
    if (aiProvider === 'none') {
      Alert.alert('AI 제공자 필요', '설정에서 OpenAI 또는 Gemini 제공자와 활성 API 키를 먼저 설정하세요.');
      return;
    }
    setPhotoAiBusy(true);
    try {
      const inputs: BeanAnalysisPhotoInput[] = entries.map((photo, index) => ({
        id: `${photo.type}-${index}`,
        uri: photo.uri,
        photoType: photo.type,
        label: brewPhotoLabel(photo.type),
      }));
      const parsed = await analyzeBrewLogPhotos(aiProvider, aiProvider === 'openai' ? openAiModel : geminiModel, inputs, isBes876 ? form.doseMode : 'manual', bean?.id ?? null);
      setForm(prev => ({
        ...prev,
        grindSizeExternal: parsed.grind_size_external ?? prev.grindSizeExternal,
        actualDoseGram: parsed.actual_dose_gram ?? prev.actualDoseGram,
        yieldGram: parsed.yield_gram ?? prev.yieldGram,
        brewSeconds: parsed.brew_seconds ?? prev.brewSeconds,
        firstDripSeconds: parsed.first_drip_seconds ?? prev.firstDripSeconds,
        preinfusionSeconds: parsed.preinfusion_seconds ?? prev.preinfusionSeconds,
        timeMeasurementSource: parsed.brew_seconds == null && parsed.first_drip_seconds == null && parsed.preinfusion_seconds == null ? prev.timeMeasurementSource : 'estimated',
        doseLevel: parsed.dose_level ?? prev.doseLevel,
        pressureZone: parsed.pressure_zone ?? prev.pressureZone,
        usedABitMore: parsed.used_a_bit_more ?? prev.usedABitMore,
        usedRazorTrim: parsed.used_razor_trim ?? prev.usedRazorTrim,
        shotResult: parsed.shot_result ?? prev.shotResult,
        channeling: parsed.channeling ?? prev.channeling,
        resultMemo: [prev.resultMemo, parsed.visible_text_summary ? `AI 사진 판독: ${parsed.visible_text_summary}` : null, parsed.warnings.length ? `주의: ${parsed.warnings.join(', ')}` : null]
          .filter(Boolean)
          .join('\n'),
      }));
      const applied = [
        parsed.grind_size_external != null ? '분쇄도' : null,
        parsed.actual_dose_gram != null ? '도징량' : null,
        parsed.yield_gram != null ? '수율' : null,
        parsed.brew_seconds != null ? '시간' : null,
        parsed.dose_level ? '도즈 레벨' : null,
        parsed.pressure_zone ? '압력 구간' : null,
        parsed.shot_result ? '샷 결과' : null,
      ].filter(Boolean).join(', ');
      Alert.alert('사진 분석 완료', applied ? `${applied} 값을 반영했습니다. 저장 전 한 번 확인하세요.` : '사진에서 확실하게 읽을 수 있는 값이 적었습니다. 메모와 주의사항을 확인하세요.');
    } catch (error: any) {
      Alert.alert('사진 분석 실패', error?.message ?? 'AI 사진 분석 중 오류가 발생했습니다.');
    } finally {
      setPhotoAiBusy(false);
    }
  };

  const inventoryImpactMessage = (activeBean: Bean) => {
    const activeUsage = getUsageInfo(activeBean, logs, settingsByBean[activeBean.id]);
    const activeBefore = activeUsage.displayRemaining;
    const activeDose = currentDoseForUsage ?? 0;
    if (editingLog) {
      const previousLotId = editingLog.purchaseLotId ?? editingLog.beanId;
      if (previousLotId !== activeBean.id) {
        const previousLot = beans.find(item => item.id === previousLotId);
        const previousUsage = previousLot ? getUsageInfo(previousLot, logs, settingsByBean[previousLot.id]) : null;
        const previousAfter = previousUsage?.displayRemaining == null ? null : previousUsage.displayRemaining + previousDoseForEdit;
        const activeAfter = activeBefore == null ? null : Math.max(0, activeBefore - activeDose);
        return [
          `기존 구매분 복원: ${previousLot ? `${previousLot.name} · ${lotIndexText(previousLot, beans)}` : '이전 구매분'} ${formatGram(previousUsage?.displayRemaining)} -> ${formatGram(previousAfter)} (+${formatGram(previousDoseForEdit)})`,
          `새 구매분 차감: ${activeBean.name} · ${lotIndexText(activeBean, beans)} ${formatGram(activeBefore)} -> ${formatGram(activeAfter)} (-${formatGram(activeDose)})`,
        ].join('\n');
      }
      const activeAfter = activeBefore == null ? null : Math.max(0, activeBefore - usageDelta);
      return [
        `잔량 업데이트: ${formatGram(activeBefore)} -> ${formatGram(activeAfter)}`,
        `도징 변화: ${formatGram(previousDoseForEdit)} -> ${formatGram(activeDose)} (${usageDelta >= 0 ? '-' : '+'}${formatGram(Math.abs(usageDelta))})`,
      ].join('\n');
    }
    const activeAfter = activeBefore == null ? null : Math.max(0, activeBefore - activeDose);
    return [
      `잔량 업데이트: ${formatGram(activeBefore)} -> ${formatGram(activeAfter)}`,
      `사용량: -${formatGram(activeDose)}`,
    ].join('\n');
  };

  const persistLog = async (activeBean: Bean) => {
    const wasEditing = !!editingLogId;
    const impactMessage = inventoryImpactMessage(activeBean);
    const saved = await saveLog({
      id: editingLogId ?? undefined,
      beanId: activeBean.id,
      purchaseLotId: activeBean.id,
      brewedAt: editingLog?.brewedAt ?? new Date().toISOString(),
      recordingModeUsed: recordingMode,
      drinkType: emptyToNull(form.drinkType),
      doseMode: isBes876 ? form.doseMode : 'manual',
      basketType: form.basketType as any,
      shotButton: form.shotButton as any,
      grindSize: emptyToNull(form.grindSize),
      grindSizeExternal: form.grindSizeExternal,
      innerBurrSetting: form.innerBurrSetting,
      speed: emptyToNull(form.speed),
      grindSeconds: form.grindSeconds,
      actualDoseGram: form.actualDoseGram,
      doseGram: form.doseGram,
      yieldGram: form.yieldGram,
      brewSeconds: form.brewSeconds,
      firstDripSeconds: form.firstDripSeconds,
      timeMeasurementSource: form.timeMeasurementSource,
      waterTemperature: form.waterTemperature,
      temperatureOffset: form.temperatureOffset,
      preinfusion: (form.preinfusionSeconds ?? 0) > 0,
      preinfusionSeconds: (form.preinfusionSeconds ?? 0) > 0 ? form.preinfusionSeconds : null,
      basket: emptyToNull(form.basket),
      doseLevel: (isBes876 ? form.doseLevel : 'unknown') as any,
      pressureZone: form.pressureZone as any,
      usedABitMore: isBes876 ? form.usedABitMore : false,
      usedRazorTrim: isBes876 ? form.usedRazorTrim : false,
      autoDoseResetDone: isBes876 ? form.autoDoseResetDone : false,
      programmedVolumeChanged: form.programmedVolumeChanged,
      nextAction: form.nextAction as any,
      puckPrep: form.puckPrep.length ? form.puckPrep.join(', ') : null,
      tamping: emptyToNull(form.tamping),
      channeling: emptyToNull(form.channeling),
      shotResult: emptyToNull(form.shotResult),
      waterMl: (form.waterMl ?? 0) > 0 ? form.waterMl : null,
      milkMl: (form.milkMl ?? 0) > 0 ? form.milkMl : null,
      servingTemperature: emptyToNull(form.servingTemperature),
      rating: form.rating,
      acidity: form.acidity,
      sweetness: form.sweetness,
      bitterness: form.bitterness,
      body: form.body,
      isFavorite: favorite,
      resultMemo: emptyToNull(form.resultMemo),
      photoUri: primaryPhotoUri ?? null,
    });
    for (const photo of pendingPhotos) {
      await attachBrewLogPhoto(saved.id, photo.uri, photo.type === 'etc' ? 'espresso_result' : photo.type);
    }
    setPendingPhotos([]);
    setEditingLogId(null);
    setPendingOpenLotId(null);
    void loadBrewLogPhotos(saved.id);
    Alert.alert(
      wasEditing ? '기록 수정 완료' : '기록 저장 완료',
      `${activeBean.name} · ${lotIndexText(activeBean, beans)}\n${impactMessage}`,
      [
        { text: '닫기' },
        { text: '수정', onPress: () => startEditLog(saved) },
        { text: '같은 설정으로 다시', onPress: () => duplicateLog(saved) },
      ]
    );
  };

  const save = async (skipRemainingWarning = false) => {
    if (!bean) {
      Alert.alert('원두 필요', '먼저 원두를 등록하세요.');
      return;
    }
    const editingSameLot = editingLog && (editingLog.purchaseLotId ?? editingLog.beanId) === bean.id;
    if ((bean.lotStatus === 'finished' || bean.lotStatus === 'archived') && !editingSameLot) {
      Alert.alert('사용할 수 없는 구매분', '소진되었거나 보관 처리된 구매분입니다. 다른 구매분을 선택하세요.', [
        { text: '확인' },
        { text: '구매분 변경', onPress: () => setLotPickerOpen(true) },
      ]);
      return;
    }
    if (!skipRemainingWarning && usageInfo?.displayRemaining != null && currentDoseForUsage > usageInfo.displayRemaining) {
      Alert.alert(
        '잔량보다 도징량이 큽니다',
        `현재 남은 양은 ${formatGram(usageInfo.displayRemaining)}이고 이번 도징량은 ${formatGram(currentDoseForUsage)}입니다. 저장하면 남은 양이 0g으로 처리될 수 있습니다.`,
        [
          { text: '취소' },
          { text: '잔량 설정', onPress: openBalanceAdjustment },
          { text: '저장하고 0g 처리', onPress: () => void save(true) },
        ]
      );
      return;
    }
    if (bean.lotStatus === 'unopened' || pendingOpenLotId === bean.id) {
      Alert.alert(
        '미개봉 봉투입니다',
        '이 기록을 저장하면서 봉투를 사용중으로 바꾸고 개봉일을 오늘로 저장할까요?',
        [
          { text: '취소' },
          { text: '그냥 저장', onPress: () => void persistLog(bean) },
          {
            text: '개봉 처리 후 저장',
            onPress: () => {
              void (async () => {
                try {
                  const opened = await markLotOpen(bean);
                  await persistLog(opened);
                } catch (error: any) {
                  Alert.alert('개봉 처리 실패', error?.message ?? '구매분 상태를 업데이트하지 못했습니다.');
                }
              })();
            },
          },
        ]
      );
      return;
    }
    await persistLog(bean);
  };

  const filtered = beanLogs.filter(log => {
    const ratingOk = filter === 'all' || (filter === 'favorite' ? log.isFavorite : (log.rating ?? 0) >= 4);
    const drinkOk = drinkFilter === 'all' || log.drinkType === drinkFilter;
    return ratingOk && drinkOk;
  });
  const visibleLogs = filtered.slice(0, visibleLogCount);

  const renderInlineBrewEditor = () => (
    <View style={{ gap: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, backgroundColor: colors.badge, marginTop: 10, padding: 12 }}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{editingLog ? `기록 수정 · ${new Date(editingLog.brewedAt).toLocaleString('ko-KR')}` : '기록 추가'}</Text>
          <Text style={styles.small}>{bean ? `기록 대상: ${bean.name} · ${lotIndexText(bean, beans)} · ${formatGram(usageInfo?.displayRemaining)} 남음` : '구매분을 먼저 선택하세요'}</Text>
        </View>
        <TouchableOpacity style={styles.ghostButton} onPress={() => setLotPickerOpen(true)}>
          <MaterialIcons name="swap-horiz" size={18} color={colors.text} />
          <Text style={styles.ghostText}>구매분</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <CoreNumberInput label="분쇄도" glossaryId="grind_size" recordingMode={recordingMode} value={form.grindSizeExternal} unit="1-25" colors={colors} inputRef={grindInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => doseInputRef.current?.focus?.()} onChange={grindSizeExternal => setForm(prev => ({ ...prev, grindSizeExternal }))} />
        <CoreNumberInput label="도징량" glossaryId="dose" recordingMode={recordingMode} value={form.actualDoseGram} unit="g" colors={colors} inputRef={doseInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => yieldInputRef.current?.focus?.()} onChange={actualDoseGram => setForm(prev => ({ ...prev, actualDoseGram }))} />
        <CoreNumberInput label="수율" glossaryId="yield" recordingMode={recordingMode} value={form.yieldGram} unit="g" colors={colors} inputRef={yieldInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => timeInputRef.current?.focus?.()} onChange={yieldGram => setForm(prev => ({ ...prev, yieldGram }))} />
        <CoreNumberInput label="시간" glossaryId="brew_time" recordingMode={recordingMode} value={form.brewSeconds} unit="초" colors={colors} inputRef={timeInputRef} returnKeyType="done" onChange={brewSeconds => setTimingValue('brewSeconds', brewSeconds)} />
      </View>
      <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 10, gap: 6 }}>
        <Text style={styles.small}>
          {editingLog
            ? `현재 ${formatGram(usageInfo?.displayRemaining)} · 기존 ${formatGram(previousDoseForEdit)} -> 새 ${formatGram(currentDoseForUsage)} · 저장 후 ${formatGram(remainingAfterThisShot)}`
            : `현재 ${formatGram(usageInfo?.displayRemaining)} · 이번 사용 ${formatGram(currentDoseForUsage)} · 저장 후 ${formatGram(remainingAfterThisShot)} · 약 ${estimatedCupsAfterThisShot ?? '-'}잔`}
        </Text>
        {bean && editingLog && (
          <Text style={[styles.small, { color: colors.primary, fontWeight: '800' }]}>저장 영향: {inventoryImpactMessage(bean)}</Text>
        )}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setTimerOpen(true)}>
            <MaterialIcons name="timer" size={18} color={colors.text} />
            <Text style={styles.ghostText}>타이머</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => setPhotoSheetOpen(true)}>
            <MaterialIcons name="add-a-photo" size={18} color={colors.text} />
            <Text style={styles.ghostText}>사진</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={openBalanceAdjustment}>
            <MaterialIcons name="scale" size={18} color={colors.text} />
            <Text style={styles.ghostText}>잔량 설정</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={copyPrevious}>
            <Text style={styles.ghostText}>이전 세팅</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TextInput style={[styles.input, { minHeight: 78, textAlignVertical: 'top' }]} multiline value={form.resultMemo} onChangeText={resultMemo => setForm(prev => ({ ...prev, resultMemo }))} placeholder="메모" placeholderTextColor={colors.textTertiary} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity style={[styles.button, { flexGrow: 1 }]} onPress={() => void save()}>
          <MaterialIcons name="save" size={20} color="#fff" />
          <Text style={styles.buttonText}>{editingLogId ? '변경 저장' : '추출 기록 저장'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostButton} onPress={resetDraft}>
          <Text style={styles.ghostText}>취소</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleWidgetAction = (action: string | null, skipHandledCheck = false) => {
    if (action !== 'newBrew' || (!skipHandledCheck && handledWidgetAction.current === action)) return;
    handledWidgetAction.current = action;
    resetDraft();
    setEditorOpen(true);
    setInlineEditorLogId(null);
    setTimerOpen(false);
    setLotPickerOpen(false);
    setProductPickerOpen(false);
  };

  useEffect(() => {
    const action = typeof params.action === 'string' ? params.action : null;
    handleWidgetAction(action, typeof params.ts === 'string');
  }, [params.action, params.ts]);

  useEffect(() => {
    setVisibleLogCount(10);
  }, [bean?.id, filter, drinkFilter]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', event => {
      if (!event.url.includes('://log') && !event.url.includes('/log')) return;
      const action = /[?&]action=([^&]+)/.exec(event.url)?.[1] ?? null;
      handleWidgetAction(action ? decodeURIComponent(action) : null, true);
    });
    return () => subscription.remove();
  }, []);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>빠른 추출 기록</Text>
      <Text style={styles.subtitle}>이번 기록의 깊이를 고르고, 숨긴 값은 삭제하지 않은 채 화면만 가볍게 봅니다.</Text>
      <View style={[styles.card, { marginTop: 14, padding: 12, gap: 8 }]}>
        <Text style={{ color: colors.text, fontWeight: '900' }}>기록 모드</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {recordingModes.map(([value, label, description]) => (
            <TouchableOpacity key={value} style={[styles.ghostButton, recordingMode === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setRecordingMode(value)}>
              <Text style={styles.ghostText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.small}>{recordingModes.find(([value]) => value === recordingMode)?.[2]}</Text>
      </View>
      <View style={{ marginTop: 14 }}>
        <View style={[styles.card, { gap: 10, padding: 12 }]}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>1. 원두 제품</Text>
          <TouchableOpacity
            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }]}
            onPress={() => setProductPickerOpen(true)}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: bean ? colors.text : colors.textTertiary, fontWeight: '900' }} numberOfLines={1}>{bean?.name ?? '제품 선택'}</Text>
              <Text style={styles.small} numberOfLines={1}>{bean ? `${bean.roastery || '로스터리 미입력'} · 구매분 ${productLots.length}개 · 기록 ${selectedProductLogCount}회` : '원두 탭에서 제품과 구매분을 추가하세요'}</Text>
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={{ color: colors.text, fontWeight: '900' }}>2. 구매분</Text>
          <TouchableOpacity
            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }]}
            onPress={() => setLotPickerOpen(true)}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: bean ? colors.text : colors.textTertiary, fontWeight: '900' }} numberOfLines={1}>
                {bean ? `${lotIndexText(bean, beans)} · ${lotStatusLabel[bean.lotStatus] ?? bean.lotStatus} · 남은 양 ${formatGram(usageInfo?.displayRemaining)}` : '구매분 선택'}
              </Text>
              <Text style={styles.small} numberOfLines={1}>
                {bean ? `구매 ${bean.purchaseDate ?? '-'} · 로스팅 ${bean.roastDate ?? '-'} · 개봉 ${bean.openedDate ?? '-'}` : '날짜, 개봉 여부, 남은 양을 보고 선택합니다'}
              </Text>
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          {bean && (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 6 }}>
              <View style={styles.between}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>재고 미리보기</Text>
                <TouchableOpacity style={[styles.ghostButton, { minHeight: 34 }]} onPress={openBalanceAdjustment}>
                  <MaterialIcons name="scale" size={16} color={colors.text} />
                  <Text style={styles.ghostText}>남은 양 보정</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.small}>
                {editingLog
                  ? `현재 ${formatGram(usageInfo?.displayRemaining)} · 기존 ${formatGram(previousDoseForEdit)} -> 새 ${formatGram(currentDoseForUsage)} · 저장 후 ${formatGram(remainingAfterThisShot)}`
                  : `현재 ${formatGram(usageInfo?.displayRemaining)} · 이번 사용 ${formatGram(currentDoseForUsage)} · 저장 후 ${formatGram(remainingAfterThisShot)} · 약 ${estimatedCupsAfterThisShot ?? '-'}잔`}
              </Text>
              {editingLog && (editingLog.purchaseLotId ?? editingLog.beanId) !== bean.id && <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>수정 중 구매분이 바뀌었습니다. 기존 구매분과 새 구매분의 사용량 영향이 달라집니다.</Text>}
              {usageInfo?.manualOverride && <Text style={styles.small}>현재 잔량은 수동 보정 후 기록 저장/수정에 따라 자동 차감됩니다.</Text>}
            </View>
          )}
          {editingLogId && (
            <View style={{ backgroundColor: colors.badge, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.primary }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>기록 수정 중</Text>
              <Text style={styles.small}>저장하면 기존 기록이 업데이트됩니다. 새 기록으로 남기려면 수정 취소를 누르세요.</Text>
            </View>
          )}
        </View>
        {bean?.lotStatus === 'unopened' && (
          <View style={{ backgroundColor: colors.badge, borderColor: colors.primary, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>미개봉 봉투 선택됨</Text>
            <Text style={styles.small}>저장할 때 개봉 처리 여부를 한 번 확인합니다.</Text>
          </View>
        )}
      </View>
      <View style={[styles.card, { gap: 10, marginTop: 12 }]}>
        <View style={styles.between}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>최근 기록부터 보기</Text>
            <Text style={styles.small}>필요할 때만 입력창을 열고, 수정은 선택한 기록 근처에서 처리합니다.</Text>
          </View>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              resetDraft();
              setEditorOpen(true);
              setInlineEditorLogId(null);
            }}
          >
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.buttonText}>기록 추가</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 14, marginTop: 12 }}>
        <View style={{ display: 'none' }}>
          <Text style={styles.sectionTitle}>오늘 사용할 원두/구매분</Text>
          <Text style={styles.subtitle}>이번 샷에 실제로 쓰는 구매분만 확인하고, 필요할 때 검색해서 바꿉니다.</Text>
          {bean ? (
            <View style={[styles.card, { gap: 9 }]}>
              <View style={styles.between}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }} numberOfLines={2}>{bean.name}</Text>
                  <Text style={styles.small} numberOfLines={1}>{bean.roastery || '로스터리 미입력'} · {lotIndexText(bean, beans)}</Text>
                </View>
                <TouchableOpacity style={styles.button} onPress={() => setLotPickerOpen(true)}>
                  <MaterialIcons name="swap-horiz" size={20} color="#fff" />
                  <Text style={styles.buttonText}>변경</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>상태 {lotStatusLabel[bean.lotStatus] ?? bean.lotStatus}</Text>
                <Text style={styles.small}>구매 {bean.purchaseDate ?? '-'} · 로스팅 {bean.roastDate ?? '-'} · 개봉 {bean.openedDate ?? '-'} · 만료 {bean.expiryDate ?? '-'}</Text>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{lotAge('로스팅', bean.roastDate)} · {lotAge('개봉', bean.openedDate)}</Text>
                <Text style={styles.small}>{expiryText(bean.expiryDate)} · 구매처 {bean.seller ?? '-'}</Text>
                <Text style={styles.small}>시작 {gramText(bean.initialWeightGram)} · 기록 사용 {formatGram(usageInfo?.usedGram)} · 현재 남은 양 {formatGram(usageInfo?.displayRemaining)}</Text>
                <Text style={{ color: colors.text, fontWeight: '800' }}>
                  {editingLog ? `수정 후 예상 ${formatGram(remainingAfterThisShot)} · 사용량 변화 ${usageDelta >= 0 ? '-' : '+'}${formatGram(Math.abs(usageDelta))}` : `이번 도징 ${formatGram(currentDoseForUsage)} 저장 후 예상 ${formatGram(remainingAfterThisShot)} · 약 ${estimatedCupsAfterThisShot ?? '-'}잔`}
                </Text>
                {usageInfo?.manualOverride && <Text style={styles.small}>남은 양은 수동 보정 후 기록 저장/수정에 따라 자동 차감됩니다.</Text>}
              </View>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>선택 가능한 구매분 없음</Text>
              <Text style={styles.subtitle}>원두 탭에서 제품에 구매분을 추가하면 기록에 연결할 수 있습니다.</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1.25 }}>
          <View style={[styles.card, { gap: 12 }, !(editorOpen && !inlineEditorLogId) && { display: 'none' }]}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>핵심 입력</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <CoreNumberInput label="분쇄도" glossaryId="grind_size" recordingMode={recordingMode} value={form.grindSizeExternal} unit="1-25" colors={colors} inputRef={grindInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => doseInputRef.current?.focus?.()} onChange={grindSizeExternal => setForm(prev => ({ ...prev, grindSizeExternal }))} />
              <CoreNumberInput label="도징량" glossaryId="dose" recordingMode={recordingMode} value={form.actualDoseGram} unit="g" colors={colors} inputRef={doseInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => yieldInputRef.current?.focus?.()} onChange={actualDoseGram => setForm(prev => ({ ...prev, actualDoseGram }))} />
              <CoreNumberInput label="수율" glossaryId="yield" recordingMode={recordingMode} value={form.yieldGram} unit="g" colors={colors} inputRef={yieldInputRef} returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => timeInputRef.current?.focus?.()} onChange={yieldGram => setForm(prev => ({ ...prev, yieldGram }))} />
              <CoreNumberInput label="시간" glossaryId="brew_time" recordingMode={recordingMode} value={form.brewSeconds} unit="초" colors={colors} inputRef={timeInputRef} returnKeyType="done" onChange={brewSeconds => setTimingValue('brewSeconds', brewSeconds)} />
            </View>
            <Text style={styles.small}>분쇄도, 도징량, 수율, 시간은 다이얼인 핵심값이라 항상 바로 입력할 수 있습니다.</Text>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 170 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>시간은 숫자로 바로 입력</Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {showGuided
                      ? `첫 방울 ${compactSeconds(form.firstDripSeconds)} · 프리 ${compactSeconds(form.preinfusionSeconds)} · ${timeSourceLabel(form.timeMeasurementSource)}`
                      : '필요하면 타이머로 측정해서 시간 칸에 채울 수 있습니다'}
                  </Text>
                </View>
                <TouchableOpacity accessibilityLabel="타이머로 시간 측정" style={styles.ghostButton} onPress={() => setTimerOpen(true)}>
                  <MaterialIcons name="timer" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>타이머</Text>
                </TouchableOpacity>
                {showGuided && (
                  <TouchableOpacity accessibilityLabel="시간 상세 입력" style={styles.ghostButton} onPress={() => setTimeDetailOpen(true)}>
                    <MaterialIcons name="tune" size={18} color={colors.text} />
                    <Text style={styles.ghostText}>상세</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>사진 {photoCount}장</Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {recordingMode === 'quick' ? '빠른 기록에서도 촬영과 앨범 첨부를 바로 저장합니다.' : '촬영/앨범/보기는 사진 시트에서 처리합니다.'}
                  </Text>
                </View>
                <TouchableOpacity accessibilityLabel="빠른 사진 촬영" style={styles.ghostButton} onPress={() => pickPhoto('espresso_result', 'camera')}>
                  <MaterialIcons name="photo-camera" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>촬영</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="빠른 사진 앨범 선택" style={styles.ghostButton} onPress={() => pickPhoto('espresso_result', 'library')}>
                  <MaterialIcons name="photo-library" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>앨범</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => setPhotoSheetOpen(true)}>
                  <MaterialIcons name="add-a-photo" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>사진 관리</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.button, { opacity: photoAiBusy || pendingPhotos.length === 0 ? 0.55 : 1 }]} disabled={photoAiBusy || pendingPhotos.length === 0} onPress={applyPhotoAnalysis}>
                  <MaterialIcons name="auto-fix-high" size={18} color="#fff" />
                  <Text style={styles.buttonText}>{photoAiBusy ? '분석 중' : '사진 분석'}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {showGuided && isBes876 && (
              <>
                <TermLabel
                  label="BES876 도징 모드"
                  glossaryId="auto_manual_dosing"
                  recordingMode={recordingMode}
                  colors={colors}
                  textStyle={{ color: colors.text, fontSize: 20, fontWeight: '800' }}
                  containerStyle={{ marginTop: 22, marginBottom: 10 }}
                />
                <Text style={styles.subtitle}>AUTO/MANUAL은 추출 방식보다 도징량을 잡는 방식입니다. 수율은 반드시 저울로 따로 기록하세요.</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Chip label="AUTO 도징" active={form.doseMode === 'auto'} colors={colors} onPress={() => setForm(prev => ({ ...prev, doseMode: 'auto' }))} />
                  <Chip label="MANUAL 도징" active={form.doseMode === 'manual'} colors={colors} onPress={() => setForm(prev => ({ ...prev, doseMode: 'manual' }))} />
                </View>
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>{form.doseMode === 'auto' ? 'AUTO에서 더 중요하게 볼 것' : 'MANUAL에서 더 중요하게 볼 것'}</Text>
                  <Text style={styles.small}>
                    {form.doseMode === 'auto'
                      ? '도즈 게이지, A Bit More, Razor 사용 여부를 남기면 BES876 자동 도징 보정 흐름을 추적하기 쉽습니다.'
                      : '실측 도징량, 분쇄 시간, 탬핑 후 퍽, 채널링 흔적을 남기면 직접 도징의 흔들림을 잡기 쉽습니다.'}
                  </Text>
                </View>
              </>
            )}
            {showGuided && !isBes876 && (
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>일반 장비 기록</Text>
                <Text style={styles.small}>선택한 장비가 BES876이 아니어서 AUTO 도징/Impress 게이지 항목은 숨기고, 수동 도징 기준으로 기록합니다.</Text>
              </View>
            )}

            {showGuided && <>
            <Text style={styles.sectionTitle}>기본 세팅</Text>
            <View style={{ marginTop: 16, gap: 12 }}>
              <TextInput style={styles.input} value={form.drinkType} onChangeText={drinkType => setForm(prev => ({ ...prev, drinkType }))} placeholder="음료 유형" placeholderTextColor={colors.textTertiary} />
              {showGuided && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {drinkPresets.map(type => (
                  <Chip key={type} label={type} active={form.drinkType === type} colors={colors} onPress={() => setForm(prev => ({ ...prev, drinkType: type, servingTemperature: type.includes('아이스') ? 'iced' : prev.servingTemperature }))} />
                ))}
              </View>}
              {showPrecision && <TextInput style={styles.input} value={form.grindSize} onChangeText={grindSize => setForm(prev => ({ ...prev, grindSize }))} placeholder="분쇄도 메모 예: Fine" placeholderTextColor={colors.textTertiary} />}
              {showGuided && <TermLabel label="바스켓" glossaryIds={['single_wall', 'dual_wall']} recordingMode={recordingMode} colors={colors} />}
              {showGuided && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {basketOptions.map(([value, label]) => <Chip key={value} label={label} active={form.basketType === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, basketType: value }))} />)}
              </View>}
              {showPrecision && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {shotButtonOptions.map(([value, label]) => <Chip key={value} label={label} active={form.shotButton === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, shotButton: value }))} />)}
              </View>}
              {showPrecision && <TextInput style={styles.input} value={form.speed} onChangeText={speed => setForm(prev => ({ ...prev, speed }))} placeholder="속도 예: 7 또는 Medium" placeholderTextColor={colors.textTertiary} />}
              {showPrecision && <TextInput style={styles.input} value={form.basket} onChangeText={basket => setForm(prev => ({ ...prev, basket }))} placeholder="바스켓/필터 예: 기본 54mm" placeholderTextColor={colors.textTertiary} />}
              {[
                ['내부 버', 'innerBurrSetting', 1, '', 'precision'],
                ['분쇄 시간', 'grindSeconds', 0.5, '초', 'precision'],
                ['앱 기준 도징량', 'doseGram', 0.5, 'g', 'precision'],
                ['물 온도', 'waterTemperature', 1, '도', 'precision'],
                ['온도 오프셋', 'temperatureOffset', 1, '', 'precision'],
              ].filter(([, , , , min]) => includesMode(recordingMode, min as RecordingMode)).map(([label, key, step, unit]) => (
                <View key={key as string} style={styles.between}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{label}</Text>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, -(step as number))}><MaterialIcons name="remove" size={20} color={colors.text} /></TouchableOpacity>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', minWidth: 86, textAlign: 'center' }}>{displayNumber(form[key as NumberKey], unit as string)}</Text>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, step as number)}><MaterialIcons name="add" size={20} color={colors.text} /></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => markUnknown(key as NumberKey)}><Text style={styles.ghostText}>모름</Text></TouchableOpacity>
                </View>
              ))}
            </View>
            </>}

            {showGuided && isBes876 && (
              <>
                <Text style={styles.sectionTitle}>BES876 Assist</Text>
                <TermLabel label="도즈 레벨 게이지" glossaryId="dose_gauge" recordingMode={recordingMode} colors={colors} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {doseLevelOptions.map(([value, label]) => <Chip key={value} label={label} active={form.doseLevel === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, doseLevel: value }))} />)}
                </View>
                <TermLabel label="압력 게이지 피크" glossaryId="pressure_gauge" recordingMode={recordingMode} colors={colors} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {pressureOptions.map(([value, label]) => <Chip key={value} label={label} active={form.pressureZone === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, pressureZone: value }))} />)}
                </View>
                <TermLabel label="도징 보정 여부" glossaryIds={['a_bit_more', 'razor_trim']} recordingMode={recordingMode} colors={colors} />
                <View style={{ gap: 8 }}>
                  {[
                    ['A Bit More 사용', 'usedABitMore', 'guided', 'auto'],
                    ['Razor 트리밍', 'usedRazorTrim', 'guided', 'auto'],
                    ['AUTO 도징 리셋', 'autoDoseResetDone', 'precision', 'auto'],
                    ['1/2 CUP 프로그래밍 변경', 'programmedVolumeChanged', 'precision'],
                  ].filter(([, , min, mode]) => includesMode(recordingMode, min as RecordingMode) && (!mode || mode === form.doseMode)).map(([label, key]) => (
                    <View key={key} style={styles.between}>
                      <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{label}</Text>
                      <Switch value={(form as any)[key]} onValueChange={value => setForm(prev => ({ ...prev, [key]: value }))} />
                    </View>
                  ))}
                </View>
                {form.doseMode === 'manual' && (
                  <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, marginTop: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>MANUAL 도징 체크</Text>
                    <Text style={styles.small}>수동 도징은 A Bit More보다 실측 도징량, 분쇄 시간, 탬핑 후 퍽 표면, 채널링 여부가 더 중요합니다.</Text>
                  </View>
                )}
              </>
            )}

            {showPrecision && (
              <>
                <View style={styles.between}>
                  <Text style={styles.sectionTitle}>Advanced Machine Setup</Text>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => toggleSection('advancedPrep', !sectionOpen('advancedPrep', recordingMode === 'precision'))}>
                    <Text style={styles.ghostText}>{sectionOpen('advancedPrep', recordingMode === 'precision') ? '접기' : '열기'}</Text>
                  </TouchableOpacity>
                </View>
                {sectionOpen('advancedPrep', recordingMode === 'precision') && (
                  <View style={{ gap: 12 }}>
                    <TermLabel label="퍽 준비" glossaryIds={['wdt', 'leveling', 'tamping', 'puck_screen', 'bottomless_check']} recordingMode={recordingMode} colors={colors} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {puckPrepOptions.map(tag => <Chip key={tag} label={tag} active={form.puckPrep.includes(tag)} colors={colors} onPress={() => togglePuckPrep(tag)} />)}
                    </View>
                    <TermLabel label="채널링" glossaryId="channeling" recordingMode={recordingMode} colors={colors} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {channelingOptions.map(([value, label]) => <Chip key={value} label={label} active={form.channeling === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, channeling: value }))} />)}
                    </View>
                    <TermLabel label="탬핑" glossaryId="tamping" recordingMode={recordingMode} colors={colors} />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {tampingOptions.map(value => <Chip key={value} label={value} active={form.tamping === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, tamping: value }))} />)}
                    </View>
                  </View>
                )}
              </>
            )}

            {showPrecision && <><Text style={styles.sectionTitle}>음료 레시피</Text>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="핫" active={form.servingTemperature === 'hot'} colors={colors} onPress={() => setForm(prev => ({ ...prev, servingTemperature: 'hot' }))} />
                <Chip label="아이스" active={form.servingTemperature === 'iced'} colors={colors} onPress={() => setForm(prev => ({ ...prev, servingTemperature: 'iced' }))} />
              </View>
              {[
                ['물', 'waterMl', 10, 'ml'],
                ['우유', 'milkMl', 10, 'ml'],
              ].map(([label, key, step, unit]) => (
                <View key={key as string} style={styles.between}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', flex: 1 }}>{label}</Text>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, -(step as number))}><MaterialIcons name="remove" size={20} color={colors.text} /></TouchableOpacity>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', minWidth: 86, textAlign: 'center' }}>{displayNumber(form[key as NumberKey], unit as string)}</Text>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, step as number)}><MaterialIcons name="add" size={20} color={colors.text} /></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => markUnknown(key as NumberKey)}><Text style={styles.ghostText}>모름</Text></TouchableOpacity>
                </View>
              ))}
            </View></>}

            <Text style={styles.sectionTitle}>맛 평가</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {shotResults.map(value => <Chip key={value} label={value} active={form.shotResult === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, shotResult: value, channeling: value === '채널링 의심' ? 'suspected' : prev.channeling }))} />)}
            </View>
            {showGuided && <>
              <Text style={styles.label}>다음 샷 액션</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {nextActionOptions.map(([value, label]) => <Chip key={value} label={label} active={form.nextAction === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, nextAction: value }))} />)}
              </View>
            </>}
            {[
              ['전체', 'rating', 'quick'],
              ['산미', 'acidity', 'guided'],
              ['단맛', 'sweetness', 'guided'],
              ['쓴맛', 'bitterness', 'guided'],
              ['바디', 'body', 'guided'],
            ].filter(([, , min]) => includesMode(recordingMode, min as RecordingMode)).map(([label, key]) => (
              <View key={key} style={[styles.between, { marginBottom: 8 }]}>
                <Text style={{ color: colors.text, fontWeight: '800', width: 56 }}>{label}</Text>
                <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, -0.5, 0, 5)}><MaterialIcons name="remove" size={18} color={colors.text} /></TouchableOpacity>
                <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 20, minWidth: 44, textAlign: 'center' }}>{form[key as NumberKey] ?? '모름'}</Text>
                <TouchableOpacity style={styles.ghostButton} onPress={() => adjust(key as NumberKey, 0.5, 0, 5)}><MaterialIcons name="add" size={18} color={colors.text} /></TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => markUnknown(key as NumberKey)}><Text style={styles.ghostText}>모름</Text></TouchableOpacity>
              </View>
            ))}

            <TextInput style={[styles.input, { minHeight: 90, textAlignVertical: 'top', marginTop: 10 }]} multiline value={form.resultMemo} onChangeText={resultMemo => setForm(prev => ({ ...prev, resultMemo }))} placeholder="메모" placeholderTextColor={colors.textTertiary} />
            {photoUri && (
              <TouchableOpacity onPress={() => setPreviewUri(photoUri)} style={{ alignSelf: 'flex-start' }}>
                <Image source={{ uri: photoUri }} style={{ width: 130, height: 100, borderRadius: 8, marginTop: 10 }} />
                <Text style={styles.small}>기타 사진 · 눌러서 크게 보기</Text>
              </TouchableOpacity>
            )}
            {showGuided && <View style={[styles.between, { marginTop: 12 }]}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>즐겨찾기 세팅</Text>
              <Switch value={favorite} onValueChange={setFavorite} />
            </View>}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[styles.button, { flexGrow: 1 }]} onPress={() => void save()}>
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.buttonText}>{editingLogId ? '수정 저장' : '추출 기록 저장'}</Text>
              </TouchableOpacity>
              {editingLogId ? <TouchableOpacity style={styles.ghostButton} onPress={resetDraft}><Text style={styles.ghostText}>수정 취소</Text></TouchableOpacity> : editorOpen && <TouchableOpacity style={styles.ghostButton} onPress={resetDraft}><Text style={styles.ghostText}>입력 닫기</Text></TouchableOpacity>}
              {showGuided && <TouchableOpacity style={styles.ghostButton} onPress={copyPrevious}><Text style={styles.ghostText}>이전 세팅 불러오기</Text></TouchableOpacity>}
              {showGuided && <TouchableOpacity accessibilityLabel="기타 사진 촬영" style={[styles.ghostButton, { width: 44, paddingHorizontal: 0 }]} onPress={() => pickPhoto(undefined, 'camera')}><MaterialIcons name="photo-camera" size={18} color={colors.text} /></TouchableOpacity>}
              {showGuided && <TouchableOpacity accessibilityLabel="기타 사진 선택" style={[styles.ghostButton, { width: 44, paddingHorizontal: 0 }]} onPress={() => pickPhoto(undefined, 'library')}><MaterialIcons name="photo-library" size={18} color={colors.text} /></TouchableOpacity>}
              {photoUri && <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger }]} onPress={() => setPhotoUri(null)}><Text style={[styles.ghostText, { color: colors.danger }]}>사진 삭제</Text></TouchableOpacity>}
            </View>
          </View>

          {showGuided && <TouchableOpacity style={[styles.ghostButton, { marginTop: 16 }]} onPress={() => toggleSection('advice', !sectionOpen('advice', false))}>
            <MaterialIcons name="tips-and-updates" size={18} color={colors.text} />
            <Text style={styles.ghostText}>추천 받기 {sectionOpen('advice', false) ? '접기' : '보기'}</Text>
          </TouchableOpacity>}
          {showGuided && sectionOpen('advice', false) && (
            <View style={{ marginTop: 10, gap: 10 }}>
              <RecommendationCard recommendation={recommendation} colors={colors} />
              <View style={[styles.card, { gap: 10 }]}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>AI에게 물어볼 질문</Text>
                <TextInput
                  style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
                  multiline
                  value={aiAdviceQuestion}
                  onChangeText={setAiAdviceQuestion}
                  placeholder="예: 다음 샷에서 분쇄도를 바꿀지 수율을 바꿀지 판단해줘."
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.small}>히스토리의 기록을 선택하면 원두 상태와 최근 기록을 묶어 프롬프트를 만듭니다.</Text>
              </View>
            </View>
          )}

          <>
          {beanLogs.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                {[
                  ['all', '전체'],
                  ['favorite', '즐겨찾기'],
                  ['high', '4점 이상'],
                ].map(([key, label]) => (
                  <TouchableOpacity key={key} style={[styles.ghostButton, filter === key && { backgroundColor: colors.badge, borderColor: colors.primary }]} onPress={() => setFilter(key as any)}>
                    <Text style={styles.ghostText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity style={[styles.ghostButton, drinkFilter === 'all' && { backgroundColor: colors.badge, borderColor: colors.primary }]} onPress={() => setDrinkFilter('all')}>
                  <Text style={styles.ghostText}>전체 종류</Text>
                </TouchableOpacity>
                {drinkTypes.map(type => (
                  <TouchableOpacity key={type} style={[styles.ghostButton, drinkFilter === type && { backgroundColor: colors.badge, borderColor: colors.primary }]} onPress={() => setDrinkFilter(type)}>
                    <Text style={styles.ghostText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <View style={[styles.between, { marginTop: 18 }]}>
            <Text style={styles.sectionTitle}>최근 히스토리</Text>
            {visibleLogCount < filtered.length && (
              <TouchableOpacity style={styles.ghostButton} onPress={() => setVisibleLogCount(prev => prev + 10)}>
                <Text style={styles.ghostText}>더 보기 {filtered.length - visibleLogCount}</Text>
              </TouchableOpacity>
            )}
          </View>
          {visibleLogs.map((log: BrewLog) => {
            const expanded = !!expandedLogIds[log.id];
            const lotForLog = beans.find(item => item.id === (log.purchaseLotId ?? log.beanId));
            const savedPhotos = photosByLog[log.id] ?? [];
            const displayPhotoUris = [
              ...savedPhotos.map(photo => ({ id: photo.id, uri: photo.photoUri, type: photo.photoType, saved: true })),
              ...(log.photoUri && !savedPhotos.some(photo => photo.photoUri === log.photoUri) ? [{ id: `${log.id}-primary`, uri: log.photoUri, type: 'espresso_result' as BrewPhotoType, saved: false }] : []),
            ];
            return (
            <View key={log.id} style={[styles.card, { gap: 8, marginBottom: 10 }]}>
              <LogSummary log={log} colors={colors} compact />
              {editorOpen && inlineEditorLogId === log.id && renderInlineBrewEditor()}
              {expanded && (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>상세</Text>
                  <Text style={styles.small}>구매분: {lotForLog ? `${lotIndexText(lotForLog, beans)} · ${lotStatusLabel[lotForLog.lotStatus] ?? lotForLog.lotStatus} · 남은 양 ${formatGram(getUsageInfo(lotForLog, logs, settingsByBean[lotForLog.id])?.displayRemaining)}` : '연결된 구매분 없음'}</Text>
                  <Text style={styles.small}>고급값: 첫 방울 {compactSeconds(log.firstDripSeconds)} · 프리 {compactSeconds(log.preinfusionSeconds)} · 압력 {log.pressureZone ?? '-'} · 도즈 {log.doseLevel ?? '-'}</Text>
                  <Text style={styles.small}>재고 변화: 사용 {formatGram(log.actualDoseGram ?? log.doseGram)} · 기록 당시 구매분 기준</Text>
                  {displayPhotoUris.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        {displayPhotoUris.map(photo => (
                          <View key={photo.id} style={{ width: 82 }}>
                            <TouchableOpacity onPress={() => setPreviewUri(photo.uri)}>
                              <Image source={{ uri: photo.uri }} style={{ width: 82, height: 82, borderRadius: 8, backgroundColor: colors.surface }} />
                            </TouchableOpacity>
                            <Text style={styles.small} numberOfLines={1}>{brewPhotoLabel(photo.type as any)}</Text>
                            {photo.saved && (
                              <TouchableOpacity onPress={() => confirmDeleteSavedPhoto(log.id, photo.id)}>
                                <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>삭제</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                  {!!log.resultMemo && <Text style={{ color: colors.text }}>{log.resultMemo}</Text>}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity style={styles.ghostButton} onPress={() => setAiSheetLog(log)}>
                      <MaterialIcons name="auto-awesome" size={18} color={colors.text} />
                      <Text style={styles.ghostText}>AI 질문</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger }]} onPress={() => confirmDeleteLog(log)}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
                      <Text style={[styles.ghostText, { color: colors.danger }]}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={styles.ghostButton} onPress={() => toggleLogExpanded(log)}>
                  <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color={colors.text} />
                  <Text style={styles.ghostText}>{expanded ? '간소화' : '상세'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => startEditLog(log)}>
                  <MaterialIcons name="edit" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>수정</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => duplicateLog(log)}>
                  <MaterialIcons name="content-copy" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>복제</Text>
                </TouchableOpacity>
              </View>
            </View>
          );})}
          {visibleLogCount < filtered.length && (
            <TouchableOpacity style={[styles.ghostButton, { marginBottom: 10 }]} onPress={() => setVisibleLogCount(prev => prev + 10)}>
              <Text style={styles.ghostText}>10개 더 보기</Text>
            </TouchableOpacity>
          )}
          {filtered.length === 0 && (
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 8, marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{beanLogs.length === 0 ? '이 구매분 기록이 아직 없습니다' : '현재 필터에 해당하는 기록이 없습니다'}</Text>
              <Text style={styles.small}>{beanLogs.length === 0 ? '분쇄도, 도징량, 수율, 시간을 먼저 남기면 다음 추출 비교가 쉬워집니다.' : '필터를 전체로 바꾸면 숨겨진 기록을 다시 볼 수 있습니다.'}</Text>
              {beanLogs.length === 0 && (
                <TouchableOpacity style={[styles.button, { alignSelf: 'flex-start' }]} onPress={() => { resetDraft(); setEditorOpen(true); setInlineEditorLogId(null); }}>
                  <MaterialIcons name="add" size={18} color="#fff" />
                  <Text style={styles.buttonText}>기록 추가</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <Text style={styles.small}>모르는 값은 모름으로 남기면 저장 시 빈 값으로 보존됩니다. 타이머 탭에서 잰 값은 {form.brewSeconds == null ? '모름' : formatSeconds(form.brewSeconds)} 형식으로 이 화면에 직접 입력할 수 있습니다.</Text>
          </>
        </View>
      </View>
      <BottomSheetModal
        visible={lotDetailOpen}
        title="선택한 봉투 상세"
        subtitle="저장하면 이 봉투에 추출 기록과 사용량이 연결됩니다."
        colors={colors}
        onClose={() => setLotDetailOpen(false)}
      >
        {bean ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 18 }}>{bean.name}</Text>
            <Text style={styles.subtitle}>{bean.roastery || '로스터리 미입력'} · {lotIndexText(bean, beans)}</Text>
            <Text style={{ color: colors.primary, fontWeight: '800' }}>{lotAge('로스팅', bean.roastDate)} · {lotAge('개봉', bean.openedDate)} · {expiryText(bean.expiryDate)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['상태', lotStatusLabel[bean.lotStatus] ?? bean.lotStatus],
                ['구매일', bean.purchaseDate ?? '-'],
                ['로스팅일', bean.roastDate ?? '-'],
                ['개봉일', bean.openedDate ?? '-'],
                ['유통기한', bean.expiryDate ?? '-'],
                ['구매처', bean.seller ?? '-'],
                ['시작 중량', gramText(bean.initialWeightGram)],
                ['기록 사용', formatGram(usageInfo?.usedGram)],
                ['현재 남은 양', formatGram(usageInfo?.displayRemaining)],
                ['예상 잔 수', usageInfo?.estimatedCups == null ? '-' : `${usageInfo.estimatedCups}잔`],
                ['이번 저장 후', remainingAfterThisShot == null ? '-' : `${formatGram(remainingAfterThisShot)} / ${estimatedCupsAfterThisShot ?? '-'}잔`],
              ].map(([label, value]) => (
                <MetricChip key={label} label={label} value={value} colors={colors} />
              ))}
            </View>
            <Text style={styles.small}>현재 남은 양을 보정하면 이후 이 구매분 기록의 도징량이 자동으로 차감됩니다.</Text>
            {editingLog && (editingLog.purchaseLotId ?? editingLog.beanId) !== bean.id && <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>수정 중 구매분이 변경되었습니다. 저장하면 새 구매분에 기록이 연결됩니다.</Text>}
            <TouchableOpacity style={[styles.button, { alignSelf: 'flex-start' }]} onPress={openBalanceAdjustment}>
              <MaterialIcons name="scale" size={18} color="#fff" />
              <Text style={styles.buttonText}>남은 양 보정</Text>
            </TouchableOpacity>
            {showDebugInfo && (
              <TouchableOpacity
                style={[styles.ghostButton, { alignSelf: 'flex-start' }]}
                onPress={() => copySupportInfo({ productId: bean.productId, purchaseLotId: bean.id, coffeeName: bean.name, roastery: bean.roastery })}
              >
                <MaterialIcons name="bug-report" size={18} color={colors.text} />
                <Text style={styles.ghostText}>지원 정보 복사</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles.subtitle}>선택된 봉투가 없습니다.</Text>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        visible={balanceSheetOpen}
        title="현재 남은 양 설정"
        subtitle="현재 봉투에 남은 양을 맞춥니다. 이후 이 구매분 기록은 이 값에서 자동 차감됩니다."
        colors={colors}
        onClose={() => setBalanceSheetOpen(false)}
      >
        {bean ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{bean.name} · {lotIndexText(bean, beans)}</Text>
              <Text style={styles.small}>계산 잔량 {formatGram(usageInfo?.calculatedRemaining)} · 현재 표시 {formatGram(usageInfo?.displayRemaining)}</Text>
            </View>
            <Text style={styles.label}>현재 남은 양 g</Text>
            <TextInput
              style={styles.input}
              value={balanceDraft}
              onChangeText={setBalanceDraft}
              keyboardType="decimal-pad"
              placeholder="예: 183"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.small}>값을 저장하면 이 시점의 현재 잔량으로 맞추고, 이후 기록부터 자동 차감합니다. 빈 값은 보정을 해제합니다.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity style={styles.button} onPress={saveBalanceAdjustment}>
                <MaterialIcons name="check" size={18} color="#fff" />
                <Text style={styles.buttonText}>보정 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setBalanceDraft('')}>
                <Text style={styles.ghostText}>보정 해제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.subtitle}>선택된 구매분이 없습니다.</Text>
        )}
      </BottomSheetModal>

      <BottomSheetModal
        visible={aiSheetLog != null}
        title="AI에게 기록 물어보기"
        subtitle="선택한 기록, 원두 상태, 최근 기록을 묶어 프롬프트로 만듭니다."
        colors={colors}
        onClose={() => setAiSheetLog(null)}
      >
        {aiSheetLog && (
          <View style={{ gap: 12 }}>
            <LogSummary log={aiSheetLog} colors={colors} />
            <Text style={styles.label}>질문</Text>
            <TextInput
              style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]}
              multiline
              value={aiAdviceQuestion}
              onChangeText={setAiAdviceQuestion}
              placeholder="예: 다음 샷에서 무엇을 먼저 바꾸면 좋을까?"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity style={styles.button} onPress={() => copyLogForAi(aiSheetLog)}>
                <MaterialIcons name="content-copy" size={18} color="#fff" />
                <Text style={styles.buttonText}>프롬프트 복사</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => copyLogForAi(aiSheetLog, 'chatgpt')}>
                <MaterialIcons name="chat" size={18} color={colors.text} />
                <Text style={styles.ghostText}>ChatGPT로 열기</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => copyLogForAi(aiSheetLog, 'gemini')}>
                <MaterialIcons name="diamond" size={18} color={colors.text} />
                <Text style={styles.ghostText}>Gemini로 열기</Text>
              </TouchableOpacity>
              {showDebugInfo && (
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={() => copySupportInfo({ brewLogId: aiSheetLog.id, productId: bean?.productId ?? null, purchaseLotId: aiSheetLog.purchaseLotId ?? aiSheetLog.beanId, brewedAt: aiSheetLog.brewedAt, coffeeName: bean?.name ?? aiSheetLog.beanName })}
                >
                  <MaterialIcons name="bug-report" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>지원 정보 복사</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </BottomSheetModal>

      <CoffeeLotSelectorSheet
        visible={productPickerOpen}
        colors={colors}
        beans={beans}
        logs={logs}
        selectedLotId={bean?.id}
        selectedProductKey={effectiveProductKey}
        mode="product"
        title="원두 제품 선택"
        subtitle="제품을 먼저 고르면 다음 단계에서 그 제품의 구매분만 고릅니다."
        onClose={() => setProductPickerOpen(false)}
        onSelect={() => undefined}
        onSelectProduct={selectProductForLog}
      />
      <CoffeeLotSelectorSheet
        visible={lotPickerOpen}
        colors={colors}
        beans={productLots.length ? productLots : beans}
        logs={logs}
        selectedLotId={bean?.id}
        selectedProductKey={effectiveProductKey}
        mode="lot"
        title="구매분 선택"
        subtitle="제품을 검색한 뒤 이번 기록에 연결할 봉투를 선택하세요."
        onClose={() => setLotPickerOpen(false)}
        onSelect={selected => selectLotForLog(selected.id)}
      />
      <BottomSheetModal
        visible={timeDetailOpen}
        title="시간 상세"
        subtitle="총 추출 시간은 핵심 입력에서 바로 수정하고, 첫 방울과 프리인퓨전은 모르면 비워두세요."
        colors={colors}
        onClose={() => setTimeDetailOpen(false)}
      >
        <View style={{ gap: 14 }}>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }}>총 추출 시간 {compactSeconds(form.brewSeconds)}</Text>
            <Text style={styles.small}>저장되는 기준 시간입니다. 이 값은 위 핵심 입력의 시간 칸과 같습니다.</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <CoreNumberInput label="첫 방울" glossaryId="first_drip" recordingMode={recordingMode} value={form.firstDripSeconds} unit="초" colors={colors} onChange={firstDripSeconds => setTimingValue('firstDripSeconds', firstDripSeconds)} />
            <CoreNumberInput label="프리인퓨전" glossaryId="preinfusion" recordingMode={recordingMode} value={form.preinfusionSeconds} unit="초" colors={colors} onChange={preinfusionSeconds => setTimingValue('preinfusionSeconds', preinfusionSeconds)} />
          </View>
          <Text style={styles.small}>첫 방울은 커피가 처음 떨어지기 시작한 시간입니다. 프리인퓨전은 본격 추출 전 적시는 구간이라, 모르면 비워둬도 됩니다.</Text>
          <Text style={styles.label}>시간 출처</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {timeSourceOptions.map(([value, label]) => (
              <Chip key={value} label={label} active={form.timeMeasurementSource === value} colors={colors} onPress={() => setForm(prev => ({ ...prev, timeMeasurementSource: value }))} />
            ))}
          </View>
          <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start' }]} onPress={() => setTimerOpen(true)}>
            <MaterialIcons name="timer" size={18} color={colors.text} />
            <Text style={styles.ghostText}>타이머로 측정</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        visible={photoSheetOpen}
        title={editingLog ? `기록 사진 · ${new Date(editingLog.brewedAt).toLocaleString('ko-KR')}` : '현재 기록 사진'}
        subtitle={recordingMode === 'quick' ? '이 기록 초안에 붙일 도즈/퍽, 압력, 결과 컵 사진입니다.' : '사진은 현재 열려 있는 기록 초안 또는 수정 중인 기록에 저장됩니다.'}
        colors={colors}
        onClose={() => setPhotoSheetOpen(false)}
      >
        <View style={{ gap: 12 }}>
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 8 }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>사진 {photoCount}장</Text>
                <Text style={styles.small}>
                  {recordingMode === 'quick'
                    ? '촬영은 1장씩, 앨범은 여러 장을 한 번에 추가할 수 있습니다.'
                    : isBes876 && form.doseMode === 'auto'
                    ? 'AUTO는 도즈 게이지, 압력 게이지, 분쇄도 다이얼 사진을 우선 봅니다.'
                    : 'MANUAL은 퍽 표면, 압력 게이지, 추출 컵 사진이 유용합니다.'}
                </Text>
              </View>
              <TouchableOpacity style={[styles.button, { opacity: photoAiBusy || pendingPhotos.length === 0 ? 0.55 : 1 }]} disabled={photoAiBusy || pendingPhotos.length === 0} onPress={applyPhotoAnalysis}>
                <MaterialIcons name="auto-fix-high" size={18} color="#fff" />
                <Text style={styles.buttonText}>{photoAiBusy ? '분석 중' : 'AI로 읽기'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <BrewPhotoSlotStrip
            slots={brewPhotoSlots}
            photos={pendingPhotos}
            colors={colors}
            onCamera={type => pickPhoto(type, 'camera')}
            onLibrary={type => pickPhoto(type, 'library')}
            onOpen={setPreviewUri}
            onRemove={removePendingPhoto}
          />
          {pendingPhotos.some(photo => !brewPhotoSlots.some(slot => slot.types.includes(photo.type))) && (
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>기타 사진</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {pendingPhotos.filter(photo => !brewPhotoSlots.some(slot => slot.types.includes(photo.type))).map(photo => (
                    <View key={photo.uri} style={{ width: 86 }}>
                      <TouchableOpacity onPress={() => setPreviewUri(photo.uri)}>
                        <Image source={{ uri: photo.uri }} style={{ width: 86, height: 86, borderRadius: 8, backgroundColor: colors.surfaceAlt }} />
                      </TouchableOpacity>
                      <Text style={styles.small} numberOfLines={1}>{brewPhotoLabel(photo.type)}</Text>
                      <TouchableOpacity onPress={() => removePendingPhoto(photo.uri)}>
                        <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </BottomSheetModal>
      <Modal visible={timerOpen} transparent animationType="slide" onRequestClose={() => setTimerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>앱 타이머</Text>
                <Text style={styles.subtitle}>적용하면 form 값만 채우고, 저장은 이 Log 화면에서 합니다.</Text>
              </View>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setTimerOpen(false)}>
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.text, fontSize: 64, fontWeight: '900', textAlign: 'center', marginVertical: 18 }}>{formatSeconds(timerElapsed)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              <TouchableOpacity style={styles.button} onPress={startLogTimer}><MaterialIcons name="play-arrow" size={22} color="#fff" /><Text style={styles.buttonText}>시작</Text></TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={stopLogTimer}><MaterialIcons name="pause" size={20} color={colors.text} /><Text style={styles.ghostText}>정지</Text></TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setTimerFirstDrip(timerElapsed)}><Text style={styles.ghostText}>첫 방울</Text></TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setTimerPreinfusion(timerElapsed)}><Text style={styles.ghostText}>프리 종료</Text></TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={resetLogTimer}><Text style={styles.ghostText}>리셋</Text></TouchableOpacity>
            </View>
            <Text style={[styles.small, { textAlign: 'center', marginTop: 12 }]}>첫 방울 {timerFirstDrip == null ? '-' : formatSeconds(timerFirstDrip)} · 프리 종료 {timerPreinfusion == null ? '-' : formatSeconds(timerPreinfusion)}</Text>
            <TouchableOpacity style={[styles.button, { marginTop: 16 }]} onPress={applyLogTimer}>
              <MaterialIcons name="check" size={20} color="#fff" />
              <Text style={styles.buttonText}>Log에 적용</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', justifyContent: 'center', padding: 18 }}>
          <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-end', marginBottom: 12, borderColor: '#fff' }]} onPress={() => setPreviewUri(null)}>
            <MaterialIcons name="close" size={20} color="#fff" />
            <Text style={[styles.ghostText, { color: '#fff' }]}>닫기</Text>
          </TouchableOpacity>
          {previewUri && <Image source={{ uri: previewUri }} style={{ width: '100%', height: '78%', borderRadius: 12, resizeMode: 'contain' }} />}
        </View>
      </Modal>
    </ScrollView>
  );
}
