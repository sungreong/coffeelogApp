import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BottomSheetModal, Field, FreshnessBadge, LogSummary, LotStatusActionBar, MetricChip, QuickPurchaseLotWidget, RecommendationCard, createCommonStyles } from '../../src/components';
import { ThemeColors, darkColors, lightColors } from '../../src/constants/theme';
import { BeanAnalysisPhotoInput, analyzeBeanPhotos } from '../../src/services/ai';
import { copyAiText, copyPurchaseLotAiText } from '../../src/services/aiCopy';
import { getFreshnessInfo, getFreshnessPriority, getLotDisplayRemainingGram } from '../../src/services/beanInventory';
import { persistPhoto, deletePhotoFile } from '../../src/services/photos';
import { getDialInRecommendation } from '../../src/services/recommendation';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { AiAnalysisParsed, BeanLotStatus, CoffeeProduct, CoffeeProductUserStatus, CoffeePurchaseLot } from '../../src/types/models';
import { daysBetween, emptyToNull, isValidDateString, normalizeDateInput, parseOptionalNumber, todayDate } from '../../src/utils';

type ProductFilter = 'all' | 'owned' | 'consumed' | 'wishlist' | 'archived';
type ProductSort = 'freshness_priority' | 'recent_purchase' | 'recent_brew' | 'repeat_count' | 'best_rating' | 'name';
type LotSort = 'recent_purchase' | 'freshness_priority';
type EditorMode = 'none' | 'product' | 'lot';
type QuickLotDateKey = 'purchaseDate' | 'roastDate';

const emptyProductForm = {
  name: '',
  roastery: '',
  origin: '',
  variety: '',
  process: '',
  roastLevel: '',
  tastingNotes: '',
  userStatus: 'normal' as CoffeeProductUserStatus,
  memo: '',
};

const emptyLotForm = {
  id: '',
  purchaseDate: '',
  roastDate: '',
  openedDate: '',
  expiryDate: '',
  storageType: '',
  initialWeightGram: '',
  remainingWeightGram: '',
  lotStatus: 'unopened' as BeanLotStatus,
  seller: '',
  price: '',
  lotMemo: '',
};

const filterOptions: Array<{ value: ProductFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'owned', label: '보유중' },
  { value: 'consumed', label: '먹었던 원두' },
  { value: 'wishlist', label: '먹고 싶은 원두' },
  { value: 'archived', label: '보관/숨김' },
];

const sortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: 'freshness_priority', label: '소비 우선' },
  { value: 'recent_purchase', label: '최근 구매' },
  { value: 'recent_brew', label: '최근 추출' },
  { value: 'repeat_count', label: '재구매 많은 순' },
  { value: 'best_rating', label: '평점 높은 순' },
  { value: 'name', label: '이름순' },
];

const lotSortOptions: Array<{ value: LotSort; label: string }> = [
  { value: 'recent_purchase', label: '구매순' },
  { value: 'freshness_priority', label: '신선도순' },
];

const photoOptions = [
  { type: 'bean_label', title: '패키지 전면', subtitle: '제품명, 로스터리, 대표 라벨' },
  { type: 'back_label', title: '상세/뒷면', subtitle: '산지, 품종, 가공, 노트' },
  { type: 'roast_date_label', title: '날짜/중량 라벨', subtitle: '로스팅일, 유통기한, 중량' },
] as const;

const externalAiTargets = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
};

const photoLabel = (type: string) => photoOptions.find(option => option.type === type)?.title ?? '사진';

const lotStatusLabel: Record<BeanLotStatus, string> = {
  unopened: '미개봉',
  open: '사용중',
  finished: '소진',
  archived: '보관',
};

const productStatusLabel = (status: ProductFilter) => ({
  all: '전체',
  owned: '보유중',
  consumed: '먹었던 원두',
  wishlist: '먹고 싶은 원두',
  archived: '보관/숨김',
}[status]);

const normalize = (value: string | null | undefined) => (value ?? '').trim();

const dateFieldLabels = {
  purchaseDate: '구매일',
  roastDate: '로스팅일',
  openedDate: '개봉일',
  expiryDate: '유통기한',
} as const;
type LotDateKey = keyof typeof dateFieldLabels;
const quickDateFieldLabels: Record<QuickLotDateKey, string> = {
  purchaseDate: '구매일',
  roastDate: '로스팅일',
};

const normalizeLotDates = (lotForm: typeof emptyLotForm) => {
  const fields = {
    purchaseDate: normalizeDateInput(lotForm.purchaseDate),
    roastDate: normalizeDateInput(lotForm.roastDate),
    openedDate: normalizeDateInput(lotForm.openedDate),
    expiryDate: normalizeDateInput(lotForm.expiryDate),
  };
  const invalid = (Object.keys(fields) as Array<keyof typeof fields>).find(key => fields[key].error);
  if (invalid) {
    return {
      ok: false as const,
      message: `${dateFieldLabels[invalid]} 날짜를 확인해주세요. ${fields[invalid].error}`,
      values: null,
    };
  }
  return {
    ok: true as const,
    message: null,
    values: {
      purchaseDate: fields.purchaseDate.value,
      roastDate: fields.roastDate.value,
      openedDate: fields.openedDate.value,
      expiryDate: fields.expiryDate.value,
    },
  };
};

const normalizedDateOrOriginal = (value: string | null | undefined) => {
  const normalized = normalizeDateInput(value);
  return normalized.error ? value ?? null : normalized.value;
};

const datePreviewText = (value: string) => {
  if (!value.trim()) return null;
  const normalized = normalizeDateInput(value);
  return normalized.value && normalized.changed ? `저장 시 ${normalized.value}로 정리됩니다.` : null;
};

const dateErrorText = (value: string) => {
  if (!value.trim()) return null;
  return normalizeDateInput(value).error;
};

const toDateParts = (value: string) => value.split('-').map(Number) as [number, number, number];
const dateFromParts = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const addDays = (value: string, days: number) => {
  const [year, month, day] = toDateParts(value);
  const date = new Date(year, month - 1, day + days);
  return dateFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
};
const addMonths = (monthValue: string, diff: number) => {
  const [year, month] = monthValue.split('-').map(Number);
  const date = new Date(year, month - 1 + diff, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const formatDateKorean = (value: string | null | undefined) => {
  if (!isValidDateString(value)) return '날짜 없음';
  const [year, month, day] = String(value).split('-');
  return `${year}.${month}.${day}`;
};
const formatMonthKorean = (monthValue: string) => {
  const [year, month] = monthValue.split('-');
  return `${year}년 ${Number(month)}월`;
};
const calendarCells = (monthValue: string) => {
  const [year, month] = monthValue.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();
  return [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: lastDay }, (_, i) => dateFromParts(year, month, i + 1)),
  ];
};

