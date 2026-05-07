import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BottomSheetModal, Field, TermHelpIcon, createCommonStyles } from '../../src/components';
import { darkColors, lightColors } from '../../src/constants/theme';
import { useCoffeeStore } from '../../src/store/coffeeStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { EquipmentProfile, ResourceGroup, ResourceLink } from '../../src/types/models';
import { emptyToNull } from '../../src/utils';

const blankEquipment = {
  name: '',
  brand: '',
  model: '',
  type: '에스프레소 머신',
  memo: '',
};

const blankGroup = {
  name: '',
  memo: '',
};

const blankLink = {
  title: '',
  url: '',
  memo: '',
};

const normalizeUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const aiTargets = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
};

const sourceIcon = (sourceType?: ResourceLink['sourceType'] | null) => {
  if (sourceType === 'youtube') return 'smart-display';
  if (sourceType === 'manual') return 'menu-book';
  if (sourceType === 'official') return 'verified';
  if (sourceType === 'community') return 'forum';
  return 'link';
};

const buildResourcePrompt = (equipment: EquipmentProfile | null, group: ResourceGroup, link: ResourceLink, question: string) => {
  const tags = (link.tag ?? '').split(',').map(tag => tag.trim()).filter(Boolean).join(', ') || '없음';
  const userQuestion = question.trim() || '이 자료에서 BES876 사용자가 헷갈리기 쉬운 핵심 내용과 실제로 어떻게 해야 하는지 알려줘.';
  return `너는 Breville BES876 / Barista Express Impress 사용을 도와주는 커피 장비 리서치 도우미야.

아래 자료 링크를 근거로 사용자의 질문에 답해줘. 가능하면 링크 내용을 직접 확인하고, 확인한 근거와 실제 사용 절차를 구분해서 한국어로 설명해줘.

## 사용자가 궁금한 것
${userQuestion}

## 참고 자료
- 장비: ${equipment ? [equipment.brand, equipment.model, equipment.name].filter(Boolean).join(' ') : 'Breville BES876'}
- 자료 그룹: ${group.name}
- 자료 제목: ${link.title}
- URL: ${link.url}
- 출처 유형: ${link.sourceType ?? '미분류'}
- 태그: ${tags}
- 날짜: ${link.publishedDate ?? '미입력'}
- 앱 메모: ${link.memo ?? '없음'}

## 답변 방식
1. 먼저 이 링크에서 확인한 근거를 짧게 요약해줘.
2. 사용자가 실제로 해야 할 순서를 단계별로 알려줘.
3. AUTO/MANUAL, 청소/디스케일, 도징/추출처럼 헷갈릴 수 있는 용어가 있으면 구분해서 설명해줘.
4. 링크에 근거가 없거나 접근할 수 없으면 추측하지 말고, 어떤 부분을 확인하지 못했는지 말해줘.
5. 답 끝에 참고한 URL을 다시 적어줘.`;
};

