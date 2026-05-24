import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SettingsRow, createCommonStyles } from '../../src/components';
import { darkColors, lightColors } from '../../src/constants/theme';
import { clearAllData } from '../../src/db/queries';
import { testAiKey } from '../../src/services/ai';
import { cancelTrackedNotifications, rescheduleBeanNotifications } from '../../src/services/notifications';
import { clearPhotoDirectory } from '../../src/services/photos';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { deleteApiKeyById, getApiKeyById, migrateLegacyApiKeys, saveApiKey, useSettingsStore } from '../../src/store/settingsStore';
import { AiKeyMeta, AiKeyProvider, AiProvider, TermHelpVisibility } from '../../src/types/models';
import { ExportContent } from './export';

type SettingsPage = 'main' | 'recording' | 'notifications' | 'ai' | 'support' | 'export';

type ModelPreset = {
  id: string;
  label: string;
  tier: string;
  cost: string;
  bestFor: string;
};

const openAiModelPresets: ModelPreset[] = [
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', tier: '가장 저렴', cost: '입력 $0.20 / 출력 $1.25 per 1M tokens', bestFor: '원두 라벨 OCR, 간단 분류' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', tier: '저렴/균형', cost: '입력 $0.25 / 출력 $2.00 per 1M tokens', bestFor: '일상적인 원두 봉투 분석' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', tier: '중간 가격', cost: '입력 $0.75 / 출력 $4.50 per 1M tokens', bestFor: '작은 글씨, 여러 언어 라벨' },
  { id: 'gpt-5.4', label: 'GPT-5.4', tier: '비쌈/고성능', cost: '입력 $2.50 / 출력 $15.00 per 1M tokens', bestFor: '복잡한 사진 재분석' },
];

const geminiModelPresets: ModelPreset[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', tier: '가장 저렴', cost: '입력 $0.10 / 출력 $0.40 per 1M tokens', bestFor: '저비용 반복 분석' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: '저렴/균형', cost: '입력 $0.30 / 출력 $2.50 per 1M tokens', bestFor: '일반 사진 분석 기본값' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: '비쌈/고성능', cost: '입력 $1.25 / 출력 $10.00 per 1M tokens', bestFor: '긴 자료와 고정밀 분석' },
];

const pageTitle: Record<SettingsPage, string> = {
  main: '설정',
  recording: '기록 방식',
  notifications: '알림',
  ai: 'AI 기능',
  support: '지원 정보',
  export: '데이터 내보내기',
};

