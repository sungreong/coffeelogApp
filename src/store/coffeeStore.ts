import { create } from 'zustand';
import {
  addBeanPhoto,
  addBrewLogPhoto,
  deleteBean,
  deleteBeanPhoto,
  deleteBrewLog,
  deleteBrewLogPhoto,
  deleteCoffeeProduct,
  deleteEquipmentProfile,
  deleteResourceGroup,
  deleteResourceLink,
  ensureBes876GuideSeed,
  getAiAnalyses,
  getBeanPhotos,
  getBrewLogPhotos,
  getBeans,
  getBrewLogs,
  getCoffeeProducts,
  getCoffeePurchaseLots,
  getDefaultSetting,
  getDefaultSettings,
  getEquipmentProfiles,
  getPhotoReferenceCount,
  getResourceGroups,
  getResourceLinks,
  getStats,
  upsertBean,
  upsertBrewLog,
  upsertCoffeeProduct,
  upsertCoffeePurchaseLot,
  upsertDefaultSetting,
  upsertEquipmentProfile,
  upsertResourceGroup,
  upsertResourceLink,
} from '../db/queries';
import { getBrewLogDoseGram, roundGram } from '../services/beanInventory';
import { deletePhotoFile } from '../services/photos';
import { syncCoffeeWidgets } from '../services/widgets';
import { Bean, BeanDefaultSetting, BeanPhoto, BrewLog, BrewLogPhoto, CoffeeStats, AiAnalysisResult, EquipmentProfile, PendingTimerResult, ResourceGroup, ResourceLink, CoffeeProduct, CoffeePurchaseLot } from '../types/models';

const defaultResourceGroups = ['세척', '소모품', '사용법', '문제해결'];

const syncWidgetsFromState = (state: CoffeeState) => {
  void syncCoffeeWidgets({
    beans: state.beans,
    coffeeProducts: state.coffeeProducts,
    purchaseLots: state.purchaseLots,
    logs: state.logs,
    selectedBeanId: state.selectedBeanId,
  });
};

const logLotId = (log: Pick<BrewLog, 'purchaseLotId' | 'beanId'>) => log.purchaseLotId ?? log.beanId;

const adjustCachedRemaining = async (lotId: string | null | undefined, deltaGram: number, lots: CoffeePurchaseLot[]) => {
  if (!lotId || deltaGram === 0) return;
  const lot = lots.find(item => item.id === lotId);
  if (!lot || lot.remainingWeightGram == null) return;
  await upsertCoffeePurchaseLot({
    ...lot,
    remainingWeightGram: roundGram(Math.max(0, lot.remainingWeightGram + deltaGram)),
  });
};

interface CoffeeState {
  beans: Bean[];
  coffeeProducts: CoffeeProduct[];
  purchaseLots: CoffeePurchaseLot[];
  logs: BrewLog[];
  photosByBean: Record<string, BeanPhoto[]>;
  photosByLog: Record<string, BrewLogPhoto[]>;
  settingsByBean: Record<string, BeanDefaultSetting | null>;
  analyses: AiAnalysisResult[];
  equipment: EquipmentProfile[];
  resourceGroups: ResourceGroup[];
  resourceLinks: ResourceLink[];
  stats: CoffeeStats | null;
  selectedBeanId: string | null;
  selectedEquipmentId: string | null;
  pendingTimerResult: PendingTimerResult | null;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  selectBean: (id: string | null) => void;
  setPendingTimerResult: (result: PendingTimerResult | null) => void;
  consumePendingTimerResult: () => PendingTimerResult | null;
  saveBean: (bean: Partial<Bean> & { name: string; id?: string }) => Promise<Bean>;
  saveCoffeeProduct: (product: Partial<CoffeeProduct> & { name: string; id?: string }) => Promise<CoffeeProduct>;
  savePurchaseLot: (lot: Partial<CoffeePurchaseLot> & { productId: string; id?: string }) => Promise<CoffeePurchaseLot>;
  removeBean: (id: string) => Promise<void>;
  removeCoffeeProduct: (id: string) => Promise<void>;
  loadBeanPhotos: (beanId: string) => Promise<void>;
  attachBeanPhoto: (beanId: string, photoUri: string, photoType?: string) => Promise<void>;
  removeBeanPhoto: (beanId: string, photoId: string) => Promise<void>;
  saveDefaultSetting: (setting: Omit<BeanDefaultSetting, 'id'> & { id?: string }) => Promise<void>;
  saveLog: (log: Partial<BrewLog> & { beanId: string }) => Promise<BrewLog>;
  removeLog: (id: string) => Promise<void>;
  loadBrewLogPhotos: (logId: string) => Promise<void>;
  attachBrewLogPhoto: (logId: string, photoUri: string, photoType?: BrewLogPhoto['photoType']) => Promise<void>;
  removeBrewLogPhoto: (logId: string, photoId: string) => Promise<void>;
  selectEquipment: (id: string | null) => void;
  saveEquipment: (equipment: Partial<EquipmentProfile> & { name: string; id?: string }) => Promise<EquipmentProfile>;
  removeEquipment: (id: string) => Promise<void>;
  saveResourceGroup: (group: Partial<ResourceGroup> & { equipmentProfileId: string; name: string; id?: string }) => Promise<ResourceGroup>;
  removeResourceGroup: (id: string) => Promise<void>;
  saveResourceLink: (link: Partial<ResourceLink> & { groupId: string; title: string; url: string; id?: string }) => Promise<ResourceLink>;
  removeResourceLink: (id: string) => Promise<void>;
  loadEquipmentResources: () => Promise<void>;
  loadStats: () => Promise<void>;
}