export default function EquipmentScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const colors = useSettingsStore(s => s.isDarkMode) ? darkColors : lightColors;
  const styles = createCommonStyles(colors);
  const {
    equipment,
    resourceGroups,
    resourceLinks,
    selectedEquipmentId,
    selectEquipment,
    saveEquipment,
    removeEquipment,
    saveResourceGroup,
    removeResourceGroup,
    saveResourceLink,
    removeResourceLink,
  } = useCoffeeStore();
  const selected = equipment.find(item => item.id === selectedEquipmentId) ?? equipment[0] ?? null;
  const groups = useMemo(() => resourceGroups.filter(group => group.equipmentProfileId === selected?.id), [resourceGroups, selected?.id]);
  const [equipmentForm, setEquipmentForm] = useState(blankEquipment);
  const [isEditingEquipment, setIsEditingEquipment] = useState(false);
  const [groupForm, setGroupForm] = useState(blankGroup);
  const [linkFormByGroup, setLinkFormByGroup] = useState<Record<string, typeof blankLink>>({});
  const [aiQuestion, setAiQuestion] = useState('');
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [resourceQuery, setResourceQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<'all' | NonNullable<ResourceLink['sourceType']>>('all');
  const [questionOpen, setQuestionOpen] = useState(false);
  const [resourceAdminOpen, setResourceAdminOpen] = useState(false);
  const [activeResource, setActiveResource] = useState<{ group: ResourceGroup; link: ResourceLink } | null>(null);

  useEffect(() => {
    if (!selected) {
      setEquipmentForm(blankEquipment);
      return;
    }
    setIsEditingEquipment(false);
    setEquipmentForm({
      name: selected.name,
      brand: selected.brand ?? '',
      model: selected.model ?? '',
      type: selected.type ?? '',
      memo: selected.memo ?? '',
    });
  }, [selected?.id]);

  const patchEquipment = (key: keyof typeof blankEquipment, value: string) => setEquipmentForm(prev => ({ ...prev, [key]: value }));
  const patchGroup = (key: keyof typeof blankGroup, value: string) => setGroupForm(prev => ({ ...prev, [key]: value }));
  const patchLink = (groupId: string, key: keyof typeof blankLink, value: string) => {
    setLinkFormByGroup(prev => ({ ...prev, [groupId]: { ...(prev[groupId] ?? blankLink), [key]: value } }));
  };

  const handleSaveEquipment = async () => {
    if (!equipmentForm.name.trim()) {
      Alert.alert('장비명 필요', '장비 이름은 필수입니다.');
      return;
    }
    await saveEquipment({
      id: selected?.id,
      name: equipmentForm.name.trim(),
      brand: emptyToNull(equipmentForm.brand),
      model: emptyToNull(equipmentForm.model),
      type: emptyToNull(equipmentForm.type),
      memo: emptyToNull(equipmentForm.memo),
    });
    setIsEditingEquipment(false);
    Alert.alert('저장 완료', '장비 정보를 저장했습니다.');
  };

  const handleSaveGroup = async () => {
    if (!selected) {
      Alert.alert('장비 필요', '먼저 장비를 등록하세요.');
      return;
    }
    if (!groupForm.name.trim()) {
      Alert.alert('그룹명 필요', '예: 세척, 소모품, 사용법');
      return;
    }
    await saveResourceGroup({
      equipmentProfileId: selected.id,
      name: groupForm.name.trim(),
      memo: emptyToNull(groupForm.memo),
      sortOrder: groups.length,
    });
    setGroupForm(blankGroup);
  };

  const handleSaveLink = async (group: ResourceGroup) => {
    const form = linkFormByGroup[group.id] ?? blankLink;
    const url = normalizeUrl(form.url);
    if (!form.title.trim() || !url) {
      Alert.alert('링크 정보 필요', '제목과 URL을 입력하세요.');
      return;
    }
    await saveResourceLink({
      groupId: group.id,
      title: form.title.trim(),
      url,
      memo: emptyToNull(form.memo),
    });
    setLinkFormByGroup(prev => ({ ...prev, [group.id]: blankLink }));
  };

  const openLink = async (url: string) => {
    const target = normalizeUrl(url);
    const supported = await Linking.canOpenURL(target);
    if (!supported) {
      Alert.alert('링크 열기 실패', '이 URL을 열 수 없습니다.');
      return;
    }
    await Linking.openURL(target);
  };

  const copyResourceAiPrompt = async (group: ResourceGroup, link: ResourceLink, target?: keyof typeof aiTargets) => {
    const prompt = buildResourcePrompt(selected, group, link, aiQuestion);
    await Clipboard.setStringAsync(prompt);
    if (target) {
      await Linking.openURL(aiTargets[target]);
      Alert.alert('프롬프트 복사 완료', `${target === 'chatgpt' ? 'ChatGPT' : 'Gemini'}가 열리면 입력창에 붙여넣으세요. 로그인은 해당 서비스 계정이 필요합니다.`);
      return;
    }
    Alert.alert('AI 질문 프롬프트 복사 완료', 'ChatGPT나 Gemini에 붙여넣으면 이 자료 링크를 근거로 답을 받을 수 있습니다.');
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>장비</Text>
      <Text style={styles.subtitle}>현재 장비가 기록과 타이머에 어떤 영향을 주는지 확인합니다.</Text>

      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 14, marginTop: 18 }}>
        <View style={{ flex: 1 }}>
          <View style={styles.card}>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 21, fontWeight: '900' }}>{selected ? selected.name : '장비 없음'}</Text>
                <Text style={styles.subtitle}>{selected ? [selected.brand, selected.model].filter(Boolean).join(' ') || selected.type || '장비 정보 미입력' : '새 장비를 등록하거나 BES876 기본 자료를 확인하세요.'}</Text>
              </View>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setEquipmentPickerOpen(true)}>
                <MaterialIcons name="swap-horiz" size={18} color={colors.text} />
                <Text style={styles.ghostText}>장비 변경</Text>
              </TouchableOpacity>
            </View>
            <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 12, marginTop: 12, gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '900' }}>기록/타이머에서 사용됨</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Text style={[styles.small, { flex: 1 }]}>{selected?.model?.toUpperCase().includes('BES876') || selected?.name.toUpperCase().includes('BES876') ? 'BES876 도징 보조, 1-25 분쇄도, 첫 방울/프리인퓨전 기록을 사용합니다.' : '일반 장비로 보고 수동 도징과 기본 레시피 중심으로 기록합니다.'}</Text>
                <TermHelpIcon glossaryIds={['auto_manual_dosing', 'dose_gauge', 'pressure_gauge', 'a_bit_more', 'razor_trim']} recordingMode="guided" colors={colors} />
              </View>
              <Text style={styles.small}>자료 그룹 {groups.length}개 · 링크 {resourceLinks.filter(link => groups.some(group => group.id === link.groupId)).length}개</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setIsEditingEquipment(true)}>
                <MaterialIcons name="edit" size={18} color={colors.text} />
                <Text style={styles.ghostText}>장비 수정</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={() => setQuestionOpen(true)}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.text} />
                <Text style={styles.ghostText}>장비 사용법 물어보기</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.sectionTitle}>빠른 도움말</Text>
          <View style={styles.card}>
            {['분쇄도 조정', '도징 방식', '청소 / 관리', '문제해결'].map(label => (
              <TouchableOpacity key={label} style={[styles.between, { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }]} onPress={() => setLibraryOpen(true)}>
                <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
                <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ flex: 1.25 }}>
          <Text style={styles.sectionTitle}>추천 자료</Text>
          <View style={[styles.card, { gap: 8 }]}>
            {groups.flatMap(group => resourceLinks.filter(link => link.groupId === group.id).slice(0, 2).map(link => ({ group, link }))).slice(0, 3).map(({ group, link }) => (
              <View key={link.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={sourceIcon(link.sourceType) as any} size={20} color={colors.primary} />
                </View>
                <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => openLink(link.url)}>
                  <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{link.title}</Text>
                  <Text style={styles.small} numberOfLines={1}>{group.name} · {link.sourceType ?? 'link'} · {link.publishedDate ?? '날짜 없음'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ghostButton, { minHeight: 36, paddingHorizontal: 10 }]} onPress={() => openLink(link.url)}>
                  <MaterialIcons name="open-in-new" size={18} color={colors.text} />
                  <Text style={styles.ghostText}>열기</Text>
                </TouchableOpacity>
                <TouchableOpacity accessibilityLabel="자료 더보기" style={[styles.ghostButton, { width: 38, minHeight: 36, paddingHorizontal: 0 }]} onPress={() => setActiveResource({ group, link })}>
                  <MaterialIcons name="more-horiz" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start' }]} onPress={() => setLibraryOpen(true)}>
              <Text style={styles.ghostText}>자료 전체 보기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <BottomSheetModal visible={equipmentPickerOpen} title="장비 변경" colors={colors} onClose={() => setEquipmentPickerOpen(false)}>
        <View style={{ gap: 10 }}>
          {equipment.map(item => (
            <TouchableOpacity key={item.id} style={[styles.card, { borderColor: item.id === selected?.id ? colors.primary : colors.border }]} onPress={() => { selectEquipment(item.id); setEquipmentPickerOpen(false); }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>{item.name}</Text>
              <Text style={styles.small}>{[item.brand, item.model].filter(Boolean).join(' ') || item.type || '장비 정보 미입력'}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.button} onPress={() => { selectEquipment(null); setEquipmentForm(blankEquipment); setIsEditingEquipment(true); setEquipmentPickerOpen(false); }}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.buttonText}>새 장비 추가</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={isEditingEquipment} title={selected ? '장비 수정' : '새 장비'} colors={colors} onClose={() => setIsEditingEquipment(false)}>
        <View style={{ gap: 10 }}>
          <Field label="장비명 *" value={equipmentForm.name} onChangeText={value => patchEquipment('name', value)} colors={colors} placeholder="예: Breville Barista Express" />
          <Field label="브랜드" value={equipmentForm.brand} onChangeText={value => patchEquipment('brand', value)} colors={colors} />
          <Field label="모델" value={equipmentForm.model} onChangeText={value => patchEquipment('model', value)} colors={colors} />
          <Field label="종류" value={equipmentForm.type} onChangeText={value => patchEquipment('type', value)} colors={colors} placeholder="에스프레소 머신, 그라인더" />
          <Field label="메모" value={equipmentForm.memo} onChangeText={value => patchEquipment('memo', value)} colors={colors} multiline />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TouchableOpacity style={styles.button} onPress={handleSaveEquipment}><Text style={styles.buttonText}>장비 저장</Text></TouchableOpacity>
            {selected && (
              <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger }]} onPress={() => Alert.alert('장비 삭제', '이 장비와 그룹/링크를 삭제할까요?', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => removeEquipment(selected.id) }])}>
                <Text style={[styles.ghostText, { color: colors.danger }]}>장비 삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={questionOpen} title="장비 사용법 물어보기" subtitle="자료 링크를 근거로 답을 받기 위한 프롬프트를 만듭니다." colors={colors} onClose={() => setQuestionOpen(false)}>
        <Field label="궁금한 점" value={aiQuestion} onChangeText={setAiQuestion} colors={colors} placeholder="예: CLEAN/DESCALE 등이 켜졌을 때 어떻게 구분해?" multiline />
        <Text style={styles.small}>자료 더보기에서 특정 링크의 더보기 메뉴를 열면 GPT/Gemini로 보낼 수 있습니다.</Text>
      </BottomSheetModal>

      <BottomSheetModal visible={libraryOpen} title="자료 전체 보기" colors={colors} onClose={() => setLibraryOpen(false)}>
        <View style={{ gap: 10, marginBottom: 12 }}>
          <TextInput
            style={styles.input}
            value={resourceQuery}
            onChangeText={setResourceQuery}
            placeholder="자료 제목, 태그, 메모 검색"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {([
              ['all', '전체'],
              ['official', '공식'],
              ['manual', '매뉴얼'],
              ['youtube', '영상'],
              ['community', '커뮤니티'],
              ['note', '노트'],
            ] as Array<[typeof resourceFilter, string]>).map(([value, label]) => (
              <TouchableOpacity key={value} style={[styles.ghostButton, resourceFilter === value && { borderColor: colors.primary, backgroundColor: colors.badge }]} onPress={() => setResourceFilter(value)}>
                <Text style={styles.ghostText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {groups.map(group => {
          const search = resourceQuery.trim().toLowerCase();
          const groupLinks = resourceLinks.filter(link => {
            if (link.groupId !== group.id) return false;
            if (resourceFilter !== 'all' && link.sourceType !== resourceFilter) return false;
            if (!search) return true;
            return [link.title, link.tag, link.memo, link.url].filter(Boolean).join(' ').toLowerCase().includes(search);
          });
          if (groupLinks.length === 0) return null;
          return (
            <View key={group.id} style={{ marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 }}>{group.name}</Text>
              {groupLinks.map(link => (
                <View key={link.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <MaterialIcons name={sourceIcon(link.sourceType) as any} size={20} color={colors.primary} />
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => openLink(link.url)}>
                    <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{link.title}</Text>
                    <Text style={styles.small} numberOfLines={1}>{link.sourceType ?? 'link'} · {(link.tag ?? '').split(',').slice(0, 2).join(', ') || '태그 없음'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => openLink(link.url)}><Text style={styles.ghostText}>열기</Text></TouchableOpacity>
                  <TouchableOpacity accessibilityLabel="자료 더보기" style={[styles.ghostButton, { width: 38, paddingHorizontal: 0 }]} onPress={() => setActiveResource({ group, link })}><MaterialIcons name="more-horiz" size={20} color={colors.text} /></TouchableOpacity>
                </View>
              ))}
            </View>
          );
        })}
        <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={() => setResourceAdminOpen(true)}>
          <MaterialIcons name="settings" size={18} color={colors.text} />
          <Text style={styles.ghostText}>자료 관리</Text>
        </TouchableOpacity>
      </BottomSheetModal>

      <BottomSheetModal visible={activeResource != null} title="자료 더보기" colors={colors} onClose={() => setActiveResource(null)}>
        {activeResource && (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{activeResource.link.title}</Text>
            <Text style={styles.subtitle}>{activeResource.group.name} · {activeResource.link.url}</Text>
            <TouchableOpacity style={styles.button} onPress={() => openLink(activeResource.link.url)}><Text style={styles.buttonText}>링크 열기</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={() => copyResourceAiPrompt(activeResource.group, activeResource.link)}><Text style={styles.ghostText}>프롬프트 복사</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={() => copyResourceAiPrompt(activeResource.group, activeResource.link, 'chatgpt')}><Text style={styles.ghostText}>ChatGPT로 열기</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ghostButton} onPress={() => copyResourceAiPrompt(activeResource.group, activeResource.link, 'gemini')}><Text style={styles.ghostText}>Gemini로 열기</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.ghostButton, { borderColor: colors.danger }]} onPress={() => Alert.alert('링크 삭제', '이 링크를 삭제할까요?', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => { removeResourceLink(activeResource.link.id); setActiveResource(null); } }])}>
              <Text style={[styles.ghostText, { color: colors.danger }]}>링크 삭제</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheetModal>

      <BottomSheetModal visible={resourceAdminOpen} title="자료 관리" subtitle="자료 추가/그룹 추가는 관리 화면에서만 다룹니다." colors={colors} onClose={() => setResourceAdminOpen(false)}>
        <Text style={styles.sectionTitle}>그룹 추가</Text>
        <View style={styles.card}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <Field label="그룹명" value={groupForm.name} onChangeText={value => patchGroup('name', value)} colors={colors} placeholder="예: 세척" />
              <Field label="그룹 메모" value={groupForm.memo} onChangeText={value => patchGroup('memo', value)} colors={colors} />
            </View>
            <TouchableOpacity style={[styles.ghostButton, { alignSelf: 'flex-start' }]} onPress={handleSaveGroup}>
              <MaterialIcons name="create-new-folder" size={18} color={colors.text} />
              <Text style={styles.ghostText}>그룹 만들기</Text>
            </TouchableOpacity>
          </View>
          {!selected && <Text style={styles.subtitle}>장비를 저장하면 그룹별 링크를 추가할 수 있습니다.</Text>}
          {selected && groups.length === 0 && <Text style={styles.subtitle}>아직 그룹이 없습니다. 세척 같은 그룹을 먼저 추가하세요.</Text>}
          {groups.map(group => {
            const groupLinks = resourceLinks.filter(link => link.groupId === group.id);
            const linkForm = linkFormByGroup[group.id] ?? blankLink;
            return (
              <View key={group.id} style={[styles.card, { marginBottom: 12, gap: 10 }]}>
                <View style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>{group.name}</Text>
                    {!!group.memo && <Text style={styles.subtitle}>{group.memo}</Text>}
                  </View>
                  <TouchableOpacity style={styles.ghostButton} onPress={() => Alert.alert('그룹 삭제', '그룹과 안의 링크를 삭제할까요?', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => removeResourceGroup(group.id) }])}>
                    <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>

                {groupLinks.map(link => (
                  <View key={link.id} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, padding: 10 }}>
                    <View style={styles.between}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name={sourceIcon(link.sourceType) as any} size={20} color={colors.primary} />
                        </View>
                        <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => openLink(link.url)}>
                          <Text style={{ color: colors.text, fontWeight: '900' }} numberOfLines={1}>{link.title}</Text>
                          <Text style={styles.small} numberOfLines={1}>{link.sourceType ?? 'link'} · {(link.tag ?? '').split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 2).join(', ') || '태그 없음'}</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity accessibilityLabel="자료 더보기" style={[styles.ghostButton, { width: 38, minHeight: 36, paddingHorizontal: 0 }]} onPress={() => setActiveResource({ group, link })}>
                        <MaterialIcons name="more-horiz" size={20} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <Field label="링크 제목" value={linkForm.title} onChangeText={value => patchLink(group.id, 'title', value)} colors={colors} placeholder="예: 백플러시 방법" />
                  <Field label="URL" value={linkForm.url} onChangeText={value => patchLink(group.id, 'url', value)} colors={colors} placeholder="https://..." />
                  <Field label="메모" value={linkForm.memo} onChangeText={value => patchLink(group.id, 'memo', value)} colors={colors} />
                </View>
                <TouchableOpacity style={[styles.button, { alignSelf: 'flex-start' }]} onPress={() => handleSaveLink(group)}>
                  <MaterialIcons name="link" size={18} color="#fff" />
                  <Text style={styles.buttonText}>링크 추가</Text>
                </TouchableOpacity>
              </View>
            );
          })}
      </BottomSheetModal>
    </ScrollView>
  );
}
