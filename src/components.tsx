import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlossaryId, getGlossaryEntry, shouldShowGlossaryHelp } from './constants/glossary';
import { ThemeColors, spacing } from './constants/theme';
import { Bean, BeanLotStatus, BrewLog, CoffeeProduct, CoffeePurchaseLot, RecordingMode } from './types/models';
import { beanStatus, formatSeconds } from './utils';
import { DialInRecommendation } from './services/recommendation';
import { getFreshnessInfo } from './services/beanInventory';
import type { FreshnessInfo } from './services/beanInventory';
import { useSettingsStore } from './store/settingsStore';
import { useCoffeeStore } from './store/coffeeStore';

export const createCommonStyles = (colors: ThemeColors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.page, paddingTop: 58, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 15, marginTop: 4 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: spacing.radius, padding: spacing.card },
  input: { color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, minHeight: 46 },
  label: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 5 },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, flexDirection: 'row', gap: 6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ghostButton: { minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, flexDirection: 'row', gap: 6 },
  ghostText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  small: { color: colors.textSecondary, fontSize: 13 },
});

export function Field(props: { label: string; value: string; onChangeText: (v: string) => void; colors: ThemeColors; placeholder?: string; keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType']; multiline?: boolean; error?: string | null; helper?: string | null; glossaryId?: GlossaryId; glossaryIds?: GlossaryId[]; recordingMode?: RecordingMode }) {
  const styles = createCommonStyles(props.colors);
  return (
    <View style={{ flex: 1, minWidth: 150, marginBottom: 10 }}>
      <TermLabel label={props.label} glossaryId={props.glossaryId} glossaryIds={props.glossaryIds} recordingMode={props.recordingMode} colors={props.colors} />
      <TextInput
        style={[styles.input, props.error && { borderColor: props.colors.danger }, props.multiline && { minHeight: 82, textAlignVertical: 'top' }]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={props.colors.textTertiary}
        keyboardType={props.keyboardType}
        multiline={props.multiline}
      />
      {!!props.error && <Text style={styles.error}>{props.error}</Text>}
      {!props.error && !!props.helper && <Text style={styles.small}>{props.helper}</Text>}
    </View>
  );
}

export function BeanCard({ bean, colors, selected, onPress }: { bean: Bean; colors: ThemeColors; selected?: boolean; onPress: () => void }) {
  const styles = createCommonStyles(colors);
  return (
    <TouchableOpacity onPress={onPress} style={[styles.card, { marginBottom: 10, borderColor: selected ? colors.primary : colors.border }]}>
      <View style={styles.row}>
        {bean.mainPhotoUri ? <Image source={{ uri: bean.mainPhotoUri }} style={{ width: 58, height: 58, borderRadius: 8 }} /> : <View style={{ width: 58, height: 58, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><IoniconsFallback colors={colors} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }} numberOfLines={1}>{bean.name}</Text>
          <Text style={styles.small} numberOfLines={1}>{bean.roastery || '로스터리 미입력'}</Text>
          <Text style={[styles.small, { color: colors.primary, marginTop: 3 }]}>{beanStatus(bean.expiryDate, bean.openedDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function BottomSheetModal({
  visible,
  title,
  subtitle,
  colors,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  colors: ThemeColors;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const styles = createCommonStyles(colors);
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 24);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 18 + bottomInset, borderWidth: 1, borderColor: colors.border }}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity accessibilityLabel={`${title} 닫기`} style={styles.ghostButton} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const resourceSourceIcon = (sourceType?: string | null) => {
  if (sourceType === 'youtube') return 'smart-display';
  if (sourceType === 'manual') return 'menu-book';
  if (sourceType === 'official') return 'verified';
  if (sourceType === 'community') return 'forum';
  return 'link';
};

const normalizeResourceText = (value?: string | null) => (value ?? '').toLowerCase();

const openResourceUrl = async (url: string) => {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const supported = await Linking.canOpenURL(target);
  if (!supported) {
    Alert.alert('링크 열기 실패', '이 자료 링크를 열 수 없습니다.');
    return;
  }
  await Linking.openURL(target);
};

export function GlossaryBottomSheet({
  visible,
  glossaryIds,
  colors,
  onClose,
}: {
  visible: boolean;
  glossaryIds: GlossaryId[];
  colors: ThemeColors;
  onClose: () => void;
}) {
  const styles = createCommonStyles(colors);
  const entries = glossaryIds.map(getGlossaryEntry).filter(Boolean);
  const resourceGroups = useCoffeeStore(s => s.resourceGroups);
  const resourceLinks = useCoffeeStore(s => s.resourceLinks);
  const relatedResources = useMemo(() => {
    const keywords = [...new Set(entries.flatMap(entry => entry.relatedResourceTags ?? []))]
      .map(keyword => normalizeResourceText(keyword))
      .filter(Boolean);
    if (keywords.length === 0) return [];
    return resourceLinks
      .map(link => {
        const group = resourceGroups.find(item => item.id === link.groupId);
        const haystack = normalizeResourceText([link.title, link.tag, link.memo, link.url, group?.name, group?.memo].filter(Boolean).join(' '));
        const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(keyword) ? 1 : 0), 0);
        return { link, group, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const sourceRank = (source?: string | null) => source === 'official' ? 4 : source === 'manual' ? 3 : source === 'youtube' ? 2 : 1;
        return sourceRank(b.link.sourceType) - sourceRank(a.link.sourceType);
      })
      .slice(0, 4);
  }, [entries, resourceGroups, resourceLinks]);
  const title = entries.length === 1 ? entries[0].koTerm : '용어 도움말';
  const subtitle = entries.length === 1 ? entries[0].term : '기록 중 헷갈릴 수 있는 용어만 짧게 정리했습니다.';
  return (
    <BottomSheetModal visible={visible} title={title} subtitle={subtitle} colors={colors} onClose={onClose}>
      <View style={{ gap: 12 }}>
        {entries.map((entry, index) => (
          <View key={entry.id} style={{ gap: 8, paddingBottom: index === entries.length - 1 ? 0 : 12, borderBottomWidth: index === entries.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
            {entries.length > 1 && (
              <View>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{entry.koTerm}</Text>
                <Text style={styles.small}>{entry.term}</Text>
              </View>
            )}
            <Text style={{ color: colors.text, fontWeight: '900' }}>{entry.shortDefinition}</Text>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10, gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>왜 중요한가</Text>
              <Text style={styles.small}>{entry.whyItMatters}</Text>
            </View>
            {!!entry.whatToRecord?.length && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>기록하면 좋은 것</Text>
                {entry.whatToRecord.map(item => <Text key={item} style={styles.small}>- {item}</Text>)}
              </View>
            )}
            {!!entry.commonMistake && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>흔한 실수</Text>
                <Text style={styles.small}>{entry.commonMistake}</Text>
              </View>
            )}
            {!!entry.bes876Note && (
              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>BES876 팁</Text>
                <Text style={styles.small}>{entry.bes876Note}</Text>
              </View>
            )}
          </View>
        ))}
        {relatedResources.length > 0 && (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>관련 자료</Text>
            <Text style={styles.small}>영상과 웹페이지는 다운로드하지 않고 링크로 엽니다.</Text>
            {relatedResources.map(({ link, group }) => (
              <TouchableOpacity
                key={link.id}
                accessibilityLabel={`${link.title} 열기`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}
                onPress={() => void openResourceUrl(link.url)}
              >
                <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={resourceSourceIcon(link.sourceType) as any} size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{link.title}</Text>
                  <Text style={styles.small} numberOfLines={1}>{group?.name ?? '자료'} · {link.sourceType ?? 'link'} · {link.publishedDate ?? '날짜 없음'}</Text>
                </View>
                <MaterialIcons name="open-in-new" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </BottomSheetModal>
  );
}

export function TermHelpIcon({
  glossaryId,
  glossaryIds,
  colors,
  recordingMode = 'guided',
  size = 18,
}: {
  glossaryId?: GlossaryId;
  glossaryIds?: GlossaryId[];
  colors: ThemeColors;
  recordingMode?: RecordingMode;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const visibility = useSettingsStore(s => s.termHelpVisibility);
  const seenGlossaryIds = useSettingsStore(s => s.seenGlossaryIds);
  const markGlossarySeen = useSettingsStore(s => s.markGlossarySeen);
  const ids = (glossaryIds ?? (glossaryId ? [glossaryId] : [])).filter(Boolean) as GlossaryId[];
  const visibleIds = ids.filter(id => shouldShowGlossaryHelp(id, recordingMode, visibility));
  if (visibleIds.length === 0) return null;
  const unseen = visibleIds.some(id => !seenGlossaryIds.includes(id));
  const label = visibleIds.length === 1 ? `${getGlossaryEntry(visibleIds[0]).koTerm} 용어 도움말` : '용어 도움말';
  return (
    <>
      <TouchableOpacity
        accessibilityLabel={label}
        accessibilityRole="button"
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: (size + 8) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: unseen ? colors.badge : 'transparent',
        }}
        onPress={() => {
          visibleIds.forEach(markGlossarySeen);
          setOpen(true);
        }}
      >
        <MaterialIcons name="help-outline" size={size} color={unseen ? colors.primary : colors.textSecondary} />
      </TouchableOpacity>
      <GlossaryBottomSheet visible={open} glossaryIds={visibleIds} colors={colors} onClose={() => setOpen(false)} />
    </>
  );
}

export function TermLabel({
  label,
  glossaryId,
  glossaryIds,
  colors,
  recordingMode = 'guided',
  textStyle,
  containerStyle,
}: {
  label: string;
  glossaryId?: GlossaryId;
  glossaryIds?: GlossaryId[];
  colors: ThemeColors;
  recordingMode?: RecordingMode;
  textStyle?: any;
  containerStyle?: any;
}) {
  const styles = createCommonStyles(colors);
  const hasGlossary = !!glossaryId || !!glossaryIds?.length;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }, containerStyle]}>
      <Text style={[styles.label, { marginBottom: 0 }, textStyle]}>{label}</Text>
      {hasGlossary && <TermHelpIcon glossaryId={glossaryId} glossaryIds={glossaryIds} colors={colors} recordingMode={recordingMode} />}
    </View>
  );
}

export function MetricChip({ label, value, colors }: { label: string; value: string | number | null | undefined; colors: ThemeColors }) {
  const styles = createCommonStyles(colors);
  return (
    <View style={{ minWidth: 92, flexGrow: 1, flexBasis: 92, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 10, backgroundColor: colors.surfaceAlt }}>
      <Text style={styles.small} numberOfLines={1}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '900', marginTop: 2 }} numberOfLines={1}>{value == null || value === '' ? '-' : value}</Text>
    </View>
  );
}

export function FreshnessBadge({ freshness, colors, compact }: { freshness: FreshnessInfo; colors: ThemeColors; compact?: boolean }) {
  const palette = {
    danger: { text: colors.danger, border: colors.danger, background: colors.surfaceAlt },
    warning: { text: colors.primaryDark, border: colors.primary, background: colors.badge },
    good: { text: colors.accent, border: colors.accent, background: colors.surfaceAlt },
    neutral: { text: colors.textSecondary, border: colors.border, background: colors.surfaceAlt },
  }[freshness.tone];
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.background,
        borderRadius: 8,
        paddingHorizontal: compact ? 7 : 9,
        paddingVertical: compact ? 4 : 6,
        flexShrink: 0,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: palette.text, fontSize: compact ? 11 : 12, fontWeight: '900' }} numberOfLines={1}>{freshness.shortLabel}</Text>
    </View>
  );
}

