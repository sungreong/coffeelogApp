import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AiKeyMeta, AiKeyProvider, AiKeyTestStatus, AiProvider, CsvEncoding, RecordingMode, TermHelpVisibility } from '../types/models';
import type { GlossaryId } from '../constants/glossary';
import { createId, nowIso } from '../utils';

const OPENAI_KEY = 'coffeelog_openai_key';
const GEMINI_KEY = 'coffeelog_gemini_key';
const apiKeySecureStoreKey = (id: string) => `coffeelog_api_key_${id}`;

const legacyKeyForProvider = (provider: AiKeyProvider) => provider === 'openai' ? OPENAI_KEY : GEMINI_KEY;
const defaultLabelForProvider = (provider: AiKeyProvider) => provider === 'openai' ? '기본 OpenAI 키' : '기본 Gemini 키';
const maskKey = (key: string) => {
  const trimmed = key.trim();
  if (!trimmed) return '키 없음';
  return `•••• ${trimmed.slice(-4)}`;
};

interface SettingsState {
  isDarkMode: boolean;
  aiProvider: AiProvider;
  aiKeys: AiKeyMeta[];
  openAiModel: string;
  geminiModel: string;
  csvEncoding: CsvEncoding;
  recordingMode: RecordingMode;
  termHelpVisibility: TermHelpVisibility;
  seenGlossaryIds: GlossaryId[];
  logCollapsedSections: Record<string, boolean>;
  showDebugInfo: boolean;
  expiryAlerts: boolean;
  freshnessAlerts: boolean;
  openedAlerts: boolean;
  roastAlerts: boolean;
  setDarkMode: (value: boolean) => void;
  setAiProvider: (value: AiProvider) => void;
  addApiKeyMeta: (meta: AiKeyMeta, activate: boolean) => void;
  activateApiKey: (provider: AiKeyProvider, id: string) => void;
  renameApiKey: (id: string, label: string) => void;
  removeApiKeyMeta: (id: string) => void;
  updateApiKeyTestStatus: (id: string, status: AiKeyTestStatus) => void;
  setOpenAiModel: (value: string) => void;
  setGeminiModel: (value: string) => void;
  setCsvEncoding: (value: CsvEncoding) => void;
  setRecordingMode: (value: RecordingMode) => void;
  setTermHelpVisibility: (value: TermHelpVisibility) => void;
  markGlossarySeen: (id: GlossaryId) => void;
  setLogSectionCollapsed: (section: string, value: boolean) => void;
  setShowDebugInfo: (value: boolean) => void;
  setExpiryAlerts: (value: boolean) => void;
  setFreshnessAlerts: (value: boolean) => void;
  setOpenedAlerts: (value: boolean) => void;
  setRoastAlerts: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      aiProvider: 'none',
      aiKeys: [],
      openAiModel: 'gpt-5-mini',
      geminiModel: 'gemini-2.5-flash',
      csvEncoding: 'utf8-bom',
      recordingMode: 'guided',
      termHelpVisibility: 'recommended',
      seenGlossaryIds: [],
      logCollapsedSections: {},
      showDebugInfo: false,
      expiryAlerts: true,
      freshnessAlerts: true,
      openedAlerts: true,
      roastAlerts: false,
      setDarkMode: (value) => set({ isDarkMode: value }),
      setAiProvider: (value) => set({ aiProvider: value }),
      addApiKeyMeta: (meta, activate) => set(state => ({
        aiKeys: [
          ...state.aiKeys.map(item => activate && item.provider === meta.provider ? { ...item, active: false } : item),
          { ...meta, active: activate || !state.aiKeys.some(item => item.provider === meta.provider && item.active) },
        ],
      })),
      activateApiKey: (provider, id) => set(state => ({
        aiKeys: state.aiKeys.map(item => item.provider === provider ? { ...item, active: item.id === id } : item),
      })),
      renameApiKey: (id, label) => set(state => ({
        aiKeys: state.aiKeys.map(item => item.id === id ? { ...item, label: label.trim() || item.label } : item),
      })),
      removeApiKeyMeta: (id) => set(state => {
        const removed = state.aiKeys.find(item => item.id === id);
        const remaining = state.aiKeys.filter(item => item.id !== id);
        if (!removed?.active) return { aiKeys: remaining };
        const replacement = remaining.find(item => item.provider === removed.provider);
        return {
          aiKeys: remaining.map(item => item.provider === removed.provider ? { ...item, active: item.id === replacement?.id } : item),
        };
      }),
      updateApiKeyTestStatus: (id, status) => set(state => ({
        aiKeys: state.aiKeys.map(item => item.id === id ? { ...item, lastTestStatus: status, lastTestedAt: nowIso() } : item),
      })),
      setOpenAiModel: (value) => set({ openAiModel: value }),
      setGeminiModel: (value) => set({ geminiModel: value }),
      setCsvEncoding: (value) => set({ csvEncoding: value }),
      setRecordingMode: (value) => set({ recordingMode: value }),
      setTermHelpVisibility: (value) => set({ termHelpVisibility: value }),
      markGlossarySeen: (id) => set(state => state.seenGlossaryIds.includes(id) ? state : { seenGlossaryIds: [...state.seenGlossaryIds, id] }),
      setLogSectionCollapsed: (section, value) => set(state => ({ logCollapsedSections: { ...state.logCollapsedSections, [section]: value } })),
      setShowDebugInfo: (value) => set({ showDebugInfo: value }),
      setExpiryAlerts: (value) => set({ expiryAlerts: value }),
      setFreshnessAlerts: (value) => set({ freshnessAlerts: value }),
      setOpenedAlerts: (value) => set({ openedAlerts: value }),
      setRoastAlerts: (value) => set({ roastAlerts: value }),
    }),
    {
      name: 'coffeelog-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getApiKey = async (provider: AiProvider) => {
  if (provider === 'none') return null;
  const active = useSettingsStore.getState().aiKeys.find(item => item.provider === provider && item.active);
  if (active) return SecureStore.getItemAsync(apiKeySecureStoreKey(active.id));
  return null;
};