export const useCoffeeStore = create<CoffeeState>((set, get) => ({
  beans: [],
  coffeeProducts: [],
  purchaseLots: [],
  logs: [],
  photosByBean: {},
  photosByLog: {},
  settingsByBean: {},
  analyses: [],
  equipment: [],
  resourceGroups: [],
  resourceLinks: [],
  stats: null,
  selectedBeanId: null,
  selectedEquipmentId: null,
  pendingTimerResult: null,
  isHydrated: false,

  hydrate: async () => {
    await ensureBes876GuideSeed();
    const [beans, coffeeProducts, purchaseLots, logs, analyses, stats, settingsByBean, equipment, resourceGroups, resourceLinks] = await Promise.all([getBeans(), getCoffeeProducts(), getCoffeePurchaseLots(), getBrewLogs(), getAiAnalyses(), getStats(), getDefaultSettings(), getEquipmentProfiles(), getResourceGroups(), getResourceLinks()]);
    const selectedBeanId = beans[0]?.id ?? null;
    const selectedEquipmentId = equipment[0]?.id ?? null;
    set({ beans, coffeeProducts, purchaseLots, logs, analyses, stats, settingsByBean, equipment, resourceGroups, resourceLinks, selectedBeanId, selectedEquipmentId, isHydrated: true });
    syncWidgetsFromState(get());
    for (const bean of beans.slice(0, 8)) {
      void get().loadBeanPhotos(bean.id);
    }
  },

  selectBean: (id) => set({ selectedBeanId: id }),
  setPendingTimerResult: (result) => set({ pendingTimerResult: result }),
  consumePendingTimerResult: () => {
    const result = get().pendingTimerResult;
    set({ pendingTimerResult: null });
    return result;
  },

  saveBean: async (bean) => {
    const saved = await upsertBean(bean);
    const [beans, coffeeProducts, purchaseLots] = await Promise.all([getBeans(), getCoffeeProducts(), getCoffeePurchaseLots()]);
    const logs = await getBrewLogs();
    set({ beans, coffeeProducts, purchaseLots, logs, selectedBeanId: saved.id });
    await get().loadStats();
    syncWidgetsFromState(get());
    return saved;
  },

  saveCoffeeProduct: async (product) => {
    const saved = await upsertCoffeeProduct(product);
    const [coffeeProducts, beans] = await Promise.all([getCoffeeProducts(), getBeans()]);
    set({ coffeeProducts, beans });
    syncWidgetsFromState(get());
    return saved;
  },

  savePurchaseLot: async (lot) => {
    const saved = await upsertCoffeePurchaseLot(lot);
    const [purchaseLots, beans, coffeeProducts, logs] = await Promise.all([getCoffeePurchaseLots(), getBeans(), getCoffeeProducts(), getBrewLogs()]);
    set({ purchaseLots, beans, coffeeProducts, logs, selectedBeanId: saved.id });
    await get().loadStats();
    syncWidgetsFromState(get());
    return saved;
  },

  removeBean: async (id) => {
    const [beanPhotos, beanLogs] = await Promise.all([getBeanPhotos(id), getBrewLogs(id)]);
    await deleteBean(id);
    const deletedUris = [...beanPhotos.map(photo => photo.photoUri), ...beanLogs.map(log => log.photoUri)].filter(Boolean) as string[];
    await Promise.all([...new Set(deletedUris)].map(async (uri) => {
      if ((await getPhotoReferenceCount(uri)) === 0) await deletePhotoFile(uri);
    }));
    const [beans, coffeeProducts, purchaseLots, logs] = await Promise.all([getBeans(), getCoffeeProducts(), getCoffeePurchaseLots(), getBrewLogs()]);
    set({ beans, coffeeProducts, purchaseLots, logs, selectedBeanId: beans[0]?.id ?? null });
    await get().loadStats();
    syncWidgetsFromState(get());
  },

  removeCoffeeProduct: async (id) => {
    const productLots = get().purchaseLots.filter(lot => lot.productId === id);
    const productBeans = get().beans.filter(bean => bean.productId === id);
    const lotIds = [...new Set([...productLots.map(lot => lot.id), ...productBeans.map(bean => bean.id)])];
    const [lotPhotos, lotLogs] = await Promise.all([
      Promise.all(lotIds.map(lotId => getBeanPhotos(lotId))),
      Promise.all(lotIds.map(lotId => getBrewLogs(lotId))),
    ]);
    const flatLogs = lotLogs.flat();
    const logPhotos = await Promise.all(flatLogs.map(log => getBrewLogPhotos(log.id)));
    const deletedUris = [
      ...productLots.map(lot => lot.mainPhotoUri),
      ...productBeans.map(bean => bean.mainPhotoUri),
      ...lotPhotos.flat().map(photo => photo.photoUri),
      ...flatLogs.map(log => log.photoUri),
      ...logPhotos.flat().map(photo => photo.photoUri),
    ].filter(Boolean) as string[];
    await deleteCoffeeProduct(id);
    await Promise.all([...new Set(deletedUris)].map(async (uri) => {
      if ((await getPhotoReferenceCount(uri)) === 0) await deletePhotoFile(uri);
    }));
    const [beans, coffeeProducts, purchaseLots, logs] = await Promise.all([getBeans(), getCoffeeProducts(), getCoffeePurchaseLots(), getBrewLogs()]);
    set({ beans, coffeeProducts, purchaseLots, logs, selectedBeanId: beans[0]?.id ?? null });
    await get().loadStats();
    syncWidgetsFromState(get());
  },

  loadBeanPhotos: async (beanId) => {
    const photos = await getBeanPhotos(beanId);
    set(state => ({ photosByBean: { ...state.photosByBean, [beanId]: photos } }));
  },

  attachBeanPhoto: async (beanId, photoUri, photoType = 'bean_bag') => {
    await addBeanPhoto(beanId, photoUri, photoType);
    const [beans, purchaseLots] = await Promise.all([getBeans(), getCoffeePurchaseLots()]);
    set({ beans, purchaseLots });
    await get().loadBeanPhotos(beanId);
  },

  removeBeanPhoto: async (beanId, photoId) => {
    const deletedUri = await deleteBeanPhoto(photoId, beanId);
    if ((await getPhotoReferenceCount(deletedUri)) === 0) await deletePhotoFile(deletedUri);
    const [beans, purchaseLots] = await Promise.all([getBeans(), getCoffeePurchaseLots()]);
    set({ beans, purchaseLots });
    await get().loadBeanPhotos(beanId);
  },

  saveDefaultSetting: async (setting) => {
    await upsertDefaultSetting(setting);
    const saved = await getDefaultSetting(setting.beanId);
    set(state => ({ settingsByBean: { ...state.settingsByBean, [setting.beanId]: saved } }));
  },

  saveLog: async (log) => {
    const currentLogs = get().logs;
    const existingLog = log.id
      ? currentLogs.find(item => item.id === log.id) ?? (await getBrewLogs()).find(item => item.id === log.id) ?? null
      : null;
    const saved = await upsertBrewLog(log);
    const lotsForAdjustment = await getCoffeePurchaseLots();
    const savedLotId = logLotId(saved);
    const savedDose = getBrewLogDoseGram(saved);
    if (existingLog) {
      const previousLotId = logLotId(existingLog);
      const previousDose = getBrewLogDoseGram(existingLog);
      if (previousLotId === savedLotId) {
        await adjustCachedRemaining(savedLotId, previousDose - savedDose, lotsForAdjustment);
      } else {
        await adjustCachedRemaining(previousLotId, previousDose, lotsForAdjustment);
        await adjustCachedRemaining(savedLotId, -savedDose, lotsForAdjustment);
      }
    } else {
      await adjustCachedRemaining(savedLotId, -savedDose, lotsForAdjustment);
    }
    const [logs, beans, purchaseLots, coffeeProducts] = await Promise.all([getBrewLogs(), getBeans(), getCoffeePurchaseLots(), getCoffeeProducts()]);
    set({ logs, beans, purchaseLots, coffeeProducts });
    await get().loadStats();
    syncWidgetsFromState(get());
    return saved;
  },

  removeLog: async (id) => {
    const deletedLog = get().logs.find(log => log.id === id) ?? (await getBrewLogs()).find(log => log.id === id);
    const logPhotos = await getBrewLogPhotos(id);
    await deleteBrewLog(id);
    if (deletedLog) {
      const lotsForAdjustment = await getCoffeePurchaseLots();
      await adjustCachedRemaining(logLotId(deletedLog), getBrewLogDoseGram(deletedLog), lotsForAdjustment);
    }
    const deletedUris = [deletedLog?.photoUri, ...logPhotos.map(photo => photo.photoUri)].filter(Boolean) as string[];
    await Promise.all([...new Set(deletedUris)].map(async (uri) => {
      if ((await getPhotoReferenceCount(uri)) === 0) await deletePhotoFile(uri);
    }));
    const [logs, beans, purchaseLots, coffeeProducts] = await Promise.all([getBrewLogs(), getBeans(), getCoffeePurchaseLots(), getCoffeeProducts()]);
    set({ logs, beans, purchaseLots, coffeeProducts });
    await get().loadStats();
    syncWidgetsFromState(get());
  },

  loadBrewLogPhotos: async (logId) => {
    const photos = await getBrewLogPhotos(logId);
    set(state => ({ photosByLog: { ...state.photosByLog, [logId]: photos } }));
  },

  attachBrewLogPhoto: async (logId, photoUri, photoType = 'espresso_result') => {
    await addBrewLogPhoto(logId, photoUri, photoType);
    await get().loadBrewLogPhotos(logId);
  },

  removeBrewLogPhoto: async (logId, photoId) => {
    const deletedUri = await deleteBrewLogPhoto(photoId);
    if ((await getPhotoReferenceCount(deletedUri)) === 0) await deletePhotoFile(deletedUri);
    await get().loadBrewLogPhotos(logId);
  },

  selectEquipment: (id) => set({ selectedEquipmentId: id }),

  saveEquipment: async (equipment) => {
    const saved = await upsertEquipmentProfile(equipment);
    const existingGroups = await getResourceGroups(saved.id);
    if (existingGroups.length === 0) {
      await Promise.all(defaultResourceGroups.map((name, index) => upsertResourceGroup({ equipmentProfileId: saved.id, name, sortOrder: index })));
    }
    await get().loadEquipmentResources();
    set({ selectedEquipmentId: saved.id });
    return saved;
  },

  removeEquipment: async (id) => {
    await deleteEquipmentProfile(id);
    await get().loadEquipmentResources();
    const equipment = get().equipment;
    set({ selectedEquipmentId: equipment[0]?.id ?? null });
  },

  saveResourceGroup: async (group) => {
    const saved = await upsertResourceGroup(group);
    await get().loadEquipmentResources();
    return saved;
  },

  removeResourceGroup: async (id) => {
    await deleteResourceGroup(id);
    await get().loadEquipmentResources();
  },

  saveResourceLink: async (link) => {
    const saved = await upsertResourceLink(link);
    await get().loadEquipmentResources();
    return saved;
  },

  removeResourceLink: async (id) => {
    await deleteResourceLink(id);
    await get().loadEquipmentResources();
  },

  loadEquipmentResources: async () => {
    const [equipment, resourceGroups, resourceLinks] = await Promise.all([getEquipmentProfiles(), getResourceGroups(), getResourceLinks()]);
    set({ equipment, resourceGroups, resourceLinks });
  },

  loadStats: async () => {
    const stats = await getStats();
    set({ stats });
  },
}));