const widgetLotStatusLabel: Record<BeanLotStatus, string> = {
  unopened: '미개봉',
  open: '사용중',
  finished: '소진',
  archived: '보관',
};

const widgetRemainingGram = (lot: CoffeePurchaseLot, logs: BrewLog[]) => {
  const usedGram = logs
    .filter(log => (log.purchaseLotId ?? log.beanId) === lot.id)
    .reduce((sum, log) => sum + (log.actualDoseGram ?? log.doseGram ?? 0), 0);
  const calculated = lot.initialWeightGram == null ? null : Math.max(0, lot.initialWeightGram - usedGram);
  const value = lot.remainingWeightGram ?? calculated;
  return value == null ? null : Math.round(value * 10) / 10;
};

const widgetLotToBean = (lot: CoffeePurchaseLot, product?: CoffeeProduct): Bean => ({
  id: lot.id,
  productId: lot.productId,
  name: product?.name ?? '원두',
  roastery: product?.roastery ?? null,
  origin: product?.origin ?? null,
  variety: product?.variety ?? null,
  process: product?.process ?? null,
  roastLevel: product?.roastLevel ?? null,
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
  memo: product?.memo ?? lot.lotMemo,
  mainPhotoUri: lot.mainPhotoUri,
  createdAt: lot.createdAt,
  updatedAt: lot.updatedAt,
});