export const saveApiKey = async (provider: AiProvider, key: string, label?: string, activate = false) => {
  if (provider === 'none') throw new Error('AI 제공자를 선택하세요.');
  const trimmed = key.trim();
  if (!trimmed) throw new Error('API Key를 입력하세요.');
  const now = nowIso();
  const meta: AiKeyMeta = {
    id: createId(),
    provider,
    label: label?.trim() || defaultLabelForProvider(provider),
    maskedKey: maskKey(trimmed),
    createdAt: now,
    lastTestedAt: null,
    lastTestStatus: 'untested',
    active: activate,
  };
  await SecureStore.setItemAsync(apiKeySecureStoreKey(meta.id), trimmed);
  useSettingsStore.getState().addApiKeyMeta(meta, activate);
  return meta;
};

export const deleteApiKey = async (provider: AiProvider) => {
  if (provider === 'none') return;
  const active = useSettingsStore.getState().aiKeys.find(item => item.provider === provider && item.active);
  if (!active) return;
  await deleteApiKeyById(active.id);
};

export const deleteApiKeyById = async (id: string) => {
  await SecureStore.deleteItemAsync(apiKeySecureStoreKey(id));
  useSettingsStore.getState().removeApiKeyMeta(id);
};

export const getApiKeyById = async (id: string) => SecureStore.getItemAsync(apiKeySecureStoreKey(id));

export const migrateLegacyApiKeys = async () => {
  const state = useSettingsStore.getState();
  for (const provider of ['openai', 'gemini'] as const) {
    if (state.aiKeys.some(item => item.provider === provider)) continue;
    const legacy = await SecureStore.getItemAsync(legacyKeyForProvider(provider));
    if (!legacy) continue;
    await saveApiKey(provider, legacy, defaultLabelForProvider(provider), true);
    await SecureStore.deleteItemAsync(legacyKeyForProvider(provider));
  }
};