function DateFieldCard({
  label,
  value,
  colors,
  helper,
  error,
  onPress,
  onClear,
  onToday,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
  helper?: string | null;
  error?: string | null;
  onPress: () => void;
  onClear: () => void;
  onToday?: () => void;
}) {
  const styles = createCommonStyles(colors);
  return (
    <View style={{ flex: 1, minWidth: 150, marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={[styles.input, error && { borderColor: colors.danger }, { justifyContent: 'center' }]}>
        <Text style={{ color: value ? colors.text : colors.textTertiary, fontSize: 16, fontWeight: '800' }}>{value ? formatDateKorean(value) : '날짜 선택'}</Text>
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!error && !!helper && <Text style={styles.small}>{helper}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, paddingHorizontal: 9 }]} onPress={onPress}>
          <MaterialIcons name="calendar-month" size={16} color={colors.text} />
          <Text style={styles.ghostText}>달력</Text>
        </TouchableOpacity>
        {!!onToday && (
          <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, paddingHorizontal: 9 }]} onPress={onToday}>
            <Text style={styles.ghostText}>오늘</Text>
          </TouchableOpacity>
        )}
        {!!value && (
          <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, paddingHorizontal: 9 }]} onPress={onClear}>
            <Text style={styles.ghostText}>비우기</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Chip({ label, selected, colors, onPress }: { label: string; selected: boolean; colors: ThemeColors; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const lotToBean = (product: CoffeeProduct, lot: CoffeePurchaseLot) => ({
  id: lot.id,
  productId: product.id,
  name: product.name,
  roastery: product.roastery,
  origin: product.origin,
  variety: product.variety,
  process: product.process,
  roastLevel: product.roastLevel,
  purchaseDate: lot.purchaseDate,
  roastDate: lot.roastDate,
  openedDate: lot.openedDate,
  expiryDate: lot.expiryDate,
  storageType: lot.storageType,
  initialWeightGram: lot.initialWeightGram,
  remainingWeightGram: lot.remainingWeightGram,
  lotStatus: lot.lotStatus,
  seller: lot.seller,
  price: lot.price,
  lotMemo: lot.lotMemo,
  memo: product.memo,
  mainPhotoUri: lot.mainPhotoUri,
  createdAt: lot.createdAt,
  updatedAt: lot.updatedAt,
});

const currentLotFor = (lots: CoffeePurchaseLot[]) => {
  const active = lots.find(lot => lot.lotStatus === 'open') ?? lots.find(lot => lot.lotStatus === 'unopened');
  return active ?? [...lots].sort((a, b) => (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt))[0] ?? null;
};

const isActiveLot = (lot: CoffeePurchaseLot) => lot.lotStatus === 'open' || lot.lotStatus === 'unopened';

const consumptionSortedLots = (product: CoffeeProduct, lots: CoffeePurchaseLot[]) => [...lots].sort((a, b) => {
  const activeA = isActiveLot(a) ? 1 : 0;
  const activeB = isActiveLot(b) ? 1 : 0;
  if (activeA !== activeB) return activeB - activeA;
  const freshA = getFreshnessInfo(lotToBean(product, a));
  const freshB = getFreshnessInfo(lotToBean(product, b));
  if (freshA.priority !== freshB.priority) return freshB.priority - freshA.priority;
  const endA = freshA.freshUntilDate ?? '9999-12-31';
  const endB = freshB.freshUntilDate ?? '9999-12-31';
  if (endA !== endB) return endA.localeCompare(endB);
  return (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt);
});

const sortPurchaseLotsForDisplay = (product: CoffeeProduct, lots: CoffeePurchaseLot[], sort: LotSort) => {
  if (sort === 'freshness_priority') return consumptionSortedLots(product, lots);
  return [...lots].sort((a, b) => (b.purchaseDate ?? b.createdAt).localeCompare(a.purchaseDate ?? a.createdAt));
};

const purchaseNumberForLot = (lots: CoffeePurchaseLot[], lot: CoffeePurchaseLot) => {
  const ordered = [...lots].sort((a, b) => (a.purchaseDate ?? a.createdAt).localeCompare(b.purchaseDate ?? b.createdAt));
  const index = ordered.findIndex(item => item.id === lot.id);
  return index >= 0 ? index + 1 : 1;
};

const lotFormFromLot = (lot: CoffeePurchaseLot, mode: 'edit' | 'duplicate' = 'edit') => ({
  id: mode === 'edit' ? lot.id : '',
  purchaseDate: mode === 'edit' ? lot.purchaseDate ?? '' : todayDate(),
  roastDate: lot.roastDate ?? '',
  openedDate: mode === 'edit' ? lot.openedDate ?? '' : '',
  expiryDate: lot.expiryDate ?? '',
  storageType: lot.storageType ?? '',
  initialWeightGram: lot.initialWeightGram == null ? '' : String(lot.initialWeightGram),
  remainingWeightGram: mode === 'edit' && lot.remainingWeightGram != null ? String(lot.remainingWeightGram) : '',
  lotStatus: mode === 'edit' ? lot.lotStatus : 'unopened' as BeanLotStatus,
  seller: lot.seller ?? '',
  price: lot.price == null ? '' : String(lot.price),
  lotMemo: lot.lotMemo ?? '',
});

const computedProductStatus = (product: CoffeeProduct, lots: CoffeePurchaseLot[]): ProductFilter => {
  if (product.userStatus === 'wishlist') return 'wishlist';
  if (product.userStatus === 'archived') return 'archived';
  if (lots.some(lot => lot.lotStatus === 'open' || lot.lotStatus === 'unopened')) return 'owned';
  if (lots.length > 0) return 'consumed';
  return 'wishlist';
};

const remainingText = (lot: CoffeePurchaseLot | null, logs: ReturnType<typeof useCoffeeStore.getState>['logs']) => {
  if (!lot) return '-';
  const value = getLotDisplayRemainingGram(lot, logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id));
  return value == null ? '-' : `${value}g`;
};

const bestRating = (lotIds: string[], logs: ReturnType<typeof useCoffeeStore.getState>['logs']) => {
  const ratings = logs.filter(log => lotIds.includes(log.purchaseLotId ?? log.beanId)).map(log => log.rating).filter((value): value is number => typeof value === 'number');
  return ratings.length ? Math.max(...ratings) : null;
};

function ProductCard({
  product,
  lots,
  logs,
  colors,
  selected,
  onPress,
  onLog,
  onLots,
}: {
  product: CoffeeProduct;
  lots: CoffeePurchaseLot[];
  logs: ReturnType<typeof useCoffeeStore.getState>['logs'];
  colors: ThemeColors;
  selected: boolean;
  onPress: () => void;
  onLog?: () => void;
  onLots?: () => void;
}) {
  const styles = createCommonStyles(colors);
  const displayLot = consumptionSortedLots(product, lots)[0] ?? currentLotFor(lots);
  const status = computedProductStatus(product, lots);
  const beanLike = displayLot ? lotToBean(product, displayLot) : null;
  const freshness = beanLike ? getFreshnessInfo(beanLike) : null;
  const lotLogCount = lots.reduce((sum, lot) => sum + logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id).length, 0);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { marginBottom: 8, paddingVertical: 10, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.badge : colors.surface, gap: 6 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.small} numberOfLines={1}>{product.roastery || '로스터리 미입력'} · {product.origin || product.process || product.roastLevel || '제품 정보 미입력'}</Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 12, maxWidth: 82 }} numberOfLines={1}>{productStatusLabel(status)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.small, { flex: 1 }]} numberOfLines={1}>
          {displayLot ? `현재 구매분 ${lotStatusLabel[displayLot.lotStatus]} · 남은 양 ${remainingText(displayLot, logs)}` : '구매분 없음'} · 최근 기록 {lotLogCount}회
        </Text>
        {!!freshness && <FreshnessBadge freshness={freshness} colors={colors} compact />}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
        <TouchableOpacity style={[styles.button, { minHeight: 36, opacity: onLog ? 1 : 0.55 }]} disabled={!onLog} onPress={onLog}>
          <MaterialIcons name="edit-note" size={16} color="#fff" />
          <Text style={styles.buttonText}>{onLog ? '기록하기' : '개봉 필요'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ghostButton, { minHeight: 36 }]} onPress={onLots ?? onPress}>
          <MaterialIcons name="inventory-2" size={16} color={colors.text} />
          <Text style={styles.ghostText}>구매분</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function PhotoGrid({
  title,
  photos,
  colors,
  onOpen,
  onDelete,
}: {
  title?: string;
  photos: Array<{ uri: string; type: string; id?: string; saved?: boolean }>;
  colors: ThemeColors;
  onOpen: (uri: string) => void;
  onDelete?: (photo: { uri: string; type: string; id?: string; saved?: boolean }) => void;
}) {
  const styles = createCommonStyles(colors);
  return (
    <View style={{ gap: 8 }}>
      {!!title && <Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text>}
      {photos.length === 0 ? (
        <Text style={styles.small}>아직 사진 없음</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {photos.map(photo => (
            <View key={`${photo.id ?? photo.uri}-${photo.type}`} style={{ width: 88 }}>
              <TouchableOpacity onPress={() => onOpen(photo.uri)}>
                <Image source={{ uri: photo.uri }} style={{ width: 88, height: 88, borderRadius: 8, backgroundColor: colors.surfaceAlt }} />
              </TouchableOpacity>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3 }} numberOfLines={1}>{photoLabel(photo.type)}</Text>
              {!!onDelete && (
                <TouchableOpacity onPress={() => onDelete(photo)} style={{ marginTop: 4 }}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>삭제</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function PurchaseLotCompactRow({
  lot,
  lotNumber,
  product,
  colors,
  logs,
  onDetail,
  onLog,
  onEdit,
  onDuplicate,
}: {
  lot: CoffeePurchaseLot;
  lotNumber: number;
  product?: CoffeeProduct | null;
  colors: ThemeColors;
  logs: ReturnType<typeof useCoffeeStore.getState>['logs'];
  onDetail: () => void;
  onLog: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const styles = createCommonStyles(colors);
  const lotLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id);
  const freshness = product ? getFreshnessInfo(lotToBean(product, lot)) : null;
  return (
    <TouchableOpacity onPress={onDetail} style={{ minHeight: 62, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ width: 62 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{lotNumber}번째</Text>
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{lotStatusLabel[lot.lotStatus]}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>로스팅 {lot.roastDate ?? '-'} · 구매 {lot.purchaseDate ?? '-'}</Text>
          <Text style={styles.small} numberOfLines={1}>남은 양 {remainingText(lot, logs)} · 기록 {lotLogs.length}회 · {freshness?.compactMeta ?? `개봉 ${lot.openedDate ?? '-'}`}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {!!freshness && <FreshnessBadge freshness={freshness} colors={colors} compact />}
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {lot.lotStatus === 'open' && (
              <TouchableOpacity
                accessibilityLabel="이 구매분으로 기록"
                style={[styles.ghostButton, { width: 32, minHeight: 30, paddingHorizontal: 0, borderColor: colors.primary }]}
                onPress={event => {
                  event.stopPropagation();
                  onLog();
                }}
              >
                <MaterialIcons name="edit-note" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityLabel="구매분 복제"
              style={[styles.ghostButton, { width: 32, minHeight: 30, paddingHorizontal: 0 }]}
              onPress={event => {
                event.stopPropagation();
                onDuplicate();
              }}
            >
              <MaterialIcons name="content-copy" size={14} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel="구매분 편집"
              style={[styles.ghostButton, { width: 32, minHeight: 30, paddingHorizontal: 0 }]}
              onPress={event => {
                event.stopPropagation();
                onEdit();
              }}
            >
              <MaterialIcons name="edit" size={14} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function InventoryLotRow({
  lot,
  product,
  colors,
  logs,
  primaryLabel,
  primaryIcon,
  onPrimary,
  onAdjust,
  onDetail,
}: {
  lot: CoffeePurchaseLot;
  product: CoffeeProduct;
  colors: ThemeColors;
  logs: ReturnType<typeof useCoffeeStore.getState>['logs'];
  primaryLabel: string;
  primaryIcon: keyof typeof MaterialIcons.glyphMap;
  onPrimary: () => void;
  onAdjust?: () => void;
  onDetail: () => void;
}) {
  const styles = createCommonStyles(colors);
  const beanLike = lotToBean(product, lot);
  const freshness = getFreshnessInfo(beanLike);
  const lotLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id);
  const lastLog = lotLogs[0];
  const lastLogText = lastLog
    ? `최근 ${lastLog.actualDoseGram ?? lastLog.doseGram ?? '-'}g -> ${lastLog.yieldGram ?? '-'}g · ${lastLog.brewSeconds ?? '-'}초`
    : '아직 추출 기록 없음';
  return (
    <TouchableOpacity onPress={onDetail} style={[styles.card, { marginBottom: 8, paddingVertical: 10, gap: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {!!lot.mainPhotoUri && <Image source={{ uri: lot.mainPhotoUri }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.surfaceAlt }} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }} numberOfLines={1}>{product.name}</Text>
          <Text style={styles.small} numberOfLines={1}>{product.roastery || '로스터리 미입력'} · {lotStatusLabel[lot.lotStatus]} · 남은 양 {remainingText(lot, logs)}</Text>
          <Text style={styles.small} numberOfLines={1}>{freshness.compactMeta} · {lastLogText}</Text>
        </View>
        <FreshnessBadge freshness={freshness} colors={colors} compact />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TouchableOpacity style={[styles.button, { minHeight: 38 }]} onPress={event => { event.stopPropagation(); onPrimary(); }}>
          <MaterialIcons name={primaryIcon} size={17} color="#fff" />
          <Text style={styles.buttonText}>{primaryLabel}</Text>
        </TouchableOpacity>
        {!!onAdjust && (
          <TouchableOpacity style={[styles.ghostButton, { minHeight: 38 }]} onPress={event => { event.stopPropagation(); onAdjust(); }}>
            <MaterialIcons name="scale" size={17} color={colors.text} />
            <Text style={styles.ghostText}>보정</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.ghostButton, { minHeight: 38 }]} onPress={event => { event.stopPropagation(); onDetail(); }}>
          <MaterialIcons name="more-horiz" size={17} color={colors.text} />
          <Text style={styles.ghostText}>상세</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function LotMoreActionButton({
  label,
  icon,
  colors,
  onPress,
  destructive = false,
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  colors: ThemeColors;
  onPress: () => void;
  destructive?: boolean;
}) {
  const tone = destructive ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      style={{
        flex: 1,
        minHeight: 64,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: destructive ? colors.danger : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingVertical: 8,
        gap: 5,
      }}
      onPress={onPress}
    >
      <MaterialIcons name={icon} size={20} color={tone} />
      <Text
        style={{ color: tone, fontSize: 13, fontWeight: '800', textAlign: 'center' }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function BeansScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 780;
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string }>();
  const handledWidgetAction = useRef<string | null>(null);
  const colors = useSettingsStore(s => s.isDarkMode) ? darkColors : lightColors;
  const { aiProvider, openAiModel, geminiModel } = useSettingsStore();
  const styles = createCommonStyles(colors);
  const {
    coffeeProducts,
    purchaseLots,
    logs,
    settingsByBean,
    photosByBean,
    saveCoffeeProduct,
    savePurchaseLot,
    loadBeanPhotos,
    attachBeanPhoto,
    removeBeanPhoto,
    removeBean,
    removeCoffeeProduct,
    saveDefaultSetting,
    saveLog,
    selectBean,
    selectedBeanId,
  } = useCoffeeStore();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(coffeeProducts[0]?.id ?? null);
  const selectedProduct = coffeeProducts.find(product => product.id === selectedProductId) ?? null;
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const editingProduct = editingProductId ? coffeeProducts.find(product => product.id === editingProductId) ?? null : null;
  const selectedLots = purchaseLots.filter(lot => lot.productId === selectedProductId);
  const [selectedLotSort, setSelectedLotSort] = useState<LotSort>('recent_purchase');
  const selectedCurrentLot = currentLotFor(selectedLots);
  const selectedLotsForRecommendation = selectedProduct ? consumptionSortedLots(selectedProduct, selectedLots.filter(isActiveLot)) : selectedLots.filter(isActiveLot);
  const selectedLotsForDisplay = selectedProduct ? sortPurchaseLotsForDisplay(selectedProduct, selectedLots, selectedLotSort) : selectedLots;
  const selectedActiveLotsForDisplay = selectedLotsForDisplay.filter(isActiveLot);
  const selectedRecommendedLot = selectedLotsForRecommendation[0] ?? null;
  const selectedLotLogs = logs.filter(log => selectedLots.some(lot => lot.id === (log.purchaseLotId ?? log.beanId)));
  const selectedRecommendedLotLogs = selectedRecommendedLot ? logs.filter(log => (log.purchaseLotId ?? log.beanId) === selectedRecommendedLot.id) : [];
  const selectedBeanLike = selectedProduct && selectedRecommendedLot ? lotToBean(selectedProduct, selectedRecommendedLot) : null;
  const selectedFreshness = selectedBeanLike ? getFreshnessInfo(selectedBeanLike) : null;
  const recommendation = getDialInRecommendation(selectedBeanLike, logs, selectedRecommendedLot ? settingsByBean[selectedRecommendedLot.id] : null);
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [sort, setSort] = useState<ProductSort>('freshness_priority');
  const [productQuery, setProductQuery] = useState('');
  const [lotHistoryFilter, setLotHistoryFilter] = useState<'active' | 'open' | 'unopened' | 'all'>('active');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('none');
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [lotForm, setLotForm] = useState(emptyLotForm);
  const [pendingPhotos, setPendingPhotos] = useState<Array<{ uri: string; type: string }>>([]);
  const [analysis, setAnalysis] = useState<AiAnalysisParsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [productInfoOpen, setProductInfoOpen] = useState(false);
  const [productActionsOpen, setProductActionsOpen] = useState(false);
  const [lotHistoryOpen, setLotHistoryOpen] = useState(false);
  const [brewHistoryOpen, setBrewHistoryOpen] = useState(false);
  const [detailLot, setDetailLot] = useState<CoffeePurchaseLot | null>(null);
  const [lotActionsLot, setLotActionsLot] = useState<CoffeePurchaseLot | null>(null);
  const [balanceAdjustLot, setBalanceAdjustLot] = useState<CoffeePurchaseLot | null>(null);
  const [balanceAdjustDraft, setBalanceAdjustDraft] = useState('');
  const [finishedInventoryOpen, setFinishedInventoryOpen] = useState(false);
  const [datePickerField, setDatePickerField] = useState<LotDateKey | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(todayDate().slice(0, 7));
  const [quickLotDates, setQuickLotDates] = useState({ purchaseDate: todayDate(), roastDate: '' });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickDatePickerField, setQuickDatePickerField] = useState<QuickLotDateKey | null>(null);
  const [quickCalendarMonth, setQuickCalendarMonth] = useState(todayDate().slice(0, 7));
  const lastSyncedSelectedBeanId = useRef<string | null>(null);

  useEffect(() => {
    for (const lot of selectedLots) {
      void loadBeanPhotos(lot.id);
    }
  }, [selectedProductId, selectedLots.length]);

  useEffect(() => {
    if (editorMode !== 'none') return;
    if (!selectedBeanId) {
      lastSyncedSelectedBeanId.current = null;
      return;
    }
    const selectedLot = purchaseLots.find(lot => lot.id === selectedBeanId);
    if (!selectedLot?.productId || lastSyncedSelectedBeanId.current === selectedBeanId) return;
    lastSyncedSelectedBeanId.current = selectedBeanId;
    if (selectedLot?.productId && selectedLot.productId !== selectedProductId) {
      setSelectedProductId(selectedLot.productId);
      setQuickAddOpen(false);
    }
  }, [purchaseLots, selectedBeanId, editorMode]);

  const productsForList = useMemo(() => {
    const rows = coffeeProducts.map(product => {
      const lots = purchaseLots.filter(lot => lot.productId === product.id);
      const lotIds = lots.map(lot => lot.id);
      const productLogs = logs.filter(log => lotIds.includes(log.purchaseLotId ?? log.beanId));
      const currentLot = currentLotFor(lots);
      const priorityLot = consumptionSortedLots(product, lots)[0] ?? currentLot;
      return {
        product,
        lots,
        status: computedProductStatus(product, lots),
        latestPurchase: lots.map(lot => lot.purchaseDate ?? lot.createdAt).sort().at(-1) ?? '',
        latestBrew: productLogs[0]?.brewedAt ?? '',
        best: bestRating(lotIds, logs) ?? 0,
        freshnessPriority: priorityLot ? getFreshnessPriority(lotToBean(product, priorityLot)) : 0,
        freshUntilDate: priorityLot ? getFreshnessInfo(lotToBean(product, priorityLot)).freshUntilDate ?? '9999-12-31' : '9999-12-31',
      };
    });
    const query = productQuery.trim().toLowerCase();
    return rows
      .filter(row => filter === 'all' ? row.status !== 'archived' : row.status === filter)
      .filter(row => !query || [
        row.product.name,
        row.product.roastery,
        row.product.origin,
        row.product.process,
        row.product.roastLevel,
        row.product.tastingNotes,
      ].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a, b) => {
        if (sort === 'freshness_priority') {
          if (b.freshnessPriority !== a.freshnessPriority) return b.freshnessPriority - a.freshnessPriority;
          return a.freshUntilDate.localeCompare(b.freshUntilDate);
        }
        if (sort === 'recent_brew') return b.latestBrew.localeCompare(a.latestBrew);
        if (sort === 'repeat_count') return b.lots.length - a.lots.length;
        if (sort === 'best_rating') return b.best - a.best;
        if (sort === 'name') return a.product.name.localeCompare(b.product.name);
        return b.latestPurchase.localeCompare(a.latestPurchase);
      });
  }, [coffeeProducts, purchaseLots, logs, filter, sort, productQuery]);

  const inventoryRows = useMemo(() => {
    const rows = productsForList.flatMap(row => row.lots.map(lot => ({
      product: row.product,
      lot,
      lots: row.lots,
      freshness: getFreshnessInfo(lotToBean(row.product, lot)),
    })));
    const sortInventory = (items: typeof rows) => [...items].sort((a, b) => {
      if (b.freshness.priority !== a.freshness.priority) return b.freshness.priority - a.freshness.priority;
      const aDate = a.freshness.freshUntilDate ?? a.lot.openedDate ?? a.lot.purchaseDate ?? a.lot.createdAt;
      const bDate = b.freshness.freshUntilDate ?? b.lot.openedDate ?? b.lot.purchaseDate ?? b.lot.createdAt;
      return aDate.localeCompare(bDate);
    });
    return {
      open: sortInventory(rows.filter(row => row.lot.lotStatus === 'open')),
      unopened: sortInventory(rows.filter(row => row.lot.lotStatus === 'unopened')),
      finished: [...rows.filter(row => row.lot.lotStatus === 'finished' || row.lot.lotStatus === 'archived')]
        .sort((a, b) => (b.lot.updatedAt ?? b.lot.createdAt).localeCompare(a.lot.updatedAt ?? a.lot.createdAt)),
    };
  }, [productsForList]);
  const recommendedInventoryRow = inventoryRows.open[0] ?? inventoryRows.unopened[0] ?? null;

  const visibleHistoryLots = useMemo(() => selectedLotsForDisplay.filter(lot => {
    if (lotHistoryFilter === 'active') return lot.lotStatus === 'open' || lot.lotStatus === 'unopened';
    if (lotHistoryFilter === 'open') return lot.lotStatus === 'open';
    if (lotHistoryFilter === 'unopened') return lot.lotStatus === 'unopened';
    return true;
  }), [selectedLotsForDisplay, lotHistoryFilter]);

  const openProductEditor = (product?: CoffeeProduct | null) => {
    setQuickAddOpen(false);
    setQuickDatePickerField(null);
    setEditingProductId(product?.id ?? null);
    setAnalysis(null);
    setPendingPhotos([]);
    setProductForm(product ? {
      name: product.name,
      roastery: product.roastery ?? '',
      origin: product.origin ?? '',
      variety: product.variety ?? '',
      process: product.process ?? '',
      roastLevel: product.roastLevel ?? '',
      tastingNotes: product.tastingNotes ?? '',
      userStatus: product.userStatus,
      memo: product.memo ?? '',
    } : emptyProductForm);
    setLotForm(emptyLotForm);
    setEditorMode('product');
  };

  const openLotEditor = (lot?: CoffeePurchaseLot | null, productOverride?: CoffeeProduct | null) => {
    const targetProduct = productOverride ?? selectedProduct;
    if (!targetProduct) {
      Alert.alert('제품 필요', '먼저 제품을 선택하거나 저장하세요.');
      return;
    }
    setQuickAddOpen(false);
    setQuickDatePickerField(null);
    setAnalysis(null);
    setPendingPhotos([]);
    setLotForm(lot ? lotFormFromLot(lot) : emptyLotForm);
    if (lot) void loadBeanPhotos(lot.id);
    setEditorMode('lot');
  };

  const duplicatePurchaseLot = (lot: CoffeePurchaseLot) => {
    const product = coffeeProducts.find(item => item.id === lot.productId) ?? selectedProduct;
    if (!product) {
      Alert.alert('제품 필요', '복제할 구매분의 제품을 찾을 수 없습니다.');
      return;
    }
    setSelectedProductId(product.id);
    setDetailLot(null);
    setLotHistoryOpen(false);
    setQuickAddOpen(false);
    setQuickDatePickerField(null);
    setAnalysis(null);
    setPendingPhotos([]);
    setLotForm(lotFormFromLot(lot, 'duplicate'));
    setEditorMode('lot');
  };

  const handleWidgetAction = (action: string | null, skipHandledCheck = false) => {
    if (!action || (!skipHandledCheck && handledWidgetAction.current === action)) return;
    if (action === 'newProduct') {
      handledWidgetAction.current = action;
      openProductEditor(null);
      return;
    }
    if (action === 'newLot') {
      const product = selectedProduct ?? coffeeProducts[0] ?? null;
      if (!product) return;
      handledWidgetAction.current = action;
      setSelectedProductId(product.id);
      openLotEditor(null, product);
    }
  };

  useEffect(() => {
    const action = typeof params.action === 'string' ? params.action : null;
    handleWidgetAction(action);
  }, [params.action, selectedProduct, coffeeProducts]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', event => {
      if (!event.url.includes('://beans') && !event.url.includes('/beans')) return;
      const action = /[?&]action=([^&]+)/.exec(event.url)?.[1] ?? null;
      handleWidgetAction(action ? decodeURIComponent(action) : null, true);
    });
    return () => subscription.remove();
  }, [selectedProduct, coffeeProducts]);

  const openDatePicker = (field: LotDateKey) => {
    const normalized = normalizeDateInput(lotForm[field]);
    setCalendarMonth((normalized.value ?? todayDate()).slice(0, 7));
    setDatePickerField(field);
  };

  const setLotDate = (field: LotDateKey, value: string) => {
    setLotForm(prev => ({
      ...prev,
      [field]: value,
      lotStatus: field === 'openedDate' && value && prev.lotStatus === 'unopened' ? 'open' : prev.lotStatus,
    }));
  };

  const clearLotDate = (field: LotDateKey) => {
    setLotForm(prev => ({ ...prev, [field]: '' }));
  };

  const openQuickDatePicker = (field: QuickLotDateKey) => {
    const normalized = normalizeDateInput(quickLotDates[field]);
    setQuickCalendarMonth((normalized.value ?? todayDate()).slice(0, 7));
    setQuickDatePickerField(field);
  };

  const setQuickLotDate = (field: QuickLotDateKey, value: string) => {
    setQuickLotDates(prev => ({ ...prev, [field]: value }));
  };

  const clearQuickLotDate = (field: QuickLotDateKey) => {
    setQuickLotDates(prev => ({ ...prev, [field]: '' }));
  };

  const resetQuickLotDates = () => {
    setQuickLotDates({ purchaseDate: todayDate(), roastDate: '' });
  };

  const closeQuickAdd = () => {
    setQuickAddOpen(false);
    setQuickDatePickerField(null);
    resetQuickLotDates();
  };

  const selectProductForDetail = (product: CoffeeProduct, lots: CoffeePurchaseLot[]) => {
    const currentLot = currentLotFor(lots);
    setSelectedProductId(product.id);
    setEditingProductId(null);
    setEditorMode('none');
    setProductInfoOpen(false);
    setProductActionsOpen(false);
    setDetailLot(null);
    closeQuickAdd();
    selectBean(currentLot?.id ?? null);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      Alert.alert('제품명 필요', '원두 제품명은 필수입니다.');
      return;
    }
    const saved = await saveCoffeeProduct({
      id: editingProductId ?? undefined,
      name: productForm.name.trim(),
      roastery: emptyToNull(productForm.roastery),
      origin: emptyToNull(productForm.origin),
      variety: emptyToNull(productForm.variety),
      process: emptyToNull(productForm.process),
      roastLevel: emptyToNull(productForm.roastLevel),
      tastingNotes: emptyToNull(productForm.tastingNotes),
      userStatus: productForm.userStatus,
      memo: emptyToNull(productForm.memo),
      createdAt: editingProduct?.createdAt,
    });
    setFilter('all');
    setProductQuery('');
    setSelectedProductId(saved.id);
    selectBean(editingProductId ? selectedCurrentLot?.id ?? null : null);
    const hasFirstLotCandidate = Boolean(
      normalize(lotForm.purchaseDate)
      || normalize(lotForm.roastDate)
      || normalize(lotForm.expiryDate)
      || normalize(lotForm.initialWeightGram)
      || normalize(lotForm.seller)
      || pendingPhotos.length
    );
    if (hasFirstLotCandidate) {
      Alert.alert('첫 구매분도 저장할까요?', '사진이나 날짜/중량 후보가 있습니다. 제품 저장과 함께 첫 구매 이력으로 남길 수 있습니다.', [
        { text: '제품만 저장', onPress: () => { selectBean(null); void Promise.all(pendingPhotos.map(photo => deletePhotoFile(photo.uri))); setPendingPhotos([]); setEditingProductId(null); setEditorMode('none'); } },
        {
          text: '같이 저장',
          onPress: () => {
            void (async () => {
              const dates = normalizeLotDates(lotForm);
              if (!dates.ok) {
                Alert.alert('날짜 확인 필요', dates.message);
                return;
              }
              const lot = await savePurchaseLot({
                productId: saved.id,
                purchaseDate: dates.values.purchaseDate,
                roastDate: dates.values.roastDate,
                openedDate: dates.values.openedDate,
                expiryDate: dates.values.expiryDate,
                storageType: emptyToNull(lotForm.storageType),
                initialWeightGram: parseOptionalNumber(lotForm.initialWeightGram),
                remainingWeightGram: parseOptionalNumber(lotForm.remainingWeightGram),
                lotStatus: lotForm.lotStatus,
                seller: emptyToNull(lotForm.seller),
                price: parseOptionalNumber(lotForm.price),
                lotMemo: emptyToNull(lotForm.lotMemo),
              });
              for (const photo of pendingPhotos) await attachBeanPhoto(lot.id, photo.uri, photo.type);
              setPendingPhotos([]);
              setLotForm(emptyLotForm);
              setEditingProductId(null);
              setEditorMode('none');
            })();
          },
        },
      ]);
      return;
    }
    setEditingProductId(null);
    setEditorMode('none');
    Alert.alert('저장 완료', '원두 제품 정보를 저장했습니다.');
  };

  const saveLot = async () => {
    if (!selectedProduct) return;
    const dates = normalizeLotDates(lotForm);
    if (!dates.ok) {
      Alert.alert('날짜 확인 필요', dates.message);
      return;
    }
    const saved = await savePurchaseLot({
      id: lotForm.id || undefined,
      productId: selectedProduct.id,
      purchaseDate: dates.values.purchaseDate,
      roastDate: dates.values.roastDate,
      openedDate: dates.values.openedDate,
      expiryDate: dates.values.expiryDate,
      storageType: emptyToNull(lotForm.storageType),
      initialWeightGram: parseOptionalNumber(lotForm.initialWeightGram),
      remainingWeightGram: parseOptionalNumber(lotForm.remainingWeightGram),
      lotStatus: lotForm.lotStatus,
      seller: emptyToNull(lotForm.seller),
      price: parseOptionalNumber(lotForm.price),
      lotMemo: emptyToNull(lotForm.lotMemo),
    });
    for (const photo of pendingPhotos) await attachBeanPhoto(saved.id, photo.uri, photo.type);
    setPendingPhotos([]);
    setEditorMode('none');
    Alert.alert('저장 완료', '구매 이력을 저장했습니다.');
  };

  const saveQuickPurchaseLot = async (quickLot: { lotStatus: BeanLotStatus; purchaseDate: string; roastDate: string; initialWeightGram: string; seller: string }) => {
    if (!selectedProduct) return false;
    const dates = normalizeLotDates({
      ...emptyLotForm,
      purchaseDate: quickLot.purchaseDate,
      roastDate: quickLot.roastDate,
      lotStatus: quickLot.lotStatus,
      initialWeightGram: quickLot.initialWeightGram,
      seller: quickLot.seller,
    });
    if (!dates.ok) {
      Alert.alert('날짜 확인 필요', dates.message);
      return false;
    }
    const openedDate = quickLot.lotStatus === 'open' ? todayDate() : null;
    const saved = await savePurchaseLot({
      productId: selectedProduct.id,
      purchaseDate: dates.values.purchaseDate,
      roastDate: dates.values.roastDate,
      openedDate,
      lotStatus: quickLot.lotStatus,
      initialWeightGram: parseOptionalNumber(quickLot.initialWeightGram),
      seller: emptyToNull(quickLot.seller),
    });
    selectBean(saved.id);
    setQuickAddOpen(false);
    Alert.alert('저장 완료', '구매분을 빠르게 추가했습니다.');
    return true;
  };

  const changeLotStatus = async (lot: CoffeePurchaseLot, status: BeanLotStatus) => {
    const saved = await savePurchaseLot({
      ...lot,
      lotStatus: status,
      openedDate: status === 'open' && !lot.openedDate ? todayDate() : lot.openedDate,
      remainingWeightGram: status === 'finished' ? 0 : lot.remainingWeightGram,
    });
    selectBean(saved.id);
    setDetailLot(prev => prev?.id === saved.id ? saved : prev);
  };

  const openLotDetail = (lot: CoffeePurchaseLot) => {
    setSelectedProductId(lot.productId);
    setDetailLot(lot);
  };

  const openBalanceAdjustment = (lot: CoffeePurchaseLot) => {
    setSelectedProductId(lot.productId);
    setBalanceAdjustLot(lot);
    setBalanceAdjustDraft(lot.remainingWeightGram == null ? '' : String(lot.remainingWeightGram));
  };

  const saveBalanceAdjustment = async () => {
    if (!balanceAdjustLot) return;
    const trimmed = balanceAdjustDraft.trim();
    const parsed = trimmed ? Number(trimmed) : null;
    if (trimmed && (parsed == null || !Number.isFinite(parsed) || parsed < 0)) {
      Alert.alert('값 확인', '남은 양은 0 이상의 숫자로 입력하세요.');
      return;
    }
    const saved = await savePurchaseLot({ ...balanceAdjustLot, remainingWeightGram: parsed });
    selectBean(saved.id);
    setBalanceAdjustLot(null);
    setBalanceAdjustDraft('');
    setDetailLot(prev => prev?.id === saved.id ? saved : prev);
  };

  const deletePurchaseLot = (lot: CoffeePurchaseLot) => {
    const product = coffeeProducts.find(item => item.id === lot.productId) ?? selectedProduct;
    const lotLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id);
    const title = '구매 이력 삭제';
    const message = [
      `${product?.name ?? '원두'} 구매분을 삭제할까요?`,
      `구매일: ${lot.purchaseDate ?? '-'}`,
      lotLogs.length ? `연결된 추출 기록 ${lotLogs.length}개도 함께 삭제됩니다.` : '연결된 추출 기록은 없습니다.',
      '이 작업은 되돌릴 수 없습니다.',
    ].join('\n');
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await removeBean(lot.id);
            setLotActionsLot(null);
            setDetailLot(null);
            setLotHistoryOpen(false);
            setEditorMode('none');
            Alert.alert('삭제 완료', '구매 이력을 삭제했습니다.');
          })();
        },
      },
    ]);
  };

  const setSelectedProductStatus = async (status: CoffeeProductUserStatus) => {
    if (!selectedProduct) return;
    const saved = await saveCoffeeProduct({ ...selectedProduct, userStatus: status });
    setSelectedProductId(saved.id);
    setFilter(status === 'archived' ? 'archived' : 'all');
    setProductQuery('');
    setProductActionsOpen(false);
    Alert.alert(status === 'archived' ? '보관 완료' : '복원 완료', status === 'archived' ? '기본 원두 목록에서 숨겼습니다. 보관/숨김 필터에서 다시 볼 수 있습니다.' : '기본 원두 목록으로 복원했습니다.');
  };

  const deleteSelectedProduct = () => {
    if (!selectedProduct) return;
    const lotCount = selectedLots.length;
    const logCount = selectedLotLogs.length;
    Alert.alert(
      '제품 완전 삭제',
      [
        `${selectedProduct.name} 제품을 완전히 삭제할까요?`,
        `구매분 ${lotCount}개와 추출 기록 ${logCount}개도 함께 삭제됩니다.`,
        '되돌릴 수 없으니 보통은 보관/숨김을 권장합니다.',
      ].join('\n'),
      [
        { text: '취소', style: 'cancel' },
        { text: '보관/숨김', onPress: () => void setSelectedProductStatus('archived') },
        {
          text: '완전 삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await removeCoffeeProduct(selectedProduct.id);
              setProductActionsOpen(false);
              setDetailLot(null);
              setEditorMode('none');
              setEditingProductId(null);
              setSelectedProductId(null);
              setFilter('all');
              setProductQuery('');
              Alert.alert('삭제 완료', '원두 제품과 연결된 이력을 삭제했습니다.');
            })();
          },
        },
      ]
    );
  };

  const pickPhoto = async (camera = false, type = 'bean_label') => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('권한 필요', camera ? '카메라 권한을 허용해주세요.' : '사진 권한을 허용해주세요.');
      return;
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true });
    if (result.canceled) return;
    const stored: string[] = [];
    for (const asset of result.assets) {
      if (asset.uri) stored.push(await persistPhoto(asset.uri, 'bean'));
    }
    if (editorMode === 'lot' && lotForm.id) {
      for (const uri of stored) await attachBeanPhoto(lotForm.id, uri, type);
      void loadBeanPhotos(lotForm.id);
    } else {
      setPendingPhotos(prev => [...prev, ...stored.map(uri => ({ uri, type }))]);
    }
  };

  const sortedPhotosForAi = (photos: Array<{ uri: string; type: string }>) => {
    const priority = ['bean_label', 'back_label', 'roast_date_label'];
    return [...photos].sort((a, b) => priority.indexOf(a.type) - priority.indexOf(b.type)).slice(0, 4);
  };

  const analyzePhotos = async () => {
    const savedPhotos = editorMode === 'lot' && lotForm.id ? (photosByBean[lotForm.id] ?? []).map(photo => ({ uri: photo.photoUri, type: photo.photoType })) : [];
    const photos = sortedPhotosForAi([...pendingPhotos, ...savedPhotos]);
    if (!photos.length) {
      Alert.alert('사진 필요', '분석할 사진을 먼저 추가하세요.');
      return;
    }
    try {
      setBusy(true);
      const inputs: BeanAnalysisPhotoInput[] = photos.map((photo, index) => ({ id: `photo_${index + 1}`, uri: photo.uri, photoType: photo.type, label: photo.type }));
      const parsed = await analyzeBeanPhotos(aiProvider, aiProvider === 'openai' ? openAiModel : geminiModel, inputs, lotForm.id || null, editorMode === 'product' ? 'new_product' : 'existing_product_lot');
      setAnalysis(parsed);
      Alert.alert('AI 분석 완료', editorMode === 'product' ? '제품과 첫 구매분 후보를 읽었습니다.' : '구매분 날짜/중량 후보만 읽었습니다.');
    } catch (error: any) {
      Alert.alert('AI 분석 실패', error?.message ?? '분석 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const applyAnalysis = (replace = false) => {
    if (!analysis) return;
    const pick = (current: string, value: string | number | null | undefined) => (replace || !current.trim()) ? String(value ?? current) : current;
    if (editorMode === 'product') {
      setProductForm(prev => ({
        ...prev,
        name: pick(prev.name, analysis.bean_name),
        roastery: pick(prev.roastery, analysis.roastery),
        origin: pick(prev.origin, analysis.origin),
        variety: pick(prev.variety, analysis.variety),
        process: pick(prev.process, analysis.process),
        roastLevel: pick(prev.roastLevel, analysis.roast_level),
        tastingNotes: pick(prev.tastingNotes, analysis.visible_text_summary),
      }));
    }
    setLotForm(prev => ({
      ...prev,
      purchaseDate: pick(prev.purchaseDate, normalizedDateOrOriginal(analysis.purchase_date)),
      roastDate: pick(prev.roastDate, normalizedDateOrOriginal(analysis.roast_date)),
      openedDate: pick(prev.openedDate, normalizedDateOrOriginal(analysis.opened_date)),
      expiryDate: pick(prev.expiryDate, normalizedDateOrOriginal(analysis.expiry_date)),
      initialWeightGram: pick(prev.initialWeightGram, analysis.initial_weight_gram ?? analysis.weight),
      seller: pick(prev.seller, analysis.seller),
      price: pick(prev.price, analysis.price),
    }));
  };

  const applyProductAnalysis = (replace = false) => {
    if (!analysis) return;
    const pick = (current: string, value: string | null | undefined) => (replace || !current.trim()) ? value ?? current : current;
    setProductForm(prev => ({
      ...prev,
      name: pick(prev.name, analysis.bean_name),
      roastery: pick(prev.roastery, analysis.roastery),
      origin: pick(prev.origin, analysis.origin),
      variety: pick(prev.variety, analysis.variety),
      process: pick(prev.process, analysis.process),
      roastLevel: pick(prev.roastLevel, analysis.roast_level),
      tastingNotes: pick(prev.tastingNotes, analysis.visible_text_summary),
    }));
  };

  const applyLotCandidate = (replace = false) => {
    if (!analysis) return;
    const pick = (current: string, value: string | number | null | undefined) => (replace || !current.trim()) ? String(value ?? current) : current;
    setLotForm(prev => ({
      ...prev,
      purchaseDate: pick(prev.purchaseDate, normalizedDateOrOriginal(analysis.purchase_date)),
      roastDate: pick(prev.roastDate, normalizedDateOrOriginal(analysis.roast_date)),
      openedDate: pick(prev.openedDate, normalizedDateOrOriginal(analysis.opened_date)),
      expiryDate: pick(prev.expiryDate, normalizedDateOrOriginal(analysis.expiry_date)),
      initialWeightGram: pick(prev.initialWeightGram, analysis.initial_weight_gram ?? analysis.weight),
      seller: pick(prev.seller, analysis.seller),
      price: pick(prev.price, analysis.price),
    }));
  };

  const deletePendingPhoto = async (photo: { uri: string }) => {
    setPendingPhotos(prev => prev.filter(item => item.uri !== photo.uri));
    await deletePhotoFile(photo.uri);
  };

  const deleteSavedPhoto = async (lotId: string, photoId?: string) => {
    if (!photoId) return;
    await removeBeanPhoto(lotId, photoId);
  };

  const copyProductForAi = async () => {
    if (!selectedProduct || !selectedRecommendedLot) {
      Alert.alert('구매분 필요', 'AI용 복사는 추출 기록과 연결된 구매분이 있을 때 사용할 수 있습니다.');
      return;
    }
    await copyAiText({ bean: lotToBean(selectedProduct, selectedRecommendedLot), setting: settingsByBean[selectedRecommendedLot.id], logs: selectedLotLogs });
    Alert.alert('복사 완료', '제품과 현재 구매분 정보를 AI용 프롬프트로 복사했습니다.');
  };

  const copyLotForAi = async (lot: CoffeePurchaseLot, target?: keyof typeof externalAiTargets) => {
    const product = coffeeProducts.find(item => item.id === lot.productId) ?? selectedProduct;
    if (!product) {
      Alert.alert('제품 필요', '구매분의 원두 제품 정보를 찾을 수 없습니다.');
      return;
    }
    const lotLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id);
    const currentRemainingGram = getLotDisplayRemainingGram(lot, lotLogs);
    try {
      await copyPurchaseLotAiText({ product, lot, logs: lotLogs, currentRemainingGram });
      if (target) {
        await Linking.openURL(externalAiTargets[target]);
        Alert.alert('구매분 조언 프롬프트 복사 완료', `${target === 'chatgpt' ? 'ChatGPT' : 'Gemini'}가 열리면 입력창에 붙여넣으세요.`);
        return;
      }
      Alert.alert('구매분 조언 프롬프트 복사 완료', '구매분 정보와 최근 기록 요약을 클립보드에 복사했습니다.');
    } catch (error: any) {
      Alert.alert('복사 실패', error?.message ?? 'AI 프롬프트를 복사하지 못했습니다.');
    }
  };

  const cloneBestLog = async () => {
    const source = selectedLotLogs.find(log => log.isFavorite) ?? selectedLotLogs[0];
    if (!source) {
      Alert.alert('기록 없음', '복제할 추출 기록이 없습니다.');
      return;
    }
    await saveLog({ ...source, id: undefined, brewedAt: new Date().toISOString(), isFavorite: false });
    Alert.alert('복제 완료', '좋았던 기록을 새 기록으로 복제했습니다.');
  };

  const logWithCurrentLot = () => {
    if (!selectedRecommendedLot) {
      openLotEditor(null);
      return;
    }
    selectBean(selectedRecommendedLot.id);
    router.push(`/log?action=newBrew&ts=${Date.now()}`);
  };

  const logWithPurchaseLot = (lot: CoffeePurchaseLot) => {
    if (lot.lotStatus !== 'open') {
      Alert.alert('개봉 구매분만 바로 기록', '미개봉 구매분은 먼저 개봉 상태로 바꾼 뒤 추출 기록을 남겨주세요.');
      return;
    }
    selectBean(lot.id);
    router.push(`/log?action=newBrew&ts=${Date.now()}`);
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Modal visible={previewUri != null} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setPreviewUri(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          {previewUri && <Image source={{ uri: previewUri }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />}
          <Text style={{ color: '#fff', fontWeight: '800', marginTop: 12 }}>닫기</Text>
        </TouchableOpacity>
      </Modal>
      <Text style={styles.title}>원두 관리</Text>
      <Text style={styles.subtitle}>지금 마실 수 있는 구매분과 남은 양을 먼저 봅니다. 제품 상세와 오래된 이력은 상세에서 정리합니다.</Text>
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 14, marginTop: 18 }}>
        <View style={{ flex: 0.9 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity style={[styles.button, { flexGrow: 1 }]} onPress={() => openProductEditor(null)}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={styles.buttonText}>원두 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={() => selectedProduct ? openLotEditor(null) : openProductEditor(null)}>
              <MaterialIcons name="add-shopping-cart" size={18} color={colors.text} />
              <Text style={styles.ghostText}>구매분 추가</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { gap: 10, marginBottom: 12 }]}>
            <View style={styles.between}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>재고 찾기</Text>
              <TouchableOpacity accessibilityLabel="정렬과 고급 필터 열기" style={[styles.ghostButton, { minHeight: 36 }]} onPress={() => setFilterSheetOpen(true)}>
                <MaterialIcons name="tune" size={17} color={colors.text} />
                <Text style={styles.ghostText}>필터</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={productQuery}
              onChangeText={setProductQuery}
              placeholder="원두명, 로스터리 검색"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.small}>개봉 {inventoryRows.open.length}개 · 미개봉 {inventoryRows.unopened.length}개 · 표시 제품 {productsForList.length}개</Text>
          </View>

          {recommendedInventoryRow && (
            <View style={{ gap: 8, marginBottom: 14 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>다음에 쓸 원두</Text>
              <InventoryLotRow
                lot={recommendedInventoryRow.lot}
                product={recommendedInventoryRow.product}
                colors={colors}
                logs={logs}
                primaryLabel={recommendedInventoryRow.lot.lotStatus === 'open' ? '기록하기' : '개봉하기'}
                primaryIcon={recommendedInventoryRow.lot.lotStatus === 'open' ? 'edit-note' : 'inventory'}
                onPrimary={() => recommendedInventoryRow.lot.lotStatus === 'open' ? logWithPurchaseLot(recommendedInventoryRow.lot) : void changeLotStatus(recommendedInventoryRow.lot, 'open')}
                onAdjust={recommendedInventoryRow.lot.lotStatus === 'open' ? () => openBalanceAdjustment(recommendedInventoryRow.lot) : undefined}
                onDetail={() => openLotDetail(recommendedInventoryRow.lot)}
              />
            </View>
          )}

          <Text style={styles.sectionTitle}>개봉 중</Text>
          {inventoryRows.open.length === 0 ? (
            <View style={styles.card}><Text style={styles.subtitle}>개봉 중인 구매분이 없습니다. 미개봉 원두를 개봉하거나 새 구매분을 추가하세요.</Text></View>
          ) : inventoryRows.open.map(row => (
            <InventoryLotRow
              key={row.lot.id}
              lot={row.lot}
              product={row.product}
              colors={colors}
              logs={logs}
              primaryLabel="기록"
              primaryIcon="edit-note"
              onPrimary={() => logWithPurchaseLot(row.lot)}
              onAdjust={() => openBalanceAdjustment(row.lot)}
              onDetail={() => openLotDetail(row.lot)}
            />
          ))}

          <Text style={styles.sectionTitle}>미개봉</Text>
          {inventoryRows.unopened.length === 0 ? (
            <Text style={styles.small}>미개봉 구매분이 없습니다.</Text>
          ) : inventoryRows.unopened.slice(0, 6).map(row => (
            <InventoryLotRow
              key={row.lot.id}
              lot={row.lot}
              product={row.product}
              colors={colors}
              logs={logs}
              primaryLabel="개봉"
              primaryIcon="inventory"
              onPrimary={() => void changeLotStatus(row.lot, 'open')}
              onDetail={() => openLotDetail(row.lot)}
            />
          ))}
          {inventoryRows.unopened.length > 6 && <Text style={styles.small}>미개봉 {inventoryRows.unopened.length - 6}개는 필터나 제품 상세에서 확인하세요.</Text>}

          <TouchableOpacity style={[styles.ghostButton, { marginTop: 12, alignSelf: 'flex-start' }]} onPress={() => setFinishedInventoryOpen(prev => !prev)}>
            <MaterialIcons name={finishedInventoryOpen ? 'keyboard-arrow-up' : 'inventory-2'} size={18} color={colors.text} />
            <Text style={styles.ghostText}>소진/보관 {finishedInventoryOpen ? '접기' : `보기 (${inventoryRows.finished.length})`}</Text>
          </TouchableOpacity>
          {finishedInventoryOpen && inventoryRows.finished.slice(0, 8).map(row => (
            <InventoryLotRow
              key={row.lot.id}
              lot={row.lot}
              product={row.product}
              colors={colors}
              logs={logs}
              primaryLabel="상세"
              primaryIcon="visibility"
              onPrimary={() => openLotDetail(row.lot)}
              onDetail={() => openLotDetail(row.lot)}
            />
          ))}

          {productsForList.length === 0 && (
            <View style={styles.card}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>표시할 원두가 없습니다</Text>
              <Text style={styles.subtitle}>검색어나 상태 필터 때문에 숨겨졌을 수 있습니다.</Text>
              <TouchableOpacity style={[styles.button, { alignSelf: 'flex-start' }]} onPress={() => { setFilter('all'); setProductQuery(''); }}>
                <MaterialIcons name="filter-alt-off" size={18} color="#fff" />
                <Text style={styles.buttonText}>필터 초기화</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ flex: 1.35 }}>
          {editorMode === 'none' && selectedProduct && isWide && (
            <>
              <View style={[styles.card, { gap: 8, paddingVertical: 12 }]}>
                <View style={styles.between}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }} numberOfLines={1}>{selectedProduct.name}</Text>
                    <Text style={styles.small} numberOfLines={1}>
                      {selectedProduct.roastery || '로스터리 미입력'} · {computedProductStatus(selectedProduct, selectedLots) === 'wishlist' ? '먹고 싶은 원두' : `${selectedLots.length}회 구매`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity accessibilityLabel="제품 편집" style={[styles.ghostButton, { width: 38, minHeight: 36, paddingHorizontal: 0 }]} onPress={() => openProductEditor(selectedProduct)}>
                      <MaterialIcons name="edit" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="전체 정보" style={[styles.ghostButton, { width: 38, minHeight: 36, paddingHorizontal: 0 }]} onPress={() => setProductInfoOpen(true)}>
                      <MaterialIcons name="info-outline" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel="원두 추가 작업" style={[styles.ghostButton, { width: 38, minHeight: 36, paddingHorizontal: 0 }]} onPress={() => setProductActionsOpen(true)}>
                      <MaterialIcons name="more-horiz" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
                {!!selectedProduct.tastingNotes && <Text style={styles.small} numberOfLines={1}>{selectedProduct.tastingNotes}</Text>}
              </View>

              <View style={[styles.between, { alignItems: 'flex-start', marginTop: 22, marginBottom: 10 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 2 }]}>구매 이력</Text>
                  <Text style={styles.small}>기본은 최근 구매순입니다. 신선도순으로 바꿔 소비 우선순위를 볼 수 있습니다.</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                  {lotSortOptions.map(option => (
                    <Chip key={option.value} label={option.label} selected={selectedLotSort === option.value} colors={colors} onPress={() => setSelectedLotSort(option.value)} />
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity style={styles.ghostButton} onPress={() => setQuickAddOpen(prev => !prev)}>
                  <MaterialIcons name={quickAddOpen ? 'keyboard-arrow-up' : 'bolt'} size={18} color={colors.text} />
                  <Text style={styles.ghostText}>{quickAddOpen ? '빠른 추가 닫기' : '빠른 구매 추가'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => openLotEditor(null)}>
                  <MaterialIcons name="add-shopping-cart" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>상세 구매분 추가</Text>
                </TouchableOpacity>
              </View>

              {selectedRecommendedLot && selectedFreshness && (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceAlt, padding: 10, gap: 8, marginBottom: 10 }}>
                  <View style={styles.between}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>
                        추천: {purchaseNumberForLot(selectedLots, selectedRecommendedLot)}번째 구매 · {lotStatusLabel[selectedRecommendedLot.lotStatus]} · 남은 양 {remainingText(selectedRecommendedLot, logs)}
                      </Text>
                      <Text style={styles.small} numberOfLines={1}>{selectedFreshness.compactMeta} · 기록 {selectedRecommendedLotLogs.length}회</Text>
                    </View>
                    <FreshnessBadge freshness={selectedFreshness} colors={colors} compact />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {selectedRecommendedLot.lotStatus === 'open' && (
                      <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, borderColor: colors.primary }]} onPress={logWithCurrentLot}>
                        <MaterialIcons name="edit-note" size={16} color={colors.primary} />
                        <Text style={[styles.ghostText, { color: colors.primary }]}>추천으로 기록</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.ghostButton, { minHeight: 34 }]} onPress={() => duplicatePurchaseLot(selectedRecommendedLot)}>
                      <MaterialIcons name="content-copy" size={16} color={colors.text} />
                      <Text style={styles.ghostText}>복제해서 추가</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {quickAddOpen && (
                <>
                  <Text style={styles.sectionTitle}>빠른 구매분 추가</Text>
                  <QuickPurchaseLotWidget
                    colors={colors}
                    purchaseDate={quickLotDates.purchaseDate}
                    roastDate={quickLotDates.roastDate}
                    onOpenDate={openQuickDatePicker}
                    onClearDate={clearQuickLotDate}
                    onResetDates={resetQuickLotDates}
                    onCancel={closeQuickAdd}
                    onCreate={saveQuickPurchaseLot}
                  />
                </>
              )}

              {selectedLots.length === 0 ? (
                <View style={styles.card}><Text style={styles.subtitle}>아직 구매 이력이 없습니다. 먹고 싶은 원두라면 이 상태로 두고, 구매 후 구매분을 추가하세요.</Text></View>
              ) : selectedActiveLotsForDisplay.length === 0 ? (
                <View style={styles.card}><Text style={styles.subtitle}>보유 중인 구매분이 없습니다. 소진/보관 구매분은 구매 이력 전체 보기에서 확인할 수 있습니다.</Text></View>
              ) : selectedActiveLotsForDisplay.slice(0, 4).map(lot => (
                <PurchaseLotCompactRow
                  key={lot.id}
                  lot={lot}
                  lotNumber={purchaseNumberForLot(selectedLots, lot)}
                  product={selectedProduct}
                  colors={colors}
                  logs={logs}
                  onDetail={() => setDetailLot(lot)}
                  onLog={() => logWithPurchaseLot(lot)}
                  onEdit={() => openLotEditor(lot)}
                  onDuplicate={() => duplicatePurchaseLot(lot)}
                />
              ))}
              {selectedLots.length > Math.min(selectedActiveLotsForDisplay.length, 4) && (
                <TouchableOpacity style={styles.ghostButton} onPress={() => setLotHistoryOpen(true)}>
                  <Text style={styles.ghostText}>구매 이력 전체 보기 ({selectedLots.length})</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.sectionTitle}>추출 히스토리</Text>
              {selectedRecommendedLot && <RecommendationCard recommendation={recommendation} colors={colors} />}
              <View style={{ height: 10 }} />
              {selectedLotLogs.slice(0, 3).map(log => <LogSummary key={log.id} log={log} colors={colors} />)}
              {selectedLotLogs.length > 3 && (
                <TouchableOpacity style={styles.ghostButton} onPress={() => setBrewHistoryOpen(true)}>
                  <Text style={styles.ghostText}>추출 히스토리 전체 보기 ({selectedLotLogs.length})</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {editorMode === 'product' && (
            <View style={[styles.card, { gap: 12 }]}>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900' }}>{editingProduct ? '제품 정보 편집' : '새 원두 제품'}</Text>
              <Text style={styles.subtitle}>여기는 원두 자체의 정보만 저장합니다. 사진으로 제품 정보를 읽고, 날짜/중량은 첫 구매분 후보로만 분리합니다.</Text>
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 10 }}>
                <View style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>사진으로 시작</Text>
                    <Text style={styles.small}>여러 장을 추가하면 우선순위 높은 4장까지 AI가 읽습니다.</Text>
                  </View>
                  <TouchableOpacity style={styles.button} disabled={busy || pendingPhotos.length === 0} onPress={analyzePhotos}>
                    <Text style={styles.buttonText}>{busy ? '분석 중...' : 'AI로 제품 정보 읽기'}</Text>
                  </TouchableOpacity>
                </View>
                {photoOptions.map(option => (
                  <View key={option.type} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 }}>
                    <View style={styles.between}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '900' }}>{option.title}</Text>
                        <Text style={styles.small}>{option.subtitle}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                        <TouchableOpacity style={styles.ghostButton} onPress={() => pickPhoto(true, option.type)}>
                          <MaterialIcons name="photo-camera" size={18} color={colors.text} />
                          <Text style={styles.ghostText}>촬영</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostButton} onPress={() => pickPhoto(false, option.type)}>
                          <MaterialIcons name="photo-library" size={18} color={colors.text} />
                          <Text style={styles.ghostText}>선택</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
                <PhotoGrid title="선택한 사진" photos={pendingPhotos.map(photo => ({ uri: photo.uri, type: photo.type }))} colors={colors} onOpen={setPreviewUri} onDelete={deletePendingPhoto} />
                {analysis && (
                  <View style={{ backgroundColor: colors.surface, borderRadius: 8, padding: 12, gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>AI 분석 리뷰</Text>
                    <Text style={styles.small}>제품: {analysis.bean_name ?? '-'} · {analysis.roastery ?? '-'} · {analysis.origin ?? analysis.process ?? '-'}</Text>
                    <Text style={styles.small}>첫 구매분 후보: 구매 {analysis.purchase_date ?? '-'} · 로스팅 {analysis.roast_date ?? '-'} · 유통 {analysis.expiry_date ?? '-'} · 중량 {analysis.initial_weight_gram ?? analysis.weight ?? '-'}</Text>
                    {!!analysis.warnings?.length && <Text style={{ color: colors.danger, fontWeight: '800' }}>{analysis.warnings.join(', ')}</Text>}
                    {!!analysis.unknown_dates?.length && <Text style={styles.small}>애매한 날짜: {analysis.unknown_dates.map(item => item.rawText).join(', ')}</Text>}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <TouchableOpacity style={styles.button} onPress={() => applyProductAnalysis(false)}><Text style={styles.buttonText}>제품 정보만 적용</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.ghostButton} onPress={() => { applyProductAnalysis(false); applyLotCandidate(false); }}><Text style={styles.ghostText}>첫 구매분 후보도 적용</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.ghostButton} onPress={() => { applyProductAnalysis(true); applyLotCandidate(true); }}><Text style={styles.ghostText}>값 교체</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Field label="제품명 *" value={productForm.name} onChangeText={v => setProductForm(prev => ({ ...prev, name: v }))} colors={colors} />
                <Field label="로스터리" value={productForm.roastery} onChangeText={v => setProductForm(prev => ({ ...prev, roastery: v }))} colors={colors} />
                <Field label="산지" value={productForm.origin} onChangeText={v => setProductForm(prev => ({ ...prev, origin: v }))} colors={colors} />
                <Field label="품종" value={productForm.variety} onChangeText={v => setProductForm(prev => ({ ...prev, variety: v }))} colors={colors} />
                <Field label="가공" value={productForm.process} onChangeText={v => setProductForm(prev => ({ ...prev, process: v }))} colors={colors} />
                <Field label="배전도" value={productForm.roastLevel} onChangeText={v => setProductForm(prev => ({ ...prev, roastLevel: v }))} colors={colors} />
                <Field label="테이스팅 노트" value={productForm.tastingNotes} onChangeText={v => setProductForm(prev => ({ ...prev, tastingNotes: v }))} colors={colors} multiline />
                <Field label="메모" value={productForm.memo} onChangeText={v => setProductForm(prev => ({ ...prev, memo: v }))} colors={colors} multiline />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['normal', 'wishlist', 'archived'] as CoffeeProductUserStatus[]).map(status => (
                  <Chip key={status} label={status === 'normal' ? '일반' : status === 'wishlist' ? '먹고 싶은 원두' : '보관/숨김'} selected={productForm.userStatus === status} colors={colors} onPress={() => setProductForm(prev => ({ ...prev, userStatus: status }))} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={styles.button} onPress={saveProduct}><Text style={styles.buttonText}>제품 저장</Text></TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => { setEditingProductId(null); setEditorMode('none'); }}><Text style={styles.ghostText}>취소</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {editorMode === 'lot' && selectedProduct && (
            <View style={[styles.card, { gap: 12 }]}>
              <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900' }}>{lotForm.id ? '구매분 편집' : '구매분 추가'}</Text>
              <Text style={styles.subtitle}>이 영역은 구매 이력만 저장합니다. AI 분석도 제품 정보를 덮어쓰지 않고 날짜와 구매 정보를 우선 채웁니다.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={styles.ghostButton} onPress={() => pickPhoto(true, 'bean_label')}><MaterialIcons name="photo-camera" size={18} color={colors.text} /><Text style={styles.ghostText}>촬영</Text></TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => pickPhoto(false, 'roast_date_label')}><MaterialIcons name="photo-library" size={18} color={colors.text} /><Text style={styles.ghostText}>사진 선택</Text></TouchableOpacity>
                <TouchableOpacity style={styles.button} disabled={busy} onPress={analyzePhotos}><Text style={styles.buttonText}>{busy ? '분석 중...' : 'AI로 구매분 읽기'}</Text></TouchableOpacity>
              </View>
              {pendingPhotos.length > 0 && (
                <PhotoGrid title="저장 전 사진" photos={pendingPhotos.map(photo => ({ uri: photo.uri, type: photo.type }))} colors={colors} onOpen={setPreviewUri} onDelete={deletePendingPhoto} />
              )}
              {lotForm.id && (
                <PhotoGrid
                  title="저장된 사진"
                  photos={(photosByBean[lotForm.id] ?? []).map(photo => ({ uri: photo.photoUri, type: photo.photoType, id: photo.id, saved: true }))}
                  colors={colors}
                  onOpen={setPreviewUri}
                  onDelete={photo => deleteSavedPhoto(lotForm.id, photo.id)}
                />
              )}
              {analysis && (
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>AI 분석 리뷰</Text>
                  <Text style={styles.small}>구매일 {analysis.purchase_date ?? '-'} · 로스팅일 {analysis.roast_date ?? '-'} · 유통기한 {analysis.expiry_date ?? '-'} · 중량 {analysis.initial_weight_gram ?? analysis.weight ?? '-'}</Text>
                  {!!analysis.warnings?.length && <Text style={{ color: colors.danger, fontWeight: '800' }}>{analysis.warnings.join(', ')}</Text>}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <TouchableOpacity style={styles.button} onPress={() => applyAnalysis(false)}><Text style={styles.buttonText}>빈 칸에 적용</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.ghostButton} onPress={() => applyAnalysis(true)}><Text style={styles.ghostText}>값 교체</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {([
                  ['purchaseDate', '구매일'],
                  ['roastDate', '로스팅일'],
                  ['openedDate', '개봉일'],
                  ['expiryDate', '유통기한'],
                ] as Array<[LotDateKey, string]>).map(([key, label]) => (
                  <DateFieldCard
                    key={key}
                    label={label}
                    value={lotForm[key]}
                    colors={colors}
                    error={dateErrorText(lotForm[key])}
                    helper={datePreviewText(lotForm[key])}
                    onPress={() => openDatePicker(key)}
                    onClear={() => clearLotDate(key)}
                    onToday={key === 'openedDate' ? () => setLotDate('openedDate', todayDate()) : undefined}
                  />
                ))}
                <Field label="구매처" value={lotForm.seller} onChangeText={v => setLotForm(prev => ({ ...prev, seller: v }))} colors={colors} />
                <Field label="가격" value={lotForm.price} onChangeText={v => setLotForm(prev => ({ ...prev, price: v }))} colors={colors} keyboardType="numeric" />
                <Field label="시작 중량 g" value={lotForm.initialWeightGram} onChangeText={v => setLotForm(prev => ({ ...prev, initialWeightGram: v }))} colors={colors} keyboardType="numeric" />
                <Field label="남은 양 보정 g" value={lotForm.remainingWeightGram} onChangeText={v => setLotForm(prev => ({ ...prev, remainingWeightGram: v }))} colors={colors} keyboardType="numeric" />
                <Field label="보관 방식" value={lotForm.storageType} onChangeText={v => setLotForm(prev => ({ ...prev, storageType: v }))} colors={colors} />
                <Field label="구매분 메모" value={lotForm.lotMemo} onChangeText={v => setLotForm(prev => ({ ...prev, lotMemo: v }))} colors={colors} multiline />
              </View>
              <Text style={styles.small}>남은 양 보정은 현재 봉투 잔량을 맞추고, 이후 이 구매분의 기록 도징량만큼 자동 차감합니다. 빈 값이면 시작 중량에서 기록 사용량을 빼서 계산합니다.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(['unopened', 'open', 'finished', 'archived'] as BeanLotStatus[]).map(status => (
                  <Chip key={status} label={lotStatusLabel[status]} selected={lotForm.lotStatus === status} colors={colors} onPress={() => setLotForm(prev => ({ ...prev, lotStatus: status }))} />
                ))}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <TouchableOpacity style={styles.button} onPress={saveLot}><Text style={styles.buttonText}>구매분 저장</Text></TouchableOpacity>
                <TouchableOpacity style={styles.ghostButton} onPress={() => setEditorMode('none')}><Text style={styles.ghostText}>취소</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {editorMode === 'none' && !selectedProduct && (
            <View style={styles.card}>
              <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>원두 제품을 선택하세요</Text>
              <Text style={styles.subtitle}>제품은 원두 자체, 구매분은 이력입니다. 새 제품을 만들고 나중에 구매분을 추가할 수 있습니다.</Text>
            </View>
          )}
        </View>
      </View>
      <BottomSheetModal
        visible={balanceAdjustLot != null}
        title="현재 남은 양 설정"
        subtitle="현재 봉투에 남은 양을 맞춥니다. 이후 이 구매분 기록은 이 값에서 자동 차감됩니다."
        colors={colors}
        onClose={() => setBalanceAdjustLot(null)}
      >
        {balanceAdjustLot ? (
          <View style={{ gap: 12 }}>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 5 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>{coffeeProducts.find(product => product.id === balanceAdjustLot.productId)?.name ?? '원두'}</Text>
              <Text style={styles.small}>현재 표시 남은 양 {remainingText(balanceAdjustLot, logs)} · 시작 중량 {balanceAdjustLot.initialWeightGram == null ? '-' : `${balanceAdjustLot.initialWeightGram}g`}</Text>
            </View>
            <Field
              label="현재 남은 양 g"
              value={balanceAdjustDraft}
              onChangeText={setBalanceAdjustDraft}
              colors={colors}
              keyboardType="numeric"
            />
            <Text style={styles.small}>비워두면 수동 보정을 해제하고, 시작 중량에서 기록 사용량을 뺀 값으로 다시 계산합니다.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <TouchableOpacity style={styles.button} onPress={saveBalanceAdjustment}>
                <MaterialIcons name="save" size={18} color="#fff" />
                <Text style={styles.buttonText}>보정 저장</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setBalanceAdjustDraft('')}>
                <Text style={styles.ghostText}>수동 보정 해제</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : <Text style={styles.subtitle}>보정할 구매분이 없습니다.</Text>}
      </BottomSheetModal>
      <BottomSheetModal
        visible={filterSheetOpen}
        title="정렬과 고급 필터"
        subtitle="기본 목록은 짧게 두고, 덜 자주 쓰는 조건은 여기에서 바꿉니다."
        colors={colors}
        onClose={() => setFilterSheetOpen(false)}
      >
        <Text style={styles.label}>상태</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {filterOptions.map(option => <Chip key={option.value} label={option.label} selected={filter === option.value} colors={colors} onPress={() => setFilter(option.value)} />)}
        </View>
        <Text style={styles.label}>정렬</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sortOptions.map(option => <Chip key={option.value} label={option.label} selected={sort === option.value} colors={colors} onPress={() => setSort(option.value)} />)}
        </View>
      </BottomSheetModal>
      <BottomSheetModal
        visible={datePickerField != null}
        title={datePickerField ? `${dateFieldLabels[datePickerField]} 선택` : '날짜 선택'}
        subtitle="타이핑 대신 달력이나 빠른 버튼으로 날짜를 넣습니다."
        colors={colors}
        onClose={() => setDatePickerField(null)}
      >
        {datePickerField && (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['오늘', todayDate()],
                ['어제', addDays(todayDate(), -1)],
                ['비우기', ''],
              ].map(([label, value]) => (
                <TouchableOpacity
                  key={label}
                  style={label === '비우기' ? styles.ghostButton : styles.button}
                  onPress={() => {
                    if (value) setLotDate(datePickerField, value);
                    else clearLotDate(datePickerField);
                    setDatePickerField(null);
                  }}
                >
                  <Text style={label === '비우기' ? styles.ghostText : styles.buttonText}>{label}</Text>
                </TouchableOpacity>
              ))}
              {datePickerField === 'expiryDate' && isValidDateString(lotForm.roastDate) && (
                <>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => { setLotDate('expiryDate', addDays(lotForm.roastDate, 30)); setDatePickerField(null); }}>
                    <Text style={styles.ghostText}>로스팅 +30일</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => { setLotDate('expiryDate', addDays(lotForm.roastDate, 60)); setDatePickerField(null); }}>
                    <Text style={styles.ghostText}>로스팅 +60일</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View style={styles.between}>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setCalendarMonth(prev => addMonths(prev, -1))}>
                <MaterialIcons name="chevron-left" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{formatMonthKorean(calendarMonth)}</Text>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setCalendarMonth(prev => addMonths(prev, 1))}>
                <MaterialIcons name="chevron-right" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <Text key={day} style={{ flex: 1, color: colors.textSecondary, textAlign: 'center', fontWeight: '900' }}>{day}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {calendarCells(calendarMonth).map((date, index) => {
                const selected = date != null && normalizeDateInput(lotForm[datePickerField]).value === date;
                const today = date === todayDate();
                return (
                  <View key={`${date ?? 'empty'}-${index}`} style={{ width: `${100 / 7}%`, padding: 3 }}>
                    {date ? (
                      <TouchableOpacity
                        style={{
                          height: 42,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? colors.primary : today ? colors.badge : colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: selected || today ? colors.primary : colors.border,
                        }}
                        onPress={() => {
                          setLotDate(datePickerField, date);
                          setDatePickerField(null);
                        }}
                      >
                        <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '900' }}>{Number(date.slice(-2))}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ height: 42 }} />
                    )}
                  </View>
                );
              })}
            </View>
            <Text style={styles.small}>AI가 읽은 날짜도 저장 전에 같은 형식으로 정리됩니다.</Text>
          </View>
        )}
      </BottomSheetModal>
      <BottomSheetModal
        visible={quickDatePickerField != null}
        title={quickDatePickerField ? `빠른 구매분 ${quickDateFieldLabels[quickDatePickerField]} 선택` : '날짜 선택'}
        subtitle="타이핑 없이 달력과 빠른 버튼으로 날짜를 넣습니다."
        colors={colors}
        onClose={() => setQuickDatePickerField(null)}
      >
        {quickDatePickerField && (
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                ['오늘', todayDate()],
                ['어제', addDays(todayDate(), -1)],
                ['비우기', ''],
              ].map(([label, value]) => (
                <TouchableOpacity
                  key={label}
                  style={label === '비우기' ? styles.ghostButton : styles.button}
                  onPress={() => {
                    if (value) setQuickLotDate(quickDatePickerField, value);
                    else clearQuickLotDate(quickDatePickerField);
                    setQuickDatePickerField(null);
                  }}
                >
                  <Text style={label === '비우기' ? styles.ghostText : styles.buttonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.between}>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setQuickCalendarMonth(prev => addMonths(prev, -1))}>
                <MaterialIcons name="chevron-left" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{formatMonthKorean(quickCalendarMonth)}</Text>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setQuickCalendarMonth(prev => addMonths(prev, 1))}>
                <MaterialIcons name="chevron-right" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                <Text key={day} style={{ flex: 1, color: colors.textSecondary, textAlign: 'center', fontWeight: '900' }}>{day}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {calendarCells(quickCalendarMonth).map((date, index) => {
                const selected = date != null && normalizeDateInput(quickLotDates[quickDatePickerField]).value === date;
                const today = date === todayDate();
                return (
                  <View key={`${date ?? 'quick-empty'}-${index}`} style={{ width: `${100 / 7}%`, padding: 3 }}>
                    {date ? (
                      <TouchableOpacity
                        style={{
                          height: 42,
                          borderRadius: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? colors.primary : today ? colors.badge : colors.surfaceAlt,
                          borderWidth: 1,
                          borderColor: selected || today ? colors.primary : colors.border,
                        }}
                        onPress={() => {
                          setQuickLotDate(quickDatePickerField, date);
                          setQuickDatePickerField(null);
                        }}
                      >
                        <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '900' }}>{Number(date.slice(-2))}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ height: 42 }} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </BottomSheetModal>
      <BottomSheetModal visible={productInfoOpen} title="원두 전체 정보" subtitle="긴 제품 정보와 라벨에서 읽은 내용을 여기서 확인합니다." colors={colors} onClose={() => setProductInfoOpen(false)}>
        {selectedProduct ? (
          <View style={{ gap: 10 }}>
            {[
              ['제품명', selectedProduct.name],
              ['로스터리', selectedProduct.roastery || '-'],
              ['산지', selectedProduct.origin || '-'],
              ['품종', selectedProduct.variety || '-'],
              ['가공', selectedProduct.process || '-'],
              ['배전도', selectedProduct.roastLevel || '-'],
              ['테이스팅 노트', selectedProduct.tastingNotes || '-'],
              ['메모', selectedProduct.memo || '-'],
            ].map(([label, value]) => (
              <View key={label} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
                <Text style={styles.small}>{label}</Text>
                <Text style={{ color: colors.text, fontWeight: '800', marginTop: 3 }}>{value}</Text>
              </View>
            ))}
          </View>
        ) : <Text style={styles.subtitle}>선택된 원두가 없습니다.</Text>}
      </BottomSheetModal>
      <BottomSheetModal visible={productActionsOpen} title="원두 더보기" subtitle="자주 쓰지 않는 AI/복제 작업은 여기에서 실행합니다." colors={colors} onClose={() => setProductActionsOpen(false)}>
        <View style={{ gap: 10 }}>
          <TouchableOpacity style={styles.ghostButton} onPress={() => { setProductActionsOpen(false); void copyProductForAi(); }}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.text} />
            <Text style={styles.ghostText}>AI용 정보 복사</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => { setProductActionsOpen(false); void cloneBestLog(); }}>
            <MaterialIcons name="content-copy" size={18} color={colors.text} />
            <Text style={styles.ghostText}>좋았던 기록 복제</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostButton} onPress={() => { setProductActionsOpen(false); setBrewHistoryOpen(true); }}>
            <MaterialIcons name="history" size={18} color={colors.text} />
            <Text style={styles.ghostText}>추출 히스토리 전체 보기</Text>
          </TouchableOpacity>
          {!!selectedProduct && (
            <TouchableOpacity style={styles.ghostButton} onPress={() => void setSelectedProductStatus(selectedProduct.userStatus === 'archived' ? 'normal' : 'archived')}>
              <MaterialIcons name={selectedProduct.userStatus === 'archived' ? 'unarchive' : 'archive'} size={18} color={colors.text} />
              <Text style={styles.ghostText}>{selectedProduct.userStatus === 'archived' ? '기본 목록으로 복원' : '보관/숨김'}</Text>
            </TouchableOpacity>
          )}
          {!!selectedProduct && (
            <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger }]} onPress={deleteSelectedProduct}>
              <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
              <Text style={[styles.ghostText, { color: colors.danger }]}>제품 완전 삭제</Text>
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetModal>
      <BottomSheetModal visible={lotHistoryOpen} title="구매 이력 전체" subtitle="핵심 날짜와 상태만 빠르게 확인합니다. 사진과 메모는 상세에서 봅니다." colors={colors} onClose={() => setLotHistoryOpen(false)}>
        <Text style={styles.label}>상태</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {([
            ['active', '보유 중'],
            ['open', '개봉'],
            ['unopened', '미개봉'],
            ['all', '전체'],
          ] as Array<[typeof lotHistoryFilter, string]>).map(([value, label]) => (
            <Chip key={value} label={label} selected={lotHistoryFilter === value} colors={colors} onPress={() => setLotHistoryFilter(value)} />
          ))}
        </View>
        <Text style={styles.label}>정렬</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {lotSortOptions.map(option => (
            <Chip key={option.value} label={option.label} selected={selectedLotSort === option.value} colors={colors} onPress={() => setSelectedLotSort(option.value)} />
          ))}
        </View>
        {selectedProduct && visibleHistoryLots.map(lot => (
          <PurchaseLotCompactRow
            key={lot.id}
            lot={lot}
            lotNumber={purchaseNumberForLot(selectedLots, lot)}
            product={selectedProduct}
            colors={colors}
            logs={logs}
            onDetail={() => setDetailLot(lot)}
            onLog={() => logWithPurchaseLot(lot)}
            onEdit={() => { setLotHistoryOpen(false); openLotEditor(lot); }}
            onDuplicate={() => duplicatePurchaseLot(lot)}
          />
        ))}
        {visibleHistoryLots.length === 0 && <Text style={styles.subtitle}>현재 필터에 해당하는 구매 이력이 없습니다.</Text>}
      </BottomSheetModal>
      <BottomSheetModal
        visible={detailLot != null}
        title="구매분 상세"
        subtitle="사진, 날짜, 구매 정보, 메모를 한 번에 확인합니다."
        colors={colors}
        onClose={() => setDetailLot(null)}
      >
        {detailLot ? (() => {
          const productForDetail = coffeeProducts.find(product => product.id === detailLot.productId) ?? selectedProduct;
          if (!productForDetail) return <Text style={styles.subtitle}>선택된 원두 제품이 없습니다.</Text>;
          const detailProductLots = purchaseLots.filter(lot => lot.productId === productForDetail.id);
          const beanLike = lotToBean(productForDetail, detailLot);
          const fresh = getFreshnessInfo(beanLike);
          const lotLogs = logs.filter(log => (log.purchaseLotId ?? log.beanId) === detailLot.id);
          const lotPhotos = photosByBean[detailLot.id] ?? [];
          const displayPhotos = lotPhotos.length ? lotPhotos.map(photo => ({ uri: photo.photoUri, type: photo.photoType, id: photo.id, saved: true })) : detailLot.mainPhotoUri ? [{ uri: detailLot.mainPhotoUri, type: 'bean_label', saved: true }] : [];
          const lotIndex = purchaseNumberForLot(detailProductLots, detailLot);
          return (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{lotIndex || 1}번째 구매 · {lotStatusLabel[detailLot.lotStatus]}</Text>
                  <Text style={styles.subtitle}>{productForDetail.name} · {productForDetail.roastery || '로스터리 미입력'}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.button, { flex: 1, opacity: detailLot.lotStatus === 'open' ? 1 : 0.65 }]} onPress={() => logWithPurchaseLot(detailLot)}>
                    <MaterialIcons name="edit-note" size={18} color="#fff" />
                    <Text style={styles.buttonText}>기록</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { flex: 1 }]} onPress={() => { setDetailLot(null); setLotHistoryOpen(false); openBalanceAdjustment(detailLot); }}>
                    <MaterialIcons name="scale" size={18} color={colors.text} />
                    <Text style={styles.ghostText}>잔량 설정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { flex: 1 }]} onPress={() => setLotActionsLot(detailLot)}>
                    <MaterialIcons name="more-horiz" size={20} color={colors.text} />
                    <Text style={styles.ghostText}>더보기</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, backgroundColor: colors.surfaceAlt, gap: 5 }}>
                <View style={styles.between}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>신선도</Text>
                  <FreshnessBadge freshness={fresh} colors={colors} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{fresh.compactMeta}</Text>
                <Text style={styles.small}>{fresh.detail} {fresh.actionText}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['남은 양', remainingText(detailLot, logs)],
                  ['추출 기록', `${lotLogs.length}회`],
                  ['보관', detailLot.storageType ?? '-'],
                ].map(([label, value]) => <MetricChip key={label} label={label} value={value} colors={colors} />)}
              </View>
              <LotStatusActionBar lot={detailLot} colors={colors} onChangeStatus={status => changeLotStatus(detailLot, status)} />
              <View style={{ gap: 8 }}>
                {[
                  ['구매일', detailLot.purchaseDate ?? '-'],
                  ['로스팅일', detailLot.roastDate ?? '-'],
                  ['개봉일', detailLot.openedDate ?? '-'],
                  ['유통기한', detailLot.expiryDate ?? '-'],
                  ['구매처', detailLot.seller ?? '-'],
                  ['가격', detailLot.price == null ? '-' : `${detailLot.price}`],
                  ['시작 중량', detailLot.initialWeightGram == null ? '-' : `${detailLot.initialWeightGram}g`],
                  ['남은 양 보정', detailLot.remainingWeightGram == null ? '-' : `${detailLot.remainingWeightGram}g`],
                  ['메모', detailLot.lotMemo ?? '-'],
                ].map(([label, value]) => (
                  <View key={label} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 8 }}>
                    <Text style={styles.small}>{label}</Text>
                    <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>{value}</Text>
                  </View>
                ))}
              </View>
              <PhotoGrid title="저장된 사진" photos={displayPhotos} colors={colors} onOpen={setPreviewUri} />
            </View>
          );
        })() : <Text style={styles.subtitle}>선택된 구매분이 없습니다.</Text>}
      </BottomSheetModal>
      <BottomSheetModal visible={lotActionsLot != null} title="구매분 더보기" subtitle="AI 조언과 구매분 관리를 실행합니다." colors={colors} onClose={() => setLotActionsLot(null)}>
        {lotActionsLot ? (
          <View style={{ gap: 14 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>AI</Text>
              <Text style={styles.small}>구매분 정보, 잔량, 최근 기록 기준</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LotMoreActionButton label="복사" icon="content-copy" colors={colors} onPress={() => void copyLotForAi(lotActionsLot)} />
                <LotMoreActionButton label="ChatGPT" icon="chat" colors={colors} onPress={() => void copyLotForAi(lotActionsLot, 'chatgpt')} />
                <LotMoreActionButton label="Gemini" icon="diamond" colors={colors} onPress={() => void copyLotForAi(lotActionsLot, 'gemini')} />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>관리</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LotMoreActionButton label="수정" icon="edit" colors={colors} onPress={() => { const lot = lotActionsLot; setLotActionsLot(null); setDetailLot(null); setLotHistoryOpen(false); openLotEditor(lot); }} />
                <LotMoreActionButton label="복제" icon="content-copy" colors={colors} onPress={() => { const lot = lotActionsLot; setLotActionsLot(null); duplicatePurchaseLot(lot); }} />
                <LotMoreActionButton label="삭제" icon="delete-outline" colors={colors} destructive onPress={() => { const lot = lotActionsLot; setLotActionsLot(null); deletePurchaseLot(lot); }} />
              </View>
            </View>
          </View>
        ) : <Text style={styles.subtitle}>선택된 구매분이 없습니다.</Text>}
      </BottomSheetModal>
      <BottomSheetModal visible={brewHistoryOpen} title="추출 히스토리 전체" colors={colors} onClose={() => setBrewHistoryOpen(false)}>
        {selectedLotLogs.map(log => <LogSummary key={log.id} log={log} colors={colors} />)}
        {selectedLotLogs.length === 0 && <Text style={styles.subtitle}>아직 추출 기록이 없습니다.</Text>}
      </BottomSheetModal>
    </ScrollView>
  );
}