export function QuickBeanRegisterWidget({
  colors,
  busy,
  onCreate,
}: {
  colors: ThemeColors;
  busy?: boolean;
  onCreate: (name: string) => Promise<void> | void;
}) {
  const styles = createCommonStyles(colors);
  const [name, setName] = useState('');
  const trimmed = name.trim();
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>빠른 원두 등록</Text>
          <Text style={styles.small}>제품명만 넣고 구매분은 미개봉으로 바로 만듭니다.</Text>
        </View>
        <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="add-shopping-cart" size={21} color={colors.primary} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1, minWidth: 190 }]}
          value={name}
          onChangeText={setName}
          placeholder="원두 제품명"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (trimmed && !busy) {
              void onCreate(trimmed);
              setName('');
            }
          }}
        />
        <TouchableOpacity
          style={[styles.button, { minWidth: 92 }, (!trimmed || busy) && { opacity: 0.55 }]}
          disabled={!trimmed || busy}
          onPress={() => {
            void onCreate(trimmed);
            setName('');
          }}
        >
          <MaterialIcons name="save" size={18} color="#fff" />
          <Text style={styles.buttonText}>{busy ? '저장 중' : '저장'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function LotStatusActionBar({
  lot,
  colors,
  busy,
  onChangeStatus,
}: {
  lot: CoffeePurchaseLot;
  colors: ThemeColors;
  busy?: boolean;
  onChangeStatus: (status: BeanLotStatus) => Promise<void> | void;
}) {
  const styles = createCommonStyles(colors);
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>상태 빠른 변경</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['unopened', 'open', 'finished', 'archived'] as BeanLotStatus[]).map(status => {
          const selected = lot.lotStatus === status;
          return (
            <TouchableOpacity
              key={status}
              disabled={busy || selected}
              style={[styles.ghostButton, selected && { borderColor: colors.primary, backgroundColor: colors.badge }, busy && { opacity: 0.6 }]}
              onPress={() => void onChangeStatus(status)}
            >
              <Text style={[styles.ghostText, selected && { color: colors.primary }]}>{widgetLotStatusLabel[status]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function QuickPurchaseLotWidget({
  colors,
  busy,
  purchaseDate,
  roastDate,
  onOpenDate,
  onClearDate,
  onResetDates,
  onCancel,
  onCreate,
}: {
  colors: ThemeColors;
  busy?: boolean;
  purchaseDate: string;
  roastDate: string;
  onOpenDate: (field: 'purchaseDate' | 'roastDate') => void;
  onClearDate: (field: 'purchaseDate' | 'roastDate') => void;
  onResetDates: () => void;
  onCancel?: () => void;
  onCreate: (lot: { lotStatus: BeanLotStatus; purchaseDate: string; roastDate: string; initialWeightGram: string; seller: string }) => Promise<boolean | void> | boolean | void;
}) {
  const styles = createCommonStyles(colors);
  const [lotStatus, setLotStatus] = useState<BeanLotStatus>('unopened');
  const [initialWeightGram, setInitialWeightGram] = useState('');
  const [seller, setSeller] = useState('');
  const reset = () => {
    setLotStatus('unopened');
    setInitialWeightGram('');
    setSeller('');
    onResetDates();
  };
  const dateCard = (field: 'purchaseDate' | 'roastDate', label: string, value: string) => (
    <View style={{ flex: 1, minWidth: 150, marginBottom: 10 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => onOpenDate(field)}>
        <Text style={{ color: value ? colors.text : colors.textTertiary, fontSize: 16, fontWeight: '800' }}>{value || '날짜 선택'}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, paddingHorizontal: 9 }]} onPress={() => onOpenDate(field)}>
          <MaterialIcons name="calendar-month" size={16} color={colors.text} />
          <Text style={styles.ghostText}>달력</Text>
        </TouchableOpacity>
        {!!value && (
          <TouchableOpacity style={[styles.ghostButton, { minHeight: 34, paddingHorizontal: 9 }]} onPress={() => onClearDate(field)}>
            <Text style={styles.ghostText}>비우기</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  return (
    <View style={[styles.card, { gap: 10 }]}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>구매분 빠른 추가</Text>
          <Text style={styles.small}>상태와 핵심 구매 정보만 먼저 저장합니다.</Text>
        </View>
        {onCancel ? (
          <TouchableOpacity accessibilityLabel="빠른 구매분 추가 닫기" style={[styles.ghostButton, { width: 42, paddingHorizontal: 0 }]} onPress={onCancel}>
            <MaterialIcons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="shopping-bag" size={22} color={colors.primary} />
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['unopened', 'open', 'finished', 'archived'] as BeanLotStatus[]).map(status => (
          <TouchableOpacity key={status} style={[styles.ghostButton, lotStatus === status && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setLotStatus(status)}>
            <Text style={[styles.ghostText, lotStatus === status && { color: colors.primary }]}>{widgetLotStatusLabel[status]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {dateCard('purchaseDate', '구매일', purchaseDate)}
        {dateCard('roastDate', '로스팅일', roastDate)}
        <Field label="시작 중량 g" value={initialWeightGram} onChangeText={setInitialWeightGram} colors={colors} keyboardType="numeric" />
        <Field label="구매처" value={seller} onChangeText={setSeller} colors={colors} />
      </View>
      <TouchableOpacity
        style={[styles.button, busy && { opacity: 0.6 }]}
        disabled={busy}
        onPress={() => {
          void Promise.resolve(onCreate({ lotStatus, purchaseDate, roastDate, initialWeightGram, seller })).then(saved => {
            if (saved !== false) reset();
          });
        }}
      >
        <MaterialIcons name="save" size={18} color="#fff" />
        <Text style={styles.buttonText}>{busy ? '저장 중' : '구매분 저장'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function BeanInventoryStatusWidget({
  products,
  lots,
  logs,
  colors,
  onOpenLot,
  onEditLot,
  onFinishLot,
  onLogLot,
}: {
  products: CoffeeProduct[];
  lots: CoffeePurchaseLot[];
  logs: BrewLog[];
  colors: ThemeColors;
  onOpenLot: (lot: CoffeePurchaseLot) => void;
  onEditLot: (lot: CoffeePurchaseLot) => void;
  onFinishLot: (lot: CoffeePurchaseLot) => void;
  onLogLot: (lot: CoffeePurchaseLot) => void;
}) {
  const styles = createCommonStyles(colors);
  const productById = new Map(products.map(product => [product.id, product]));
  const openLots = lots.filter(lot => lot.lotStatus === 'open');
  const activeLots = lots.filter(lot => lot.lotStatus === 'open' || lot.lotStatus === 'unopened');
  const activeRows = activeLots.map(lot => {
    const product = productById.get(lot.productId);
    const freshness = getFreshnessInfo(widgetLotToBean(lot, product));
    return {
      lot,
      product,
      freshness,
      remaining: widgetRemainingGram(lot, logs),
      logCount: logs.filter(log => (log.purchaseLotId ?? log.beanId) === lot.id).length,
    };
  });
  const urgentLots = activeRows.filter(row => row.freshness.priority >= 82);
  const soonLots = activeRows.filter(row => row.freshness.priority >= 68 && row.freshness.priority < 82);
  const summary = [
    ['우선 소비', urgentLots.length],
    ['곧 소비', soonLots.length],
    ['미개봉', lots.filter(lot => lot.lotStatus === 'unopened').length],
    ['사용중', openLots.length],
  ];
  const rows = activeRows
    .sort((a, b) => {
      if (b.freshness.priority !== a.freshness.priority) return b.freshness.priority - a.freshness.priority;
      if (a.freshness.freshUntilDate && b.freshness.freshUntilDate) return a.freshness.freshUntilDate.localeCompare(b.freshness.freshUntilDate);
      return (a.remaining ?? 9999) - (b.remaining ?? 9999);
    })
    .slice(0, 3);
  return (
    <View style={[styles.card, { gap: 12 }]}>
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>빨리 마실 원두</Text>
          <Text style={styles.small}>신선일과 개봉일을 기준으로 소비 순서를 봅니다.</Text>
        </View>
        <MaterialIcons name="inventory-2" size={22} color={colors.primary} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {summary.map(([label, value]) => <MetricChip key={label} label={String(label)} value={value} colors={colors} />)}
      </View>
      {rows.length > 0 ? rows.map(({ lot, product, remaining, logCount, freshness }) => (
        <View key={lot.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, gap: 8, backgroundColor: colors.surfaceAlt }}>
          <View style={styles.between}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{product?.name ?? '원두'}</Text>
              <Text style={styles.small} numberOfLines={1}>
                남은 양 {remaining == null ? '-' : `${remaining}g`} · 기록 {logCount}회 · {freshness.compactMeta}
              </Text>
            </View>
            <FreshnessBadge freshness={freshness} colors={colors} compact />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {!lot.openedDate && (
              <TouchableOpacity style={[styles.ghostButton, { minHeight: 36 }]} onPress={() => onOpenLot(lot)}>
                <Text style={styles.ghostText}>개봉</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.ghostButton, { minHeight: 36 }]} onPress={() => onEditLot(lot)}>
              <Text style={styles.ghostText}>남은 양 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghostButton, { minHeight: 36 }]} onPress={() => onFinishLot(lot)}>
              <Text style={styles.ghostText}>소진 처리</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { minHeight: 36 }]} onPress={() => onLogLot(lot)}>
              <Text style={styles.buttonText}>기록하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )) : (
        <Text style={styles.subtitle}>보유 중인 원두가 없습니다. 미개봉 원두를 추가하면 여기에 표시됩니다.</Text>
      )}
    </View>
  );
}

export function CompactSelectionBar({
  title,
  subtitle,
  meta,
  colors,
  onChange,
  onDetail,
  emptyText = '선택 없음',
}: {
  title?: string | null;
  subtitle?: string | null;
  meta?: string | null;
  colors: ThemeColors;
  onChange?: () => void;
  onDetail?: () => void;
  emptyText?: string;
}) {
  const styles = createCommonStyles(colors);
  return (
    <View style={[styles.card, { padding: 12, gap: 10 }]}>
      <View style={styles.row}>
        <View style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="coffee" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>{title || emptyText}</Text>
          {!!subtitle && <Text style={styles.small} numberOfLines={1}>{subtitle}</Text>}
          {!!meta && <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{meta}</Text>}
        </View>
        {!!onDetail && (
          <TouchableOpacity accessibilityLabel={`${title || emptyText} 상세 보기`} style={[styles.ghostButton, { minHeight: 38, paddingHorizontal: 10 }]} onPress={onDetail}>
            <Text style={styles.ghostText}>상세</Text>
          </TouchableOpacity>
        )}
        {!!onChange && (
          <TouchableOpacity accessibilityLabel={`${title || emptyText} 변경`} style={[styles.button, { minHeight: 38, paddingHorizontal: 10 }]} onPress={onChange}>
            <MaterialIcons name="swap-horiz" size={18} color="#fff" />
            <Text style={styles.buttonText}>변경</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

type ProductSelectorFilter = 'active' | 'recent' | 'unopened' | 'all';
type LotSelectorFilter = 'active' | 'open' | 'unopened' | 'all';

const compactLotStatusLabel: Record<string, string> = {
  unopened: '미개봉',
  open: '사용중',
  finished: '소진',
  archived: '보관',
};

const compactTimestamp = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const compactLogLotId = (log: BrewLog) => log.purchaseLotId ?? log.beanId;

const compactLotIndexText = (bean: Bean, beans: Bean[]) => {
  if (!bean.productId) return '구매분';
  const group = beans
    .filter(item => item.productId === bean.productId)
    .sort((a, b) => (a.purchaseDate ?? a.createdAt).localeCompare(b.purchaseDate ?? b.createdAt));
  const index = group.findIndex(item => item.id === bean.id);
  return `${index >= 0 ? index + 1 : 1}번째 구매`;
};

const compactGram = (value: number | null | undefined) => value == null ? '-' : `${Math.round(value * 10) / 10}g`;

const compactLotSearchText = (bean: Bean) => [
  bean.name,
  bean.roastery,
  bean.origin,
  bean.process,
  bean.seller,
  bean.purchaseDate,
  bean.roastDate,
  bean.openedDate,
  bean.expiryDate,
  bean.lotMemo,
].filter(Boolean).join(' ').toLowerCase();

const compactLotSort = (a: Bean, b: Bean) => {
  const statusRank = (bean: Bean) => bean.lotStatus === 'open' ? 0 : bean.lotStatus === 'unopened' ? 1 : 2;
  const rankDiff = statusRank(a) - statusRank(b);
  if (rankDiff !== 0) return rankDiff;
  return compactTimestamp(b.purchaseDate ?? b.createdAt) - compactTimestamp(a.purchaseDate ?? a.createdAt);
};

const compactFreshnessSort = (a: Bean, b: Bean) => {
  const freshA = getFreshnessInfo(a);
  const freshB = getFreshnessInfo(b);
  if (freshB.priority !== freshA.priority) return freshB.priority - freshA.priority;
  if (freshA.freshUntilDate && freshB.freshUntilDate) return freshA.freshUntilDate.localeCompare(freshB.freshUntilDate);
  return compactLotSort(a, b);
};

type CoffeeLotSelectorGroup = {
  key: string;
  title: string;
  subtitle: string;
  lots: Bean[];
  latestPurchase: number;
  latestLog: number;
  hasActiveLot: boolean;
  hasUnopenedLot: boolean;
};

export function CoffeeLotSelectorSheet({
  visible,
  colors,
  beans,
  logs,
  selectedLotId,
  selectedProductKey: selectedProductKeyProp,
  mode = 'lot',
  title = '구매분 선택',
  subtitle = '원두 제품을 먼저 고르고, 그 안의 구매분을 선택하세요.',
  onClose,
  onSelect,
  onSelectProduct,
}: {
  visible: boolean;
  colors: ThemeColors;
  beans: Bean[];
  logs: BrewLog[];
  selectedLotId?: string | null;
  selectedProductKey?: string | null;
  mode?: 'product' | 'lot';
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSelect: (bean: Bean) => void;
  onSelectProduct?: (productKey: string) => void;
}) {
  const styles = createCommonStyles(colors);
  const [query, setQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductSelectorFilter>('active');
  const [lotFilter, setLotFilter] = useState<LotSelectorFilter>('active');
  const [activeProductKey, setActiveProductKey] = useState<string | null>(null);
  const selectedLot = beans.find(bean => bean.id === selectedLotId) ?? null;
  const selectedProductKey = selectedProductKeyProp ?? selectedLot?.productId ?? selectedLot?.id ?? null;

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setProductFilter('active');
    setLotFilter('active');
    setActiveProductKey(mode === 'lot' ? selectedProductKey ?? null : null);
  }, [visible, mode, selectedProductKey]);

  const recentLots = useMemo(() => {
    const seen = new Set<string>();
    const recent: Bean[] = [];
    [...logs].sort((a, b) => compactTimestamp(b.brewedAt) - compactTimestamp(a.brewedAt)).forEach(log => {
      const id = compactLogLotId(log);
      if (seen.has(id)) return;
      const lot = beans.find(item => item.id === id);
      if (!lot) return;
      seen.add(id);
      recent.push(lot);
    });
    return recent.slice(0, 5);
  }, [beans, logs]);

  const quickLotSections = useMemo(() => {
    const seen = new Set<string>();
    const take = (items: Bean[], limit: number) => {
      const result: Bean[] = [];
      items.forEach(item => {
        if (seen.has(item.id) || result.length >= limit) return;
        seen.add(item.id);
        result.push(item);
      });
      return result;
    };
    const priorityLots = [...beans]
      .filter(item => item.lotStatus === 'open' || item.lotStatus === 'unopened')
      .filter(item => getFreshnessInfo(item).priority >= 68)
      .sort(compactFreshnessSort);
    return [
      { key: 'selected', title: '현재 선택', lots: take(selectedLot ? [selectedLot] : [], 1) },
      { key: 'priority', title: '우선 소비', lots: take(priorityLots, 5) },
      { key: 'recent', title: '최근 사용', lots: take(recentLots, 4) },
      { key: 'open', title: '개봉 중', lots: take([...beans].filter(item => item.lotStatus === 'open').sort(compactLotSort), 5) },
      { key: 'unopened', title: '미개봉', lots: take([...beans].filter(item => item.lotStatus === 'unopened').sort(compactLotSort), 5) },
    ].filter(section => section.lots.length > 0);
  }, [beans, recentLots, selectedLot]);

  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    const latestLogByLot = new Map<string, number>();
    logs.forEach(log => {
      const id = compactLogLotId(log);
      latestLogByLot.set(id, Math.max(latestLogByLot.get(id) ?? 0, compactTimestamp(log.brewedAt)));
    });

    const map = new Map<string, CoffeeLotSelectorGroup>();
    beans
      .filter(lot => !search || compactLotSearchText(lot).includes(search))
      .forEach(lot => {
        const key = lot.productId ?? lot.id;
        if (!map.has(key)) {
          map.set(key, {
            key,
            title: lot.name,
            subtitle: [lot.roastery, lot.origin || lot.process || lot.roastLevel].filter(Boolean).join(' · ') || '제품 정보 미입력',
            lots: [],
            latestPurchase: 0,
            latestLog: 0,
            hasActiveLot: false,
            hasUnopenedLot: false,
          });
        }
        const group = map.get(key)!;
        group.lots.push(lot);
        group.latestPurchase = Math.max(group.latestPurchase, compactTimestamp(lot.purchaseDate ?? lot.createdAt));
        group.latestLog = Math.max(group.latestLog, latestLogByLot.get(lot.id) ?? 0);
        group.hasActiveLot = group.hasActiveLot || lot.lotStatus === 'open' || lot.lotStatus === 'unopened';
        group.hasUnopenedLot = group.hasUnopenedLot || lot.lotStatus === 'unopened';
      });

    return [...map.values()]
      .map(group => ({ ...group, lots: [...group.lots].sort(compactLotSort) }))
      .filter(group => {
        if (productFilter === 'active') return group.hasActiveLot;
        if (productFilter === 'recent') return group.latestLog > 0;
        if (productFilter === 'unopened') return group.hasUnopenedLot;
        return true;
      })
      .sort((a, b) => {
        if (productFilter === 'recent') return b.latestLog - a.latestLog || b.latestPurchase - a.latestPurchase;
        if (a.hasActiveLot !== b.hasActiveLot) return a.hasActiveLot ? -1 : 1;
        return b.latestPurchase - a.latestPurchase;
      });
  }, [beans, logs, productFilter, query]);

  const activeGroup = groups.find(group => group.key === activeProductKey) ?? null;
  const lotRows = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.lots.filter(lot => {
      if (lotFilter === 'active') return lot.lotStatus === 'open' || lot.lotStatus === 'unopened';
      if (lotFilter === 'open') return lot.lotStatus === 'open';
      if (lotFilter === 'unopened') return lot.lotStatus === 'unopened';
      return true;
    });
  }, [activeGroup, lotFilter]);
  const lotRowSections = useMemo(() => {
    const sectionDefs = [
      { key: 'open', title: '개봉 중', lots: lotRows.filter(lot => lot.lotStatus === 'open') },
      { key: 'unopened', title: '미개봉', lots: lotRows.filter(lot => lot.lotStatus === 'unopened') },
      { key: 'finished', title: '사용 완료/보관', lots: lotRows.filter(lot => lot.lotStatus !== 'open' && lot.lotStatus !== 'unopened') },
    ];
    return sectionDefs.filter(section => section.lots.length > 0);
  }, [lotRows]);

  const renderProduct = ({ item }: { item: CoffeeLotSelectorGroup }) => (
    <TouchableOpacity
      onPress={() => {
        if (mode === 'product') {
          onSelectProduct?.(item.key);
          return;
        }
        setActiveProductKey(item.key);
      }}
      style={{
        minHeight: 74,
        borderWidth: 1,
        borderColor: item.key === activeProductKey || item.key === selectedProductKey ? colors.primary : colors.border,
        backgroundColor: item.key === activeProductKey || item.key === selectedProductKey ? colors.badge : colors.surfaceAlt,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
      }}
    >
      <View style={styles.between}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.small} numberOfLines={1}>{item.subtitle}</Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '900' }}>{item.lots.length}개</Text>
      </View>
      <Text style={styles.small} numberOfLines={1}>
        {item.hasActiveLot ? '보유 중' : '보관/소진'} · 최근 구매 {item.latestPurchase ? new Date(item.latestPurchase).toISOString().slice(0, 10) : '-'} · 최근 기록 {item.latestLog ? new Date(item.latestLog).toISOString().slice(0, 10) : '-'}
      </Text>
    </TouchableOpacity>
  );

  const renderLot = ({ item }: { item: Bean }) => {
    const freshness = getFreshnessInfo(item);
    return (
      <TouchableOpacity
        onPress={() => onSelect(item)}
        style={{
          borderWidth: 1,
          borderColor: item.id === selectedLotId ? colors.primary : colors.border,
          backgroundColor: item.id === selectedLotId ? colors.badge : colors.surfaceAlt,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginBottom: 7,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 78 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{compactLotIndexText(item, beans)}</Text>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{compactLotStatusLabel[item.lotStatus] ?? item.lotStatus}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>구매 {item.purchaseDate ?? '-'} · 로스팅 {item.roastDate ?? '-'}</Text>
            <Text style={styles.small} numberOfLines={1}>{freshness.compactMeta} · 남은 양 {compactGram(item.remainingWeightGram)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <FreshnessBadge freshness={freshness} colors={colors} compact />
            <Text style={{ color: item.id === selectedLotId ? colors.primary : colors.textSecondary, fontWeight: '900', fontSize: 12 }}>{item.id === selectedLotId ? '선택됨' : '선택'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuickLot = (item: Bean) => {
    const freshness = getFreshnessInfo(item);
    return (
      <TouchableOpacity
        key={`quick-${item.id}`}
        onPress={() => onSelect(item)}
        style={{
          borderWidth: 1,
          borderColor: item.id === selectedLotId ? colors.primary : colors.border,
          backgroundColor: item.id === selectedLotId ? colors.badge : colors.surfaceAlt,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginBottom: 7,
        }}
      >
        <View style={styles.between}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{item.name} · {compactLotIndexText(item, beans)}</Text>
            <Text style={styles.small} numberOfLines={1}>{compactLotStatusLabel[item.lotStatus] ?? item.lotStatus} · {freshness.compactMeta} · {compactGram(item.remainingWeightGram)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <FreshnessBadge freshness={freshness} colors={colors} compact />
            <Text style={{ color: item.id === selectedLotId ? colors.primary : colors.textSecondary, fontWeight: '900', fontSize: 12 }}>{item.id === selectedLotId ? '선택됨' : '선택'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' }}>
        <View style={{ height: '88%', backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.border }}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity accessibilityLabel="구매분 선택 닫기" style={[styles.ghostButton, { width: 42, paddingHorizontal: 0 }]} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, { marginTop: 12 }]}
            value={query}
            onChangeText={text => {
              setQuery(text);
              setActiveProductKey(null);
            }}
            placeholder="제품명, 로스터리, 산지, 구매처 검색"
            placeholderTextColor={colors.textTertiary}
          />
          {mode === 'product' || !activeGroup ? (
            <>
              {mode === 'lot' && !query.trim() && quickLotSections.length > 0 && (
                <View style={{ marginTop: 10, marginBottom: 10 }}>
                  {quickLotSections.map(section => (
                    <View key={section.key} style={{ marginBottom: 10 }}>
                      <Text style={styles.label}>{section.title}</Text>
                      {section.lots.map(renderQuickLot)}
                    </View>
                  ))}
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 10 }}>
                {([
                  ['active', '보유 제품'],
                  ['recent', '최근 사용'],
                  ['unopened', '미개봉 있음'],
                  ['all', '전체 검색'],
                ] as Array<[ProductSelectorFilter, string]>).map(([value, label]) => (
                  <TouchableOpacity key={value} style={[styles.ghostButton, productFilter === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setProductFilter(value)}>
                    <Text style={styles.ghostText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {productFilter === 'active' && <Text style={[styles.small, { marginBottom: 8 }]}>소진/보관 구매분은 숨겨져 있습니다. 필요하면 전체 검색을 사용하세요.</Text>}
              {mode === 'product' && <Text style={[styles.small, { marginBottom: 8 }]}>제품만 선택합니다. 다음 단계에서 구매분을 다시 확인합니다.</Text>}
              <FlatList
                data={groups}
                keyExtractor={item => item.key}
                renderItem={renderProduct}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={[styles.subtitle, { textAlign: 'center', marginTop: 28 }]}>조건에 맞는 구매분이 없습니다. 원두 탭에서 구매분을 추가하거나 전체 필터를 확인하세요.</Text>}
                contentContainerStyle={{ paddingBottom: 24 }}
              />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 10 }}>
                <TouchableOpacity style={[styles.ghostButton, { width: 42, paddingHorizontal: 0 }]} onPress={() => setActiveProductKey(null)}>
                  <MaterialIcons name="chevron-left" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }} numberOfLines={1}>{activeGroup.title}</Text>
                  <Text style={styles.small} numberOfLines={1}>{activeGroup.subtitle}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {([
                  ['active', '개봉+미개봉'],
                  ['open', '개봉'],
                  ['unopened', '미개봉'],
                  ['all', '전체'],
                ] as Array<[LotSelectorFilter, string]>).map(([value, label]) => (
                  <TouchableOpacity key={value} style={[styles.ghostButton, lotFilter === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setLotFilter(value)}>
                    <Text style={styles.ghostText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 8 }}>
                {['구매분', '날짜 / 상태 / 남은 양'].map((label, index) => (
                  <Text key={label} style={{ flex: index === 0 ? 0.42 : 1, color: colors.textSecondary, fontWeight: '900', fontSize: 12 }}>{label}</Text>
                ))}
              </View>
              {lotRowSections.length === 0 ? (
                <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 28 }]}>이 제품에서 조건에 맞는 구매분이 없습니다.</Text>
              ) : (
                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                  {lotRowSections.map(section => (
                    <View key={section.key} style={{ marginBottom: 10 }}>
                      <Text style={[styles.label, { marginTop: 4 }]}>{section.title}</Text>
                      {section.lots.map(item => <View key={item.id}>{renderLot({ item })}</View>)}
                    </View>
                  ))}
                </ScrollView>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  colors,
  onPress,
  right,
  danger,
}: {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string | null;
  colors: ThemeColors;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const styles = createCommonStyles(colors);
  const content = (
    <View style={[styles.between, { minHeight: 52 }]}>
      <View style={[styles.row, { flex: 1, minWidth: 0 }]}>
        {!!icon && (
          <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name={icon} size={19} color={danger ? colors.danger : colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: danger ? colors.danger : colors.text, fontWeight: '900' }} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.small} numberOfLines={2}>{subtitle}</Text>}
        </View>
      </View>
      <View style={{ marginLeft: 8, alignItems: 'center', justifyContent: 'center' }}>
        {right ?? (onPress ? <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} /> : null)}
      </View>
    </View>
  );
  if (!onPress) return <View style={{ paddingVertical: 8 }}>{content}</View>;
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={{ paddingVertical: 8 }}>{content}</TouchableOpacity>;
}

function IoniconsFallback({ colors }: { colors: ThemeColors }) {
  return <MaterialIcons name="coffee" color={colors.primary} size={28} />;
}

export function LogSummary({ log, colors, compact }: { log: BrewLog; colors: ThemeColors; compact?: boolean }) {
  const styles = createCommonStyles(colors);
  const details = [
    log.recordingModeUsed ? `${log.recordingModeUsed} 기록` : null,
    log.timeMeasurementSource ? `시간 ${log.timeMeasurementSource}` : null,
    log.doseMode ? `${log.doseMode === 'auto' ? 'AUTO' : 'MANUAL'} 도징` : null,
    log.basketType ? log.basketType.replace(/_/g, ' ') : null,
    log.shotButton ? `${log.shotButton.toUpperCase()} 버튼` : null,
    log.doseLevel ? `도즈 ${log.doseLevel}` : null,
    log.pressureZone ? `압력 ${log.pressureZone}` : null,
    log.shotResult,
    log.channeling && log.channeling !== 'none' ? `채널링 ${log.channeling === 'suspected' ? '의심' : '보임'}` : null,
    log.puckPrep,
    log.preinfusionSeconds != null ? `프리 ${log.preinfusionSeconds}초` : null,
    log.waterMl != null ? `물 ${log.waterMl}ml` : null,
    log.milkMl != null ? `우유 ${log.milkMl}ml` : null,
    log.servingTemperature === 'iced' ? '아이스' : log.servingTemperature === 'hot' ? '핫' : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={compact ? { gap: 4 } : [styles.card, { marginBottom: 10 }]}>
      <View style={styles.between}>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{log.beanName ?? '원두'}</Text>
        <Text style={{ color: colors.primary, fontWeight: '800' }}>{log.rating ? `${log.rating}/5` : '평점 없음'}</Text>
      </View>
      <Text style={styles.small}>{log.drinkType ?? '커피 종류 미입력'} · {new Date(log.brewedAt).toLocaleString('ko-KR')}</Text>
      <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
        분쇄 {log.grindSizeExternal ?? log.grindSize ?? '-'} · 도징 {log.actualDoseGram ?? log.doseGram ?? '-'}g · 수율 {log.yieldGram ?? '-'}g · {formatSeconds(log.brewSeconds)}
      </Text>
      {!compact && !!details && <Text style={styles.small}>{details}</Text>}
      {!compact && !!log.resultMemo && <Text style={{ color: colors.text, marginTop: 8 }}>{log.resultMemo}</Text>}
    </View>
  );
}

export function RecommendationCard({ recommendation, colors }: { recommendation: DialInRecommendation; colors: ThemeColors }) {
  const styles = createCommonStyles(colors);
  return (
    <View style={[styles.card, { gap: 8 }]}>
      <View style={styles.between}>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900', flex: 1 }}>{recommendation.title}</Text>
        <Text style={{ color: colors.primary, fontWeight: '900' }}>신뢰도 {recommendation.confidence}</Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>{recommendation.summary}</Text>
      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900' }}>{recommendation.action}</Text>
        {!!recommendation.nextGrindSize && <Text style={{ color: colors.primary, marginTop: 6, fontWeight: '800' }}>다음 분쇄도 후보: {recommendation.nextGrindSize}</Text>}
      </View>
      <Text style={{ color: colors.textSecondary }}>{recommendation.reason}</Text>
      <Text style={{ color: colors.textSecondary }}>목표/참고: {recommendation.target}</Text>
      <Text style={{ color: colors.accent, fontWeight: '800' }}>{recommendation.beginnerTip}</Text>
      {recommendation.warnings.map(item => (
        <Text key={item} style={{ color: colors.danger, fontSize: 13 }}>• {item}</Text>
      ))}
    </View>
  );
}
