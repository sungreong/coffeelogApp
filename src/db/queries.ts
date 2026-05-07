import { Bean, BeanDefaultSetting, BeanPhoto, BrewLog, BrewLogPhoto, CoffeeStats, AiAnalysisResult, EquipmentProfile, ResourceGroup, ResourceLink, CoffeeProduct, CoffeePurchaseLot } from '../types/models';
import { createId, nowIso } from '../utils';
import { getDb } from './schema';

type BeanRow = {
  id: string; product_id: string | null; name: string; roastery: string | null; origin: string | null; variety: string | null; process: string | null;
  roast_level: string | null; purchase_date: string | null; roast_date: string | null; opened_date: string | null;
  expiry_date: string | null; storage_type: string | null; memo: string | null; main_photo_uri: string | null;
  initial_weight_gram: number | null; remaining_weight_gram: number | null; lot_status: Bean['lotStatus']; seller: string | null; price: number | null; lot_memo: string | null;
  created_at: string; updated_at: string;
};

type ProductRow = {
  id: string; name: string; roastery: string | null; origin: string | null; variety: string | null; process: string | null;
  roast_level: string | null; tasting_notes: string | null; user_status: CoffeeProduct['userStatus']; memo: string | null; created_at: string; updated_at: string;
};

type PurchaseLotRow = {
  id: string; product_id: string; product_name?: string; roastery?: string | null; origin?: string | null; variety?: string | null; process?: string | null; roast_level?: string | null;
  purchase_date: string | null; roast_date: string | null; opened_date: string | null; expiry_date: string | null; storage_type: string | null;
  initial_weight_gram: number | null; remaining_weight_gram: number | null; lot_status: CoffeePurchaseLot['lotStatus'];
  seller: string | null; price: number | null; lot_memo: string | null; main_photo_uri: string | null; created_at: string; updated_at: string;
};

type LogRow = {
  id: string; bean_id: string; purchase_lot_id: string | null; bean_name?: string; roastery?: string | null; equipment_profile_id: string | null; brewed_at: string;
  recording_mode_used: BrewLog['recordingModeUsed']; drink_type: string | null; dose_mode: BrewLog['doseMode']; basket_type: BrewLog['basketType']; shot_button: BrewLog['shotButton'];
  grind_size: string | null; grind_size_external: number | null; inner_burr_setting: number | null; speed: string | null;
  grind_seconds: number | null; actual_dose_gram: number | null; dose_gram: number | null; yield_gram: number | null;
  brew_seconds: number | null; first_drip_seconds: number | null; time_measurement_source: BrewLog['timeMeasurementSource']; water_temperature: number | null; temperature_offset: number | null;
  preinfusion: number; rating: number | null; preinfusion_seconds: number | null; basket: string | null;
  dose_level: BrewLog['doseLevel']; pressure_zone: BrewLog['pressureZone']; used_a_bit_more: number; used_razor_trim: number;
  auto_dose_reset_done: number; programmed_volume_changed: number; next_action: BrewLog['nextAction'];
  puck_prep: string | null; tamping: string | null; channeling: string | null;
  shot_result: string | null; water_ml: number | null; milk_ml: number | null; serving_temperature: string | null;
  acidity: number | null; sweetness: number | null; bitterness: number | null; body: number | null; is_favorite: number;
  result_memo: string | null; photo_uri: string | null; created_at: string; updated_at: string;
};

type EquipmentRow = {
  id: string; name: string; type: string | null; brand: string | null; model: string | null; memo: string | null;
};

type ResourceGroupRow = {
  id: string; equipment_profile_id: string; name: string; memo: string | null; sort_order: number; created_at: string; updated_at: string;
};

type ResourceLinkRow = {
  id: string; group_id: string; title: string; url: string; memo: string | null; tag: string | null; source_type: ResourceLink['sourceType'] | null; published_date: string | null; created_at: string; updated_at: string;
};