const termHelpLabels: Record<TermHelpVisibility, string> = {
  off: '숨김',
  minimal: '핵심만',
  recommended: '추천 표시',
  full: '전체 표시',
};

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const colors = settings.isDarkMode ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  const hydrate = useCoffeeStore(s => s.hydrate);
  const beans = useCoffeeStore(s => s.beans);
  const [page, setPage] = useState<SettingsPage>('main');
  const [openAiKey, setOpenAiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openAiLabel, setOpenAiLabel] = useState('OpenAI 키');
  const [geminiLabel, setGeminiLabel] = useState('Gemini 키');
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);

  useEffect(() => {
    void migrateLegacyApiKeys();
  }, []);

  const providerModel = (provider: AiKeyProvider) => provider === 'openai' ? settings.openAiModel : settings.geminiModel;
  const providerDraft = (provider: AiKeyProvider) => provider === 'openai' ? openAiKey : geminiKey;
  const providerLabel = (provider: AiKeyProvider) => provider === 'openai' ? openAiLabel : geminiLabel;
  const setProviderDraft = (provider: AiKeyProvider, value: string) => provider === 'openai' ? setOpenAiKey(value) : setGeminiKey(value);

  const resetProviderDraft = (provider: AiKeyProvider) => {
    setProviderDraft(provider, '');
    if (provider === 'openai') setOpenAiLabel('OpenAI 키');
    else setGeminiLabel('Gemini 키');
  };

  const saveKey = async (provider: AiKeyProvider, activate = false) => {
    try {
      await saveApiKey(provider, providerDraft(provider), providerLabel(provider), activate);
      resetProviderDraft(provider);
      Alert.alert('저장 완료', activate ? 'API Key를 저장하고 활성 키로 설정했습니다.' : 'API Key를 키 목록에 저장했습니다.');
    } catch (error: any) {
      Alert.alert('저장 실패', error?.message ?? 'API Key 저장 중 오류가 발생했습니다.');
    }
  };

  const testDraftKey = async (provider: AiKeyProvider) => {
    try {
      setBusy(true);
      await testAiKey(provider, providerModel(provider), providerDraft(provider));
      Alert.alert('테스트 성공', '입력한 API Key와 현재 모델 응답을 확인했습니다. 아직 저장되지는 않았습니다.');
    } catch (error: any) {
      Alert.alert('테스트 실패', error?.message ?? 'API 테스트 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const testStoredKey = async (key: AiKeyMeta) => {
    try {
      setBusy(true);
      const rawKey = await getApiKeyById(key.id);
      await testAiKey(key.provider, providerModel(key.provider), rawKey);
      settings.updateApiKeyTestStatus(key.id, 'success');
      Alert.alert('테스트 성공', `${key.label} 키와 현재 모델 응답을 확인했습니다.`);
    } catch (error: any) {
      settings.updateApiKeyTestStatus(key.id, 'failed');
      Alert.alert('테스트 실패', error?.message ?? 'API 테스트 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const deleteStoredKey = (key: AiKeyMeta) => {
    Alert.alert(
      key.active ? '활성 키 삭제' : 'API Key 삭제',
      key.active ? '현재 활성 키입니다. 삭제하면 같은 서비스의 다른 키가 있으면 자동으로 활성 후보가 됩니다.' : '이 API Key를 삭제할까요?',
      [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => deleteApiKeyById(key.id) }]
    );
  };

  const syncNotificationSettings = async (next: { expiryAlerts: boolean; freshnessAlerts: boolean }, showResult: boolean) => {
    try {
      const result = await rescheduleBeanNotifications(beans, next, { promptForPermission: showResult });
      if (!showResult) return;
      Alert.alert(
        result.unavailableReason ? '알림 예약 확인' : '알림 예약 완료',
        result.unavailableReason ?? `활성 원두 기준으로 ${result.scheduledCount}개 알림을 예약했습니다.`
      );
    } catch (error: any) {
      if (showResult) Alert.alert('알림 예약 실패', error?.message ?? '알림 예약 중 오류가 발생했습니다.');
    }
  };

  const setExpiryAlerts = (value: boolean) => {
    settings.setExpiryAlerts(value);
    void syncNotificationSettings({ expiryAlerts: value, freshnessAlerts: settings.freshnessAlerts }, value);
  };

  const setFreshnessAlerts = (value: boolean) => {
    settings.setFreshnessAlerts(value);
    void syncNotificationSettings({ expiryAlerts: settings.expiryAlerts, freshnessAlerts: value }, value);
  };

  const renderPreset = (preset: ModelPreset, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={preset.id}
      style={[styles.card, { flex: 1, minWidth: 210, backgroundColor: selected ? colors.badge : colors.surfaceAlt, borderColor: selected ? colors.primary : colors.border }]}
      onPress={onPress}
    >
      <View style={styles.between}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16, flex: 1 }}>{preset.label}</Text>
        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '900' }}>{preset.tier}</Text>
      </View>
      <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 6 }}>{preset.cost}</Text>
      <Text style={styles.small}>{preset.bestFor}</Text>
    </TouchableOpacity>
  );

  const renderKeyManager = (provider: AiKeyProvider) => {
    const keys = settings.aiKeys.filter(key => key.provider === provider);
    const activeKey = keys.find(key => key.active);
    const draft = providerDraft(provider);
    const label = providerLabel(provider);
    const setLabel = provider === 'openai' ? setOpenAiLabel : setGeminiLabel;
    const providerName = provider === 'openai' ? 'OpenAI' : 'Gemini';
    const statusLabel = (key: AiKeyMeta) => key.lastTestStatus === 'success' ? '테스트 성공' : key.lastTestStatus === 'failed' ? '테스트 실패' : '미테스트';

    return (
      <View style={[styles.card, { gap: 12, marginTop: 12 }]}>
        <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }}>{providerName} 연결 키</Text>
        <Text style={styles.subtitle}>{activeKey ? `활성: ${activeKey.label} · ${activeKey.maskedKey}` : '활성 키가 없습니다.'}</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="키 이름" placeholderTextColor={colors.textTertiary} />
        <TextInput style={styles.input} value={draft} onChangeText={value => setProviderDraft(provider, value)} secureTextEntry placeholder={provider === 'openai' ? 'sk-...' : 'AIza...'} placeholderTextColor={colors.textTertiary} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <TouchableOpacity disabled={busy} style={[styles.ghostButton, { flexGrow: 1, flexBasis: 150 }]} onPress={() => testDraftKey(provider)}>
            <MaterialIcons name="network-check" size={18} color={colors.text} />
            <Text style={styles.ghostText}>입력한 키 테스트</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ghostButton, { flexGrow: 1, flexBasis: 82 }]} onPress={() => saveKey(provider, false)}><Text style={styles.ghostText}>저장</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.button, { flexGrow: 1, flexBasis: 150 }]} onPress={() => saveKey(provider, true)}><Text style={styles.buttonText}>저장 후 활성화</Text></TouchableOpacity>
        </View>
        {keys.map(key => (
          <View key={key.id} style={{ backgroundColor: key.active ? colors.badge : colors.surfaceAlt, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: key.active ? colors.primary : colors.border }}>
            {editingKeyId === key.id ? (
              <TextInput style={styles.input} value={renameDraft} onChangeText={setRenameDraft} placeholder="키 이름" placeholderTextColor={colors.textTertiary} />
            ) : (
              <>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{key.label} {key.active ? '· 활성' : ''}</Text>
                <Text style={styles.small}>{key.maskedKey} · {statusLabel(key)}</Text>
              </>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {editingKeyId === key.id ? (
                <>
                  <TouchableOpacity style={[styles.button, { flexGrow: 1, flexBasis: 120 }]} onPress={() => { settings.renameApiKey(key.id, renameDraft); setEditingKeyId(null); setRenameDraft(''); }}><Text style={styles.buttonText}>이름 저장</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { flexGrow: 1, flexBasis: 90 }]} onPress={() => { setEditingKeyId(null); setRenameDraft(''); }}><Text style={styles.ghostText}>취소</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  {!key.active && <TouchableOpacity style={[styles.ghostButton, { flexGrow: 1, flexBasis: 90 }]} onPress={() => settings.activateApiKey(provider, key.id)}><Text style={styles.ghostText}>활성화</Text></TouchableOpacity>}
                  <TouchableOpacity disabled={busy} style={[styles.ghostButton, { flexGrow: 1, flexBasis: 82 }]} onPress={() => testStoredKey(key)}><Text style={styles.ghostText}>테스트</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { flexGrow: 1, flexBasis: 105 }]} onPress={() => { setEditingKeyId(key.id); setRenameDraft(key.label); }}><Text style={styles.ghostText}>이름 변경</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger, flexGrow: 1, flexBasis: 132 }]} onPress={() => deleteStoredKey(key)}><Text style={[styles.ghostText, { color: colors.danger }]}>API Key 삭제</Text></TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const activeOpenAi = settings.aiKeys.find(key => key.provider === 'openai' && key.active);
  const activeGemini = settings.aiKeys.find(key => key.provider === 'gemini' && key.active);
  const selectedProvider = settings.aiProvider;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{pageTitle[page]}</Text>
          <Text style={styles.subtitle}>{page === 'main' ? '앱 관리 기능과 백업을 한곳에서 관리합니다.' : '설정 메인으로 언제든 돌아갈 수 있습니다.'}</Text>
        </View>
        {page !== 'main' && (
          <TouchableOpacity accessibilityLabel="설정으로 돌아가기" style={styles.ghostButton} onPress={() => setPage('main')}>
            <MaterialIcons name="close" size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {page === 'main' && (
        <View style={{ gap: 18, marginTop: 18 }}>
          <View style={styles.card}>
            <SettingsRow icon="dark-mode" title="화면 모드" subtitle={settings.isDarkMode ? '다크 모드 사용 중' : '라이트 모드 사용 중'} colors={colors} right={<Switch value={settings.isDarkMode} onValueChange={settings.setDarkMode} />} />
            <SettingsRow icon="edit-note" title="기본 기록 방식" subtitle={settings.recordingMode === 'quick' ? '빠른 기록' : settings.recordingMode === 'guided' ? '가이드 기록' : '상세 기록'} colors={colors} onPress={() => setPage('recording')} />
            <SettingsRow icon="help-outline" title="용어 도움말" subtitle={termHelpLabels[settings.termHelpVisibility]} colors={colors} onPress={() => setPage('recording')} />
          </View>

          <View style={styles.card}>
            <SettingsRow icon="notifications" title="원두/관리 알림" subtitle={[settings.freshnessAlerts && '신선도', settings.expiryAlerts && '유통기한'].filter(Boolean).join(' · ') || '꺼짐'} colors={colors} onPress={() => setPage('notifications')} />
          </View>

          <View style={styles.card}>
            <SettingsRow icon="auto-awesome" title="AI 기능" subtitle={settings.aiProvider === 'none' ? '사용 안 함' : `${settings.aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} · ${settings.aiProvider === 'openai' ? activeOpenAi?.label ?? '키 미설정' : activeGemini?.label ?? '키 미설정'}`} colors={colors} onPress={() => setPage('ai')} />
          </View>

          <View style={styles.card}>
            <SettingsRow icon="ios-share" title="데이터 내보내기" subtitle="전체 백업, 추출 기록 CSV, 사진 포함 ZIP" colors={colors} onPress={() => setPage('export')} />
          </View>

          <View style={styles.card}>
            <SettingsRow icon="support-agent" title="지원 정보" subtitle={settings.showDebugInfo ? '디버그 정보 표시 중' : '일반 화면에서 내부 ID 숨김'} colors={colors} onPress={() => setPage('support')} />
          </View>

          <View style={styles.card}>
            <SettingsRow
              icon="delete"
              title="모든 커피 기록 삭제"
              subtitle="원두, 구매 봉투, 사진 연결, 추출 기록을 모두 삭제합니다."
              colors={colors}
              danger
              onPress={() => Alert.alert('모든 커피 기록 삭제', '원두, 구매 봉투, 사진 연결, 추출 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.', [
                { text: '취소' },
                { text: '삭제', style: 'destructive', onPress: async () => { await cancelTrackedNotifications(); await clearAllData(); await clearPhotoDirectory(); await hydrate(); } },
              ])}
            />
          </View>
        </View>
      )}

      {page === 'recording' && (
        <View style={[styles.card, { marginTop: 18, gap: 12 }]}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>기본 기록 모드</Text>
          <Text style={styles.subtitle}>사용자 실력이 아니라 이번 기록의 깊이입니다. 기록 화면에서도 매번 바꿀 수 있습니다.</Text>
          {[
            ['quick', '빠른 기록', '도징량/추출량/시간 중심'],
            ['guided', '가이드 기록', 'BES876 핵심 게이지 포함'],
            ['precision', '상세 기록', '모든 변수 열기'],
          ].map(([value, label, description]) => (
            <TouchableOpacity
              key={value}
              style={[
                {
                  minHeight: 58,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: settings.recordingMode === value ? colors.primary : colors.border,
                  backgroundColor: settings.recordingMode === value ? colors.badge : colors.surface,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  justifyContent: 'center',
                },
              ]}
              onPress={() => settings.setRecordingMode(value as any)}
            >
              <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
              <Text style={styles.small}>{description}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Text style={{ color: colors.text, fontWeight: '900' }}>용어 도움말 표시</Text>
          <Text style={styles.subtitle}>기록 중 헷갈리는 단어만 ? 아이콘으로 짧게 확인합니다. 숨겨도 저장 기능에는 영향이 없습니다.</Text>
          {([
            ['off', '숨김', '기본 화면에서 물음표를 보이지 않음'],
            ['minimal', '핵심만', '분쇄도/도징량/추출량/시간만 표시'],
            ['recommended', '추천 표시', 'Guided 중심으로 필요한 용어 표시'],
            ['full', '전체 표시', '지원되는 용어를 최대한 표시'],
          ] as Array<[TermHelpVisibility, string, string]>).map(([value, label, description]) => (
            <TouchableOpacity
              key={value}
              style={{
                minHeight: 54,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: settings.termHelpVisibility === value ? colors.primary : colors.border,
                backgroundColor: settings.termHelpVisibility === value ? colors.badge : colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 10,
                justifyContent: 'center',
              }}
              onPress={() => settings.setTermHelpVisibility(value)}
            >
              <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
              <Text style={styles.small}>{description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {page === 'notifications' && (
        <View style={[styles.card, { marginTop: 18, gap: 12 }]}>
          <Text style={styles.subtitle}>알림을 켜면 활성 구매분 기준으로 기존 예약을 정리하고 다시 예약합니다.</Text>
          {[
            ['신선도 알림', settings.freshnessAlerts, setFreshnessAlerts],
            ['유통기한 알림', settings.expiryAlerts, setExpiryAlerts],
          ].map(([label, value, setter]) => (
            <View key={label as string} style={[styles.between, { marginBottom: 12 }]}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{label as string}</Text>
              <Switch value={value as boolean} onValueChange={setter as (v: boolean) => void} />
            </View>
          ))}
        </View>
      )}

      {page === 'ai' && (
        <View style={{ marginTop: 18, gap: 14 }}>
          <View style={styles.card}>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }}>AI 서비스</Text>
            <Text style={styles.subtitle}>사진 분석과 다음 샷 조언에 사용할 서비스를 고릅니다.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {[
                ['none', '사용 안 함'],
                ['openai', 'OpenAI'],
                ['gemini', 'Gemini'],
              ].map(([value, label]) => (
                <TouchableOpacity key={value} style={[styles.ghostButton, { flexGrow: 1, flexBasis: 96 }, settings.aiProvider === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => settings.setAiProvider(value as AiProvider)}>
                  <Text style={styles.ghostText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedProvider !== 'none' && (
            <>
              {renderKeyManager(selectedProvider)}
              <TouchableOpacity style={styles.ghostButton} onPress={() => setModelsOpen(prev => !prev)}>
                <MaterialIcons name="tune" size={18} color={colors.text} />
                <Text style={styles.ghostText}>고급 모델 설정 {modelsOpen ? '접기' : '열기'}</Text>
              </TouchableOpacity>
              {modelsOpen && (
                <View style={[styles.card, { gap: 12 }]}>
                  <Text style={{ color: colors.text, fontWeight: '900' }}>AI 모델</Text>
                  <TextInput
                    style={styles.input}
                    value={selectedProvider === 'openai' ? settings.openAiModel : settings.geminiModel}
                    onChangeText={selectedProvider === 'openai' ? settings.setOpenAiModel : settings.setGeminiModel}
                    placeholder={selectedProvider === 'openai' ? 'gpt-5-mini' : 'gemini-2.5-flash'}
                    placeholderTextColor={colors.textTertiary}
                  />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {(selectedProvider === 'openai' ? openAiModelPresets : geminiModelPresets).map(preset => renderPreset(
                      preset,
                      (selectedProvider === 'openai' ? settings.openAiModel : settings.geminiModel) === preset.id,
                      () => selectedProvider === 'openai' ? settings.setOpenAiModel(preset.id) : settings.setGeminiModel(preset.id)
                    ))}
                  </View>
                  <Text style={styles.small}>비용은 사용하는 AI 서비스의 API 요금 정책을 따릅니다. 정확한 비용은 각 서비스 계정에서 확인해 주세요.</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {page === 'support' && (
        <View style={[styles.card, { marginTop: 18 }]}>
          <View style={styles.between}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>디버그 정보 표시</Text>
              <Text style={styles.subtitle}>문제 해결이 필요할 때만 켜세요. 일반 화면에는 내부 ID를 숨깁니다.</Text>
            </View>
            <Switch value={settings.showDebugInfo} onValueChange={settings.setShowDebugInfo} />
          </View>
        </View>
      )}

      {page === 'export' && (
        <View style={{ marginTop: 18 }}>
          <ExportContent compact />
        </View>
      )}
    </ScrollView>
  );
}