const mapBean = (r: BeanRow): Bean => ({
  id: r.id,
  productId: r.product_id,
  name: r.name,
  roastery: r.roastery,
  origin: r.origin,
  variety: r.variety,
  process: r.process,
  roastLevel: r.roast_level,
  purchaseDate: r.purchase_date,
  roastDate: r.roast_date,
  openedDate: r.opened_date,
  expiryDate: r.expiry_date,
  storageType: r.storage_type,
  initialWeightGram: r.initial_weight_gram,
  remainingWeightGram: r.remaining_weight_gram,
  lotStatus: r.lot_status ?? 'open',
  seller: r.seller,
  price: r.price,
  lotMemo: r.lot_memo,
  memo: r.memo,
  mainPhotoUri: r.main_photo_uri,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapProduct = (r: ProductRow): CoffeeProduct => ({
  id: r.id,
  name: r.name,
  roastery: r.roastery,
  origin: r.origin,
  variety: r.variety,
  process: r.process,
  roastLevel: r.roast_level,
  tastingNotes: r.tasting_notes,
  userStatus: r.user_status ?? 'normal',
  memo: r.memo,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapPurchaseLot = (r: PurchaseLotRow): CoffeePurchaseLot => ({
  id: r.id,
  productId: r.product_id,
  purchaseDate: r.purchase_date,
  roastDate: r.roast_date,
  openedDate: r.opened_date,
  expiryDate: r.expiry_date,
  storageType: r.storage_type,
  initialWeightGram: r.initial_weight_gram,
  remainingWeightGram: r.remaining_weight_gram,
  lotStatus: r.lot_status ?? 'open',
  seller: r.seller,
  price: r.price,
  lotMemo: r.lot_memo,
  mainPhotoUri: r.main_photo_uri,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const lotRowToBean = (r: PurchaseLotRow): Bean => ({
  id: r.id,
  productId: r.product_id,
  name: r.product_name ?? '원두',
  roastery: r.roastery ?? null,
  origin: r.origin ?? null,
  variety: r.variety ?? null,
  process: r.process ?? null,
  roastLevel: r.roast_level ?? null,
  purchaseDate: r.purchase_date,
  roastDate: r.roast_date,
  openedDate: r.opened_date,
  expiryDate: r.expiry_date,
  storageType: r.storage_type,
  initialWeightGram: r.initial_weight_gram,
  remainingWeightGram: r.remaining_weight_gram,
  lotStatus: r.lot_status ?? 'open',
  seller: r.seller,
  price: r.price,
  lotMemo: r.lot_memo,
  memo: r.lot_memo,
  mainPhotoUri: r.main_photo_uri,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapLog = (r: LogRow): BrewLog => ({
  id: r.id,
  beanId: r.bean_id,
  purchaseLotId: r.purchase_lot_id ?? r.bean_id,
  beanName: r.bean_name,
  roastery: r.roastery,
  equipmentProfileId: r.equipment_profile_id,
  brewedAt: r.brewed_at,
  recordingModeUsed: r.recording_mode_used,
  drinkType: r.drink_type,
  doseMode: r.dose_mode,
  basketType: r.basket_type,
  shotButton: r.shot_button,
  grindSize: r.grind_size,
  grindSizeExternal: r.grind_size_external,
  innerBurrSetting: r.inner_burr_setting,
  speed: r.speed,
  grindSeconds: r.grind_seconds,
  actualDoseGram: r.actual_dose_gram,
  doseGram: r.dose_gram,
  yieldGram: r.yield_gram,
  brewSeconds: r.brew_seconds,
  firstDripSeconds: r.first_drip_seconds,
  timeMeasurementSource: r.time_measurement_source,
  waterTemperature: r.water_temperature,
  temperatureOffset: r.temperature_offset,
  preinfusion: r.preinfusion === 1,
  preinfusionSeconds: r.preinfusion_seconds,
  basket: r.basket,
  doseLevel: r.dose_level,
  pressureZone: r.pressure_zone,
  usedABitMore: r.used_a_bit_more === 1,
  usedRazorTrim: r.used_razor_trim === 1,
  autoDoseResetDone: r.auto_dose_reset_done === 1,
  programmedVolumeChanged: r.programmed_volume_changed === 1,
  nextAction: r.next_action,
  puckPrep: r.puck_prep,
  tamping: r.tamping,
  channeling: r.channeling,
  shotResult: r.shot_result,
  waterMl: r.water_ml,
  milkMl: r.milk_ml,
  servingTemperature: r.serving_temperature,
  rating: r.rating,
  acidity: r.acidity,
  sweetness: r.sweetness,
  bitterness: r.bitterness,
  body: r.body,
  isFavorite: r.is_favorite === 1,
  resultMemo: r.result_memo,
  photoUri: r.photo_uri,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapEquipment = (r: EquipmentRow): EquipmentProfile => ({
  id: r.id,
  name: r.name,
  type: r.type,
  brand: r.brand,
  model: r.model,
  memo: r.memo,
});

const mapResourceGroup = (r: ResourceGroupRow): ResourceGroup => ({
  id: r.id,
  equipmentProfileId: r.equipment_profile_id,
  name: r.name,
  memo: r.memo,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapResourceLink = (r: ResourceLinkRow): ResourceLink => ({
  id: r.id,
  groupId: r.group_id,
  title: r.title,
  url: r.url,
  memo: r.memo,
  tag: r.tag,
  sourceType: r.source_type,
  publishedDate: r.published_date,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const getBeans = async (): Promise<Bean[]> => {
  const db = await getDb();
  const lotRows = await db.getAllAsync<PurchaseLotRow>(
    `SELECT CoffeePurchaseLots.*, CoffeeProducts.name AS product_name, CoffeeProducts.roastery, CoffeeProducts.origin, CoffeeProducts.variety, CoffeeProducts.process, CoffeeProducts.roast_level
     FROM CoffeePurchaseLots JOIN CoffeeProducts ON CoffeeProducts.id = CoffeePurchaseLots.product_id
     ORDER BY CoffeePurchaseLots.updated_at DESC`
  );
  if (lotRows.length) return lotRows.map(lotRowToBean);
  const rows = await db.getAllAsync<BeanRow>('SELECT * FROM Beans ORDER BY updated_at DESC');
  return rows.map(mapBean);
};

export const getCoffeeProducts = async (): Promise<CoffeeProduct[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<ProductRow>('SELECT * FROM CoffeeProducts ORDER BY updated_at DESC');
  return rows.map(mapProduct);
};

export const getCoffeePurchaseLots = async (productId?: string): Promise<CoffeePurchaseLot[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<PurchaseLotRow>(
    `SELECT * FROM CoffeePurchaseLots ${productId ? 'WHERE product_id = ?' : ''} ORDER BY COALESCE(purchase_date, created_at) DESC`,
    productId ? [productId] : []
  );
  return rows.map(mapPurchaseLot);
};

export const upsertCoffeeProduct = async (product: Partial<CoffeeProduct> & { name: string; id?: string }): Promise<CoffeeProduct> => {
  const db = await getDb();
  const now = nowIso();
  const saved: CoffeeProduct = {
    id: product.id ?? createId(),
    name: product.name,
    roastery: product.roastery ?? null,
    origin: product.origin ?? null,
    variety: product.variety ?? null,
    process: product.process ?? null,
    roastLevel: product.roastLevel ?? null,
    tastingNotes: product.tastingNotes ?? null,
    userStatus: product.userStatus ?? 'normal',
    memo: product.memo ?? null,
    createdAt: product.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO CoffeeProducts (id, name, roastery, origin, variety, process, roast_level, tasting_notes, user_status, memo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       roastery = excluded.roastery,
       origin = excluded.origin,
       variety = excluded.variety,
       process = excluded.process,
       roast_level = excluded.roast_level,
       tasting_notes = excluded.tasting_notes,
       user_status = excluded.user_status,
       memo = excluded.memo,
       updated_at = excluded.updated_at`,
    [saved.id, saved.name, saved.roastery, saved.origin, saved.variety, saved.process, saved.roastLevel, saved.tastingNotes, saved.userStatus, saved.memo, saved.createdAt, saved.updatedAt]
  );
  await db.runAsync(
    `UPDATE Beans SET
       name = ?,
       roastery = ?,
       origin = ?,
       variety = ?,
       process = ?,
       roast_level = ?,
       updated_at = ?
     WHERE product_id = ?`,
    [saved.name, saved.roastery, saved.origin, saved.variety, saved.process, saved.roastLevel, saved.updatedAt, saved.id]
  );
  return saved;
};

export const getBean = async (id: string): Promise<Bean | null> => {
  const db = await getDb();
  const lot = await db.getFirstAsync<PurchaseLotRow>(
    `SELECT CoffeePurchaseLots.*, CoffeeProducts.name AS product_name, CoffeeProducts.roastery, CoffeeProducts.origin, CoffeeProducts.variety, CoffeeProducts.process, CoffeeProducts.roast_level
     FROM CoffeePurchaseLots JOIN CoffeeProducts ON CoffeeProducts.id = CoffeePurchaseLots.product_id
     WHERE CoffeePurchaseLots.id = ?`,
    [id]
  );
  if (lot) return lotRowToBean(lot);
  const row = await db.getFirstAsync<BeanRow>('SELECT * FROM Beans WHERE id = ?', [id]);
  return row ? mapBean(row) : null;
};

export const upsertCoffeePurchaseLot = async (lot: Partial<CoffeePurchaseLot> & { productId: string; id?: string }): Promise<CoffeePurchaseLot> => {
  const db = await getDb();
  const now = nowIso();
  const saved: CoffeePurchaseLot = {
    id: lot.id ?? createId(),
    productId: lot.productId,
    purchaseDate: lot.purchaseDate ?? null,
    roastDate: lot.roastDate ?? null,
    openedDate: lot.openedDate ?? null,
    expiryDate: lot.expiryDate ?? null,
    storageType: lot.storageType ?? null,
    initialWeightGram: lot.initialWeightGram ?? null,
    remainingWeightGram: lot.remainingWeightGram ?? null,
    lotStatus: lot.lotStatus ?? (lot.openedDate ? 'open' : 'unopened'),
    seller: lot.seller ?? null,
    price: lot.price ?? null,
    lotMemo: lot.lotMemo ?? null,
    mainPhotoUri: lot.mainPhotoUri ?? null,
    createdAt: lot.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO CoffeePurchaseLots
     (id, product_id, purchase_date, roast_date, opened_date, expiry_date, storage_type, initial_weight_gram, remaining_weight_gram, lot_status, seller, price, lot_memo, main_photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       product_id = excluded.product_id,
       purchase_date = excluded.purchase_date,
       roast_date = excluded.roast_date,
       opened_date = excluded.opened_date,
       expiry_date = excluded.expiry_date,
       storage_type = excluded.storage_type,
       initial_weight_gram = excluded.initial_weight_gram,
       remaining_weight_gram = excluded.remaining_weight_gram,
       lot_status = excluded.lot_status,
       seller = excluded.seller,
       price = excluded.price,
       lot_memo = excluded.lot_memo,
       main_photo_uri = excluded.main_photo_uri,
       updated_at = excluded.updated_at`,
    [saved.id, saved.productId, saved.purchaseDate, saved.roastDate, saved.openedDate, saved.expiryDate, saved.storageType, saved.initialWeightGram, saved.remainingWeightGram, saved.lotStatus, saved.seller, saved.price, saved.lotMemo, saved.mainPhotoUri, saved.createdAt, saved.updatedAt]
  );
  const product = await db.getFirstAsync<ProductRow>('SELECT * FROM CoffeeProducts WHERE id = ?', [saved.productId]);
  if (product) {
    await db.runAsync(
      `INSERT INTO Beans
       (id, product_id, name, roastery, origin, variety, process, roast_level, purchase_date, roast_date, opened_date, expiry_date, storage_type, initial_weight_gram, remaining_weight_gram, lot_status, seller, price, lot_memo, memo, main_photo_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         product_id = excluded.product_id,
         name = excluded.name,
         roastery = excluded.roastery,
         origin = excluded.origin,
         variety = excluded.variety,
         process = excluded.process,
         roast_level = excluded.roast_level,
         purchase_date = excluded.purchase_date,
         roast_date = excluded.roast_date,
         opened_date = excluded.opened_date,
         expiry_date = excluded.expiry_date,
         storage_type = excluded.storage_type,
         initial_weight_gram = excluded.initial_weight_gram,
         remaining_weight_gram = excluded.remaining_weight_gram,
         lot_status = excluded.lot_status,
         seller = excluded.seller,
         price = excluded.price,
         lot_memo = excluded.lot_memo,
         memo = excluded.memo,
         main_photo_uri = excluded.main_photo_uri,
         updated_at = excluded.updated_at`,
      [saved.id, saved.productId, product.name, product.roastery, product.origin, product.variety, product.process, product.roast_level, saved.purchaseDate, saved.roastDate, saved.openedDate, saved.expiryDate, saved.storageType, saved.initialWeightGram, saved.remainingWeightGram, saved.lotStatus, saved.seller, saved.price, saved.lotMemo, saved.lotMemo, saved.mainPhotoUri, saved.createdAt, saved.updatedAt]
    );
  }
  return saved;
};

export const upsertBean = async (bean: Partial<Bean> & { name: string; id?: string }): Promise<Bean> => {
  const db = await getDb();
  const now = nowIso();
  let productId = bean.productId ?? null;
  if (!productId) {
    productId = createId();
  }
  if (!bean.productId) {
    await upsertCoffeeProduct({
      id: productId,
      name: bean.name,
      roastery: bean.roastery ?? null,
      origin: bean.origin ?? null,
      variety: bean.variety ?? null,
      process: bean.process ?? null,
      roastLevel: bean.roastLevel ?? null,
      tastingNotes: null,
      userStatus: 'normal',
      memo: bean.memo ?? null,
    });
  }
  const saved: Bean = {
    id: bean.id ?? createId(),
    productId,
    name: bean.name,
    roastery: bean.roastery ?? null,
    origin: bean.origin ?? null,
    variety: bean.variety ?? null,
    process: bean.process ?? null,
    roastLevel: bean.roastLevel ?? null,
    purchaseDate: bean.purchaseDate ?? null,
    roastDate: bean.roastDate ?? null,
    openedDate: bean.openedDate ?? null,
    expiryDate: bean.expiryDate ?? null,
    storageType: bean.storageType ?? null,
    initialWeightGram: bean.initialWeightGram ?? null,
    remainingWeightGram: bean.remainingWeightGram ?? null,
    lotStatus: bean.lotStatus ?? (bean.openedDate ? 'open' : 'unopened'),
    seller: bean.seller ?? null,
    price: bean.price ?? null,
    lotMemo: bean.lotMemo ?? null,
    memo: bean.memo ?? null,
    mainPhotoUri: bean.mainPhotoUri ?? null,
    createdAt: bean.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO Beans
     (id, product_id, name, roastery, origin, variety, process, roast_level, purchase_date, roast_date, opened_date, expiry_date, storage_type, initial_weight_gram, remaining_weight_gram, lot_status, seller, price, lot_memo, memo, main_photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       product_id = excluded.product_id,
       name = excluded.name,
       roastery = excluded.roastery,
       origin = excluded.origin,
       variety = excluded.variety,
       process = excluded.process,
       roast_level = excluded.roast_level,
       purchase_date = excluded.purchase_date,
       roast_date = excluded.roast_date,
       opened_date = excluded.opened_date,
       expiry_date = excluded.expiry_date,
       storage_type = excluded.storage_type,
       initial_weight_gram = excluded.initial_weight_gram,
       remaining_weight_gram = excluded.remaining_weight_gram,
       lot_status = excluded.lot_status,
       seller = excluded.seller,
       price = excluded.price,
       lot_memo = excluded.lot_memo,
       memo = excluded.memo,
       main_photo_uri = excluded.main_photo_uri,
       updated_at = excluded.updated_at`,
    [saved.id, saved.productId, saved.name, saved.roastery, saved.origin, saved.variety, saved.process, saved.roastLevel, saved.purchaseDate, saved.roastDate, saved.openedDate, saved.expiryDate, saved.storageType, saved.initialWeightGram, saved.remainingWeightGram, saved.lotStatus, saved.seller, saved.price, saved.lotMemo, saved.memo, saved.mainPhotoUri, saved.createdAt, saved.updatedAt]
  );
  await upsertCoffeePurchaseLot({
    id: saved.id,
    productId: saved.productId ?? productId,
    purchaseDate: saved.purchaseDate,
    roastDate: saved.roastDate,
    openedDate: saved.openedDate,
    expiryDate: saved.expiryDate,
    storageType: saved.storageType,
    initialWeightGram: saved.initialWeightGram,
    remainingWeightGram: saved.remainingWeightGram,
    lotStatus: saved.lotStatus,
    seller: saved.seller,
    price: saved.price,
    lotMemo: saved.lotMemo ?? saved.memo,
    mainPhotoUri: saved.mainPhotoUri,
    createdAt: saved.createdAt,
  });
  return saved;
};

export const deleteBean = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM CoffeePurchaseLots WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM Beans WHERE id = ?', [id]);
};

export const deleteCoffeeProduct = async (id: string) => {
  const db = await getDb();
  const lots = await db.getAllAsync<{ id: string }>('SELECT id FROM CoffeePurchaseLots WHERE product_id = ?', [id]);
  const beans = await db.getAllAsync<{ id: string }>('SELECT id FROM Beans WHERE product_id = ?', [id]);
  const lotIds = [...new Set([...lots.map(lot => lot.id), ...beans.map(bean => bean.id)])];
  if (lotIds.length) {
    const placeholders = lotIds.map(() => '?').join(', ');
    await db.runAsync(
      `DELETE FROM BrewLogs WHERE bean_id IN (${placeholders}) OR COALESCE(purchase_lot_id, bean_id) IN (${placeholders})`,
      [...lotIds, ...lotIds]
    );
    await db.runAsync(`DELETE FROM CoffeePurchaseLots WHERE id IN (${placeholders})`, lotIds);
    await db.runAsync(`DELETE FROM Beans WHERE id IN (${placeholders})`, lotIds);
  }
  await db.runAsync('DELETE FROM Beans WHERE product_id = ?', [id]);
  await db.runAsync('DELETE FROM CoffeeProducts WHERE id = ?', [id]);
};

export const getBeanPhotos = async (beanId: string): Promise<BeanPhoto[]> => {
  const db = await getDb();
  const lotRows = await db.getAllAsync<{ id: string; purchase_lot_id: string; photo_uri: string; photo_type: string; created_at: string }>(
    'SELECT * FROM PurchaseLotPhotos WHERE purchase_lot_id = ? ORDER BY created_at DESC',
    [beanId]
  );
  if (lotRows.length) return lotRows.map(r => ({ id: r.id, beanId: r.purchase_lot_id, photoUri: r.photo_uri, photoType: r.photo_type, createdAt: r.created_at }));
  const rows = await db.getAllAsync<{ id: string; bean_id: string; photo_uri: string; photo_type: string; created_at: string }>(
    'SELECT * FROM BeanPhotos WHERE bean_id = ? ORDER BY created_at DESC',
    [beanId]
  );
  return rows.map(r => ({ id: r.id, beanId: r.bean_id, photoUri: r.photo_uri, photoType: r.photo_type, createdAt: r.created_at }));
};

export const getAllBeanPhotos = async (): Promise<BeanPhoto[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; bean_id: string; photo_uri: string; photo_type: string; created_at: string }>(
    'SELECT * FROM BeanPhotos ORDER BY created_at DESC'
  );
  return rows.map(r => ({ id: r.id, beanId: r.bean_id, photoUri: r.photo_uri, photoType: r.photo_type, createdAt: r.created_at }));
};

export const addBeanPhoto = async (beanId: string, photoUri: string, photoType = 'bean_bag') => {
  const db = await getDb();
  const id = createId();
  const createdAt = nowIso();
  await db.runAsync('INSERT OR IGNORE INTO PurchaseLotPhotos (id, purchase_lot_id, photo_uri, photo_type, created_at) VALUES (?, ?, ?, ?, ?)', [id, beanId, photoUri, photoType, createdAt]);
  await db.runAsync('INSERT OR IGNORE INTO BeanPhotos (id, bean_id, photo_uri, photo_type, created_at) VALUES (?, ?, ?, ?, ?)', [id, beanId, photoUri, photoType, createdAt]);
  const lotMain = await db.getFirstAsync<{ main_photo_uri: string | null }>('SELECT main_photo_uri FROM CoffeePurchaseLots WHERE id = ?', [beanId]);
  if (lotMain && !lotMain.main_photo_uri) {
    await db.runAsync('UPDATE CoffeePurchaseLots SET main_photo_uri = ?, updated_at = ? WHERE id = ?', [photoUri, nowIso(), beanId]);
  }
  const main = await db.getFirstAsync<{ main_photo_uri: string | null }>('SELECT main_photo_uri FROM Beans WHERE id = ?', [beanId]);
  if (!main?.main_photo_uri) {
    await db.runAsync('UPDATE Beans SET main_photo_uri = ?, updated_at = ? WHERE id = ?', [photoUri, nowIso(), beanId]);
  }
};

export const deleteBeanPhoto = async (photoId: string, beanId?: string) => {
  const db = await getDb();
  const deleted = await db.getFirstAsync<{ bean_id: string; photo_uri: string }>('SELECT bean_id, photo_uri FROM BeanPhotos WHERE id = ?', [photoId]);
  const deletedLot = await db.getFirstAsync<{ purchase_lot_id: string; photo_uri: string }>('SELECT purchase_lot_id, photo_uri FROM PurchaseLotPhotos WHERE id = ?', [photoId]);
  await db.runAsync('DELETE FROM PurchaseLotPhotos WHERE id = ?', [photoId]);
  await db.runAsync('DELETE FROM BeanPhotos WHERE id = ?', [photoId]);
  const targetBeanId = beanId ?? deleted?.bean_id ?? deletedLot?.purchase_lot_id;
  const deletedUri = deleted?.photo_uri ?? deletedLot?.photo_uri ?? null;
  if (!targetBeanId || !deletedUri) return deletedUri;
  const lot = await db.getFirstAsync<{ main_photo_uri: string | null }>('SELECT main_photo_uri FROM CoffeePurchaseLots WHERE id = ?', [targetBeanId]);
  if (lot?.main_photo_uri === deletedUri) {
    const replacement = await db.getFirstAsync<{ photo_uri: string }>(
      'SELECT photo_uri FROM PurchaseLotPhotos WHERE purchase_lot_id = ? ORDER BY created_at DESC LIMIT 1',
      [targetBeanId]
    );
    await db.runAsync('UPDATE CoffeePurchaseLots SET main_photo_uri = ?, updated_at = ? WHERE id = ?', [replacement?.photo_uri ?? null, nowIso(), targetBeanId]);
  }
  const bean = await db.getFirstAsync<{ main_photo_uri: string | null }>('SELECT main_photo_uri FROM Beans WHERE id = ?', [targetBeanId]);
  if (bean?.main_photo_uri === deletedUri) {
    const replacement = await db.getFirstAsync<{ photo_uri: string }>(
      'SELECT photo_uri FROM BeanPhotos WHERE bean_id = ? ORDER BY created_at DESC LIMIT 1',
      [targetBeanId]
    );
    await db.runAsync('UPDATE Beans SET main_photo_uri = ?, updated_at = ? WHERE id = ?', [replacement?.photo_uri ?? null, nowIso(), targetBeanId]);
  }
  return deletedUri;
};

export const getDefaultSetting = async (beanId: string): Promise<BeanDefaultSetting | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM BeanDefaultSettings WHERE bean_id = ?', [beanId]);
  if (!row) return null;
  return {
    id: row.id,
    beanId: row.bean_id,
    equipmentProfileId: row.equipment_profile_id,
    grindSize: row.grind_size,
    speed: row.speed,
    grindSeconds: row.grind_seconds,
    doseGram: row.dose_gram,
    yieldGram: row.yield_gram,
    targetBrewSeconds: row.target_brew_seconds,
    drinkType: row.drink_type,
    memo: row.memo,
  };
};

export const getDefaultSettings = async (): Promise<Record<string, BeanDefaultSetting | null>> => {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM BeanDefaultSettings');
  const mapped: Record<string, BeanDefaultSetting | null> = {};
  for (const row of rows) {
    mapped[row.bean_id] = {
      id: row.id,
      beanId: row.bean_id,
      equipmentProfileId: row.equipment_profile_id,
      grindSize: row.grind_size,
      speed: row.speed,
      grindSeconds: row.grind_seconds,
      doseGram: row.dose_gram,
      yieldGram: row.yield_gram,
      targetBrewSeconds: row.target_brew_seconds,
      drinkType: row.drink_type,
      memo: row.memo,
    };
  }
  return mapped;
};

export const upsertDefaultSetting = async (setting: Omit<BeanDefaultSetting, 'id'> & { id?: string }) => {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO BeanDefaultSettings
     (id, bean_id, equipment_profile_id, grind_size, speed, grind_seconds, dose_gram, yield_gram, target_brew_seconds, drink_type, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(bean_id) DO UPDATE SET
       equipment_profile_id = excluded.equipment_profile_id,
       grind_size = excluded.grind_size,
       speed = excluded.speed,
       grind_seconds = excluded.grind_seconds,
       dose_gram = excluded.dose_gram,
       yield_gram = excluded.yield_gram,
       target_brew_seconds = excluded.target_brew_seconds,
       drink_type = excluded.drink_type,
       memo = excluded.memo`,
    [setting.id ?? createId(), setting.beanId, setting.equipmentProfileId, setting.grindSize, setting.speed, setting.grindSeconds, setting.doseGram, setting.yieldGram, setting.targetBrewSeconds, setting.drinkType, setting.memo]
  );
};

export const getEquipmentProfiles = async (): Promise<EquipmentProfile[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<EquipmentRow>('SELECT * FROM EquipmentProfiles ORDER BY name ASC');
  return rows.map(mapEquipment);
};

export const upsertEquipmentProfile = async (equipment: Partial<EquipmentProfile> & { name: string; id?: string }): Promise<EquipmentProfile> => {
  const db = await getDb();
  const saved: EquipmentProfile = {
    id: equipment.id ?? createId(),
    name: equipment.name,
    type: equipment.type ?? null,
    brand: equipment.brand ?? null,
    model: equipment.model ?? null,
    memo: equipment.memo ?? null,
  };
  await db.runAsync(
    `INSERT INTO EquipmentProfiles (id, name, type, brand, model, memo)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       type = excluded.type,
       brand = excluded.brand,
       model = excluded.model,
       memo = excluded.memo`,
    [saved.id, saved.name, saved.type, saved.brand, saved.model, saved.memo]
  );
  return saved;
};

export const deleteEquipmentProfile = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM EquipmentProfiles WHERE id = ?', [id]);
};

export const getResourceGroups = async (equipmentProfileId?: string): Promise<ResourceGroup[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<ResourceGroupRow>(
    `SELECT * FROM ResourceGroups ${equipmentProfileId ? 'WHERE equipment_profile_id = ?' : ''} ORDER BY sort_order ASC, name ASC`,
    equipmentProfileId ? [equipmentProfileId] : []
  );
  return rows.map(mapResourceGroup);
};

export const upsertResourceGroup = async (group: Partial<ResourceGroup> & { equipmentProfileId: string; name: string; id?: string }): Promise<ResourceGroup> => {
  const db = await getDb();
  const now = nowIso();
  const saved: ResourceGroup = {
    id: group.id ?? createId(),
    equipmentProfileId: group.equipmentProfileId,
    name: group.name,
    memo: group.memo ?? null,
    sortOrder: group.sortOrder ?? 0,
    createdAt: group.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO ResourceGroups (id, equipment_profile_id, name, memo, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       equipment_profile_id = excluded.equipment_profile_id,
       name = excluded.name,
       memo = excluded.memo,
       sort_order = excluded.sort_order,
       updated_at = excluded.updated_at`,
    [saved.id, saved.equipmentProfileId, saved.name, saved.memo, saved.sortOrder, saved.createdAt, saved.updatedAt]
  );
  return saved;
};

export const deleteResourceGroup = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM ResourceGroups WHERE id = ?', [id]);
};

export const getResourceLinks = async (groupId?: string): Promise<ResourceLink[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<ResourceLinkRow>(
    `SELECT * FROM ResourceLinks ${groupId ? 'WHERE group_id = ?' : ''} ORDER BY updated_at DESC`,
    groupId ? [groupId] : []
  );
  return rows.map(mapResourceLink);
};

export const upsertResourceLink = async (link: Partial<ResourceLink> & { groupId: string; title: string; url: string; id?: string }): Promise<ResourceLink> => {
  const db = await getDb();
  const now = nowIso();
  const saved: ResourceLink = {
    id: link.id ?? createId(),
    groupId: link.groupId,
    title: link.title,
    url: link.url,
    memo: link.memo ?? null,
    tag: link.tag ?? null,
    sourceType: link.sourceType ?? null,
    publishedDate: link.publishedDate ?? null,
    createdAt: link.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO ResourceLinks (id, group_id, title, url, memo, tag, source_type, published_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       group_id = excluded.group_id,
       title = excluded.title,
       url = excluded.url,
       memo = excluded.memo,
       tag = excluded.tag,
       source_type = excluded.source_type,
       published_date = excluded.published_date,
       updated_at = excluded.updated_at`,
    [saved.id, saved.groupId, saved.title, saved.url, saved.memo, saved.tag, saved.sourceType, saved.publishedDate, saved.createdAt, saved.updatedAt]
  );
  return saved;
};

export const deleteResourceLink = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM ResourceLinks WHERE id = ?', [id]);
};

const bes876ResourceSeed = [
  {
    name: '공식 매뉴얼',
    memo: 'BES876 공식 설명서와 제품 페이지',
    links: [
      ['Breville BES876 제품 페이지', 'https://www.breville.com/en-us/product/bes876', '공식,제품', 'official', null, '25단계 그라인더, 자동 도징, 54mm 포터필터 핵심 사양'],
      ['한국어/영문 매뉴얼 PDF', 'https://assets.breville.com/BES876/BES876_KOR-EN_IB_F24_LR.pdf', '공식,매뉴얼,한국어', 'manual', '2024', 'AUTO/MANUAL 도징, 청소, 디스케일 절차 확인'],
      ['최신 US 매뉴얼 PDF', 'https://assets.breville.com/BES876/BES876_USCM_IB_F26_LR.pdf', '공식,매뉴얼,영문', 'manual', '2026', '최신 영문 설명서'],
    ],
  },
  {
    name: 'AUTO/MANUAL',
    memo: 'AUTO/MANUAL은 추출보다 도징 모드 중심으로 기록',
    links: [
      ['샷 볼륨과 온도 조정', 'https://www.breville.com/inspiration/en-au/tutorials/the-barista-express-impress/latte-art/how-to-adjust-the-shot-volume-and-temperature', '공식,샷볼륨,온도', 'official', null, '1/2 CUP 프로그래밍과 온도 조정 참고'],
      ['YouTube: 수동 도징', 'https://www.youtube.com/watch?v=cbKWUt2OObs', '유튜브,MANUAL,도징', 'youtube', null, 'Manual Dose Dial 사용 흐름'],
    ],
  },
  {
    name: '다이얼인',
    memo: '원두별 분쇄도, 도징량, 수율, 시간 비교',
    links: [
      ['YouTube: Intelligent Dosing 다이얼인', 'https://www.youtube.com/watch?v=LZJN3SvjOW0', '유튜브,다이얼인,AUTO', 'youtube', '2023-07-31', '자동 도징으로 원두 맞추는 흐름'],
      ['YouTube: 전체 워크스루', 'https://www.youtube.com/watch?v=O49Gqepgnqs', '유튜브,워크스루,입문', 'youtube', null, 'BES876 전체 사용 흐름'],
      ['YouTube: 샷 볼륨/온도', 'https://www.youtube.com/watch?v=NiWtTPmHLZk', '유튜브,샷볼륨,온도', 'youtube', '2022-09-30', '공식 샷 볼륨/온도 튜토리얼'],
    ],
  },
  {
    name: '세척/디스케일',
    memo: 'CLEAN/DESCALE 상태등을 보고 청소와 디스케일 구분',
    links: [
      ['Breville 디스케일 가이드', 'https://www.breville.com/inspiration/en-us/tutorials/the-barista-express-impress/cleaning-guides/how-to-perform-a-descale', '공식,디스케일,세척', 'official', null, '디스케일 준비물과 린스 흐름'],
      ['YouTube: 디스케일', 'https://www.youtube.com/watch?v=tBmskRRZ8Vk', '유튜브,디스케일', 'youtube', null, '디스케일 영상 가이드'],
    ],
  },
] as const;

export const ensureBes876GuideSeed = async () => {
  const existing = await getEquipmentProfiles();
  let machine = existing.find(item => item.model?.toUpperCase() === 'BES876' || item.name.toUpperCase().includes('BES876'));
  if (!machine) {
    machine = await upsertEquipmentProfile({
      name: 'Breville Barista Express Impress',
      brand: 'Breville',
      model: 'BES876',
      type: '에스프레소 머신',
      memo: 'AUTO/MANUAL 도징 모드, 25단계 그라인더, Impress 탬핑 시스템 기준으로 기록',
    });
  }
  const groups = await getResourceGroups(machine.id);
  for (const [index, seed] of bes876ResourceSeed.entries()) {
    let group = groups.find(item => item.name === seed.name);
    if (!group) {
      group = await upsertResourceGroup({ equipmentProfileId: machine.id, name: seed.name, memo: seed.memo, sortOrder: index });
    }
    const links = await getResourceLinks(group.id);
    for (const [title, url, tag, sourceType, publishedDate, memo] of seed.links) {
      if (!links.some(link => link.url === url)) {
        await upsertResourceLink({ groupId: group.id, title, url, tag, sourceType, publishedDate, memo });
      }
    }
  }
  return machine;
};

export const getBrewLogs = async (beanId?: string): Promise<BrewLog[]> => {
  const db = await getDb();
  const sql = `SELECT BrewLogs.*, CoffeeProducts.name AS bean_name, CoffeeProducts.roastery AS roastery
               FROM BrewLogs
               LEFT JOIN CoffeePurchaseLots ON CoffeePurchaseLots.id = COALESCE(BrewLogs.purchase_lot_id, BrewLogs.bean_id)
               LEFT JOIN CoffeeProducts ON CoffeeProducts.id = CoffeePurchaseLots.product_id
               ${beanId ? 'WHERE COALESCE(BrewLogs.purchase_lot_id, BrewLogs.bean_id) = ?' : ''}
               ORDER BY brewed_at DESC`;
  const rows = await db.getAllAsync<LogRow>(sql, beanId ? [beanId] : []);
  return rows.map(mapLog);
};

export const upsertBrewLog = async (log: Partial<BrewLog> & { beanId: string }): Promise<BrewLog> => {
  const db = await getDb();
  const now = nowIso();
  const saved: BrewLog = {
    id: log.id ?? createId(),
    beanId: log.beanId,
    purchaseLotId: log.purchaseLotId ?? log.beanId,
    equipmentProfileId: log.equipmentProfileId ?? null,
    brewedAt: log.brewedAt ?? now,
    recordingModeUsed: log.recordingModeUsed ?? null,
    drinkType: log.drinkType ?? null,
    doseMode: log.doseMode ?? null,
    basketType: log.basketType ?? null,
    shotButton: log.shotButton ?? null,
    grindSize: log.grindSize ?? null,
    grindSizeExternal: log.grindSizeExternal ?? null,
    innerBurrSetting: log.innerBurrSetting ?? null,
    speed: log.speed ?? null,
    grindSeconds: log.grindSeconds ?? null,
    actualDoseGram: log.actualDoseGram ?? log.doseGram ?? null,
    doseGram: log.doseGram ?? null,
    yieldGram: log.yieldGram ?? null,
    brewSeconds: log.brewSeconds ?? null,
    firstDripSeconds: log.firstDripSeconds ?? null,
    timeMeasurementSource: log.timeMeasurementSource ?? null,
    waterTemperature: log.waterTemperature ?? null,
    temperatureOffset: log.temperatureOffset ?? null,
    preinfusion: log.preinfusion ?? false,
    preinfusionSeconds: log.preinfusionSeconds ?? null,
    basket: log.basket ?? null,
    doseLevel: log.doseLevel ?? null,
    pressureZone: log.pressureZone ?? null,
    usedABitMore: log.usedABitMore ?? false,
    usedRazorTrim: log.usedRazorTrim ?? false,
    autoDoseResetDone: log.autoDoseResetDone ?? false,
    programmedVolumeChanged: log.programmedVolumeChanged ?? false,
    nextAction: log.nextAction ?? null,
    puckPrep: log.puckPrep ?? null,
    tamping: log.tamping ?? null,
    channeling: log.channeling ?? null,
    shotResult: log.shotResult ?? null,
    waterMl: log.waterMl ?? null,
    milkMl: log.milkMl ?? null,
    servingTemperature: log.servingTemperature ?? null,
    rating: log.rating ?? null,
    acidity: log.acidity ?? null,
    sweetness: log.sweetness ?? null,
    bitterness: log.bitterness ?? null,
    body: log.body ?? null,
    isFavorite: log.isFavorite ?? false,
    resultMemo: log.resultMemo ?? null,
    photoUri: log.photoUri ?? null,
    createdAt: log.createdAt ?? now,
    updatedAt: now,
  };
  await db.runAsync(
    `INSERT INTO BrewLogs
     (id, bean_id, purchase_lot_id, equipment_profile_id, brewed_at, recording_mode_used, drink_type, dose_mode, basket_type, shot_button, grind_size, grind_size_external, inner_burr_setting, speed, grind_seconds, actual_dose_gram, dose_gram, yield_gram, brew_seconds, first_drip_seconds, time_measurement_source, water_temperature, temperature_offset, preinfusion, preinfusion_seconds, basket, dose_level, pressure_zone, used_a_bit_more, used_razor_trim, auto_dose_reset_done, programmed_volume_changed, next_action, puck_prep, tamping, channeling, shot_result, water_ml, milk_ml, serving_temperature, rating, acidity, sweetness, bitterness, body, is_favorite, result_memo, photo_uri, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       bean_id = excluded.bean_id,
       purchase_lot_id = excluded.purchase_lot_id,
       equipment_profile_id = excluded.equipment_profile_id,
       brewed_at = excluded.brewed_at,
       recording_mode_used = excluded.recording_mode_used,
       drink_type = excluded.drink_type,
       dose_mode = excluded.dose_mode,
       basket_type = excluded.basket_type,
       shot_button = excluded.shot_button,
       grind_size = excluded.grind_size,
       grind_size_external = excluded.grind_size_external,
       inner_burr_setting = excluded.inner_burr_setting,
       speed = excluded.speed,
       grind_seconds = excluded.grind_seconds,
       actual_dose_gram = excluded.actual_dose_gram,
       dose_gram = excluded.dose_gram,
       yield_gram = excluded.yield_gram,
       brew_seconds = excluded.brew_seconds,
       first_drip_seconds = excluded.first_drip_seconds,
       time_measurement_source = excluded.time_measurement_source,
       water_temperature = excluded.water_temperature,
       temperature_offset = excluded.temperature_offset,
       preinfusion = excluded.preinfusion,
       preinfusion_seconds = excluded.preinfusion_seconds,
       basket = excluded.basket,
       dose_level = excluded.dose_level,
       pressure_zone = excluded.pressure_zone,
       used_a_bit_more = excluded.used_a_bit_more,
       used_razor_trim = excluded.used_razor_trim,
       auto_dose_reset_done = excluded.auto_dose_reset_done,
       programmed_volume_changed = excluded.programmed_volume_changed,
       next_action = excluded.next_action,
       puck_prep = excluded.puck_prep,
       tamping = excluded.tamping,
       channeling = excluded.channeling,
       shot_result = excluded.shot_result,
       water_ml = excluded.water_ml,
       milk_ml = excluded.milk_ml,
       serving_temperature = excluded.serving_temperature,
       rating = excluded.rating,
       acidity = excluded.acidity,
       sweetness = excluded.sweetness,
       bitterness = excluded.bitterness,
       body = excluded.body,
       is_favorite = excluded.is_favorite,
       result_memo = excluded.result_memo,
       photo_uri = excluded.photo_uri,
       updated_at = excluded.updated_at`,
    [saved.id, saved.beanId, saved.purchaseLotId, saved.equipmentProfileId, saved.brewedAt, saved.recordingModeUsed, saved.drinkType, saved.doseMode, saved.basketType, saved.shotButton, saved.grindSize, saved.grindSizeExternal, saved.innerBurrSetting, saved.speed, saved.grindSeconds, saved.actualDoseGram, saved.doseGram, saved.yieldGram, saved.brewSeconds, saved.firstDripSeconds, saved.timeMeasurementSource, saved.waterTemperature, saved.temperatureOffset, saved.preinfusion ? 1 : 0, saved.preinfusionSeconds, saved.basket, saved.doseLevel, saved.pressureZone, saved.usedABitMore ? 1 : 0, saved.usedRazorTrim ? 1 : 0, saved.autoDoseResetDone ? 1 : 0, saved.programmedVolumeChanged ? 1 : 0, saved.nextAction, saved.puckPrep, saved.tamping, saved.channeling, saved.shotResult, saved.waterMl, saved.milkMl, saved.servingTemperature, saved.rating, saved.acidity, saved.sweetness, saved.bitterness, saved.body, saved.isFavorite ? 1 : 0, saved.resultMemo, saved.photoUri, saved.createdAt, saved.updatedAt]
  );
  return saved;
};

export const deleteBrewLog = async (id: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM BrewLogs WHERE id = ?', [id]);
};

export const getBrewLogPhotos = async (brewLogId: string): Promise<BrewLogPhoto[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; brew_log_id: string; photo_uri: string; photo_type: BrewLogPhoto['photoType']; created_at: string }>(
    'SELECT * FROM BrewLogPhotos WHERE brew_log_id = ? ORDER BY created_at DESC',
    [brewLogId]
  );
  return rows.map(row => ({
    id: row.id,
    brewLogId: row.brew_log_id,
    photoUri: row.photo_uri,
    photoType: row.photo_type,
    createdAt: row.created_at,
  }));
};

export const addBrewLogPhoto = async (brewLogId: string, photoUri: string, photoType: BrewLogPhoto['photoType'] = 'espresso_result') => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO BrewLogPhotos (id, brew_log_id, photo_uri, photo_type, created_at) VALUES (?, ?, ?, ?, ?)',
    [createId(), brewLogId, photoUri, photoType, nowIso()]
  );
};

export const deleteBrewLogPhoto = async (photoId: string) => {
  const db = await getDb();
  const deleted = await db.getFirstAsync<{ photo_uri: string }>('SELECT photo_uri FROM BrewLogPhotos WHERE id = ?', [photoId]);
  await db.runAsync('DELETE FROM BrewLogPhotos WHERE id = ?', [photoId]);
  return deleted?.photo_uri ?? null;
};

export const saveAiAnalysis = async (result: Omit<AiAnalysisResult, 'id' | 'createdAt'>) => {
  const db = await getDb();
  const id = createId();
  const createdAt = nowIso();
  await db.runAsync(
    'INSERT INTO AiAnalysisResults (id, provider, model_name, bean_id, photo_uri, raw_json, parsed_json, uncertain_fields, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, result.provider, result.modelName, result.beanId, result.photoUri, result.rawJson, result.parsedJson, result.uncertainFields, createdAt]
  );
};

export const getAiAnalyses = async (): Promise<AiAnalysisResult[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM AiAnalysisResults ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    provider: r.provider,
    modelName: r.model_name,
    beanId: r.bean_id,
    photoUri: r.photo_uri,
    rawJson: r.raw_json,
    parsedJson: r.parsed_json,
    uncertainFields: r.uncertain_fields,
    createdAt: r.created_at,
  }));
};

export const getStats = async (): Promise<CoffeeStats> => {
  const db = await getDb();
  const recentThreshold = new Date(Date.now() - 7 * 86400000).toISOString();
  const beanCount = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM Beans');
  const logCount = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM BrewLogs');
  const recent7 = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM BrewLogs WHERE brewed_at >= ?', [recentThreshold]);
  const avg = await db.getFirstAsync<{ value: number | null }>('SELECT AVG(rating) AS value FROM BrewLogs WHERE rating IS NOT NULL');
  const top = await db.getFirstAsync<{ name: string }>(
    `SELECT Beans.name FROM BrewLogs JOIN Beans ON Beans.id = BrewLogs.bean_id
     GROUP BY bean_id ORDER BY COUNT(*) DESC LIMIT 1`
  );
  return {
    beanCount: beanCount?.value ?? 0,
    logCount: logCount?.value ?? 0,
    recent7DaysCount: recent7?.value ?? 0,
    topBeanName: top?.name ?? '아직 없음',
    averageRating: avg?.value ?? null,
  };
};

export interface NotificationScheduleRecord {
  beanId: string;
  notificationId: string;
  type: string;
  fireAt: string;
}

export const getNotificationSchedules = async (): Promise<NotificationScheduleRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<{ bean_id: string; notification_id: string; type: string; fire_at: string }>('SELECT bean_id, notification_id, type, fire_at FROM NotificationSchedules');
  return rows.map(row => ({ beanId: row.bean_id, notificationId: row.notification_id, type: row.type, fireAt: row.fire_at }));
};

export const replaceNotificationSchedules = async (records: NotificationScheduleRecord[]) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM NotificationSchedules');
  for (const record of records) {
    await db.runAsync(
      'INSERT INTO NotificationSchedules (id, bean_id, notification_id, type, fire_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [createId(), record.beanId, record.notificationId, record.type, record.fireAt, nowIso()]
    );
  }
};

export const clearNotificationSchedules = async () => {
  const db = await getDb();
  await db.runAsync('DELETE FROM NotificationSchedules');
};

export const getPhotoReferenceCount = async (photoUri: string | null | undefined) => {
  if (!photoUri) return 0;
  const db = await getDb();
  const beanMain = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM Beans WHERE main_photo_uri = ?', [photoUri]);
  const lotMain = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM CoffeePurchaseLots WHERE main_photo_uri = ?', [photoUri]);
  const beanPhotos = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM BeanPhotos WHERE photo_uri = ?', [photoUri]);
  const lotPhotos = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM PurchaseLotPhotos WHERE photo_uri = ?', [photoUri]);
  const brewLogs = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM BrewLogs WHERE photo_uri = ?', [photoUri]);
  const brewLogPhotos = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM BrewLogPhotos WHERE photo_uri = ?', [photoUri]);
  const aiAnalyses = await db.getFirstAsync<{ value: number }>('SELECT COUNT(*) AS value FROM AiAnalysisResults WHERE photo_uri = ?', [photoUri]);
  return (beanMain?.value ?? 0) + (lotMain?.value ?? 0) + (beanPhotos?.value ?? 0) + (lotPhotos?.value ?? 0) + (brewLogs?.value ?? 0) + (brewLogPhotos?.value ?? 0) + (aiAnalyses?.value ?? 0);
};

export const clearAllData = async () => {
  const db = await getDb();
  await db.execAsync('DELETE FROM ResourceLinks; DELETE FROM ResourceGroups; DELETE FROM EquipmentProfiles; DELETE FROM NotificationSchedules; DELETE FROM AiAnalysisResults; DELETE FROM BrewLogPhotos; DELETE FROM BrewLogs; DELETE FROM PurchaseLotPhotos; DELETE FROM BeanPhotos; DELETE FROM BeanDefaultSettings; DELETE FROM CoffeePurchaseLots; DELETE FROM Beans; DELETE FROM CoffeeProducts;');
};
