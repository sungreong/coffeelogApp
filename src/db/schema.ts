import * as SQLite from 'expo-sqlite';
import { createId, nowIso } from '../utils';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('coffeelog.db');
  return dbInstance;
};

export const initDb = async () => {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS CoffeeProducts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      roastery TEXT,
      origin TEXT,
      variety TEXT,
      process TEXT,
      roast_level TEXT,
      tasting_notes TEXT,
      user_status TEXT NOT NULL DEFAULT 'normal',
      memo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Beans (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      roastery TEXT,
      origin TEXT,
      variety TEXT,
      process TEXT,
      roast_level TEXT,
      purchase_date TEXT,
      roast_date TEXT,
      opened_date TEXT,
      expiry_date TEXT,
      storage_type TEXT,
      initial_weight_gram REAL,
      remaining_weight_gram REAL,
      lot_status TEXT NOT NULL DEFAULT 'open',
      seller TEXT,
      price REAL,
      lot_memo TEXT,
      memo TEXT,
      main_photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS CoffeePurchaseLots (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      purchase_date TEXT,
      roast_date TEXT,
      opened_date TEXT,
      expiry_date TEXT,
      storage_type TEXT,
      initial_weight_gram REAL,
      remaining_weight_gram REAL,
      lot_status TEXT NOT NULL DEFAULT 'open',
      seller TEXT,
      price REAL,
      lot_memo TEXT,
      main_photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES CoffeeProducts (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS PurchaseLotPhotos (
      id TEXT PRIMARY KEY NOT NULL,
      purchase_lot_id TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      photo_type TEXT NOT NULL DEFAULT 'bean_bag',
      created_at TEXT NOT NULL,
      FOREIGN KEY (purchase_lot_id) REFERENCES CoffeePurchaseLots (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS BeanPhotos (
      id TEXT PRIMARY KEY NOT NULL,
      bean_id TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      photo_type TEXT NOT NULL DEFAULT 'bean_bag',
      created_at TEXT NOT NULL,
      FOREIGN KEY (bean_id) REFERENCES Beans (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS EquipmentProfiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      brand TEXT,
      model TEXT,
      memo TEXT
    );

    CREATE TABLE IF NOT EXISTS BeanDefaultSettings (
      id TEXT PRIMARY KEY NOT NULL,
      bean_id TEXT NOT NULL UNIQUE,
      equipment_profile_id TEXT,
      grind_size TEXT,
      speed TEXT,
      grind_seconds REAL,
      dose_gram REAL,
      yield_gram REAL,
      target_brew_seconds REAL,
      drink_type TEXT,
      memo TEXT,
      FOREIGN KEY (bean_id) REFERENCES Beans (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS BrewLogs (
      id TEXT PRIMARY KEY NOT NULL,
      bean_id TEXT NOT NULL,
      purchase_lot_id TEXT,
      equipment_profile_id TEXT,
      brewed_at TEXT NOT NULL,
      recording_mode_used TEXT,
      drink_type TEXT,
      dose_mode TEXT,
      basket_type TEXT,
      shot_button TEXT,
      grind_size TEXT,
      grind_size_external REAL,
      inner_burr_setting REAL,
      speed TEXT,
      grind_seconds REAL,
      actual_dose_gram REAL,
      dose_gram REAL,
      yield_gram REAL,
      brew_seconds REAL,
      first_drip_seconds REAL,
      time_measurement_source TEXT,
      water_temperature REAL,
      temperature_offset REAL,
      preinfusion INTEGER NOT NULL DEFAULT 0,
      preinfusion_seconds REAL,
      basket TEXT,
      dose_level TEXT,
      pressure_zone TEXT,
      used_a_bit_more INTEGER NOT NULL DEFAULT 0,
      used_razor_trim INTEGER NOT NULL DEFAULT 0,
      auto_dose_reset_done INTEGER NOT NULL DEFAULT 0,
      programmed_volume_changed INTEGER NOT NULL DEFAULT 0,
      next_action TEXT,
      puck_prep TEXT,
      tamping TEXT,
      channeling TEXT,
      shot_result TEXT,
      water_ml REAL,
      milk_ml REAL,
      serving_temperature TEXT,
      rating REAL,
      acidity REAL,
      sweetness REAL,
      bitterness REAL,
      body REAL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      result_memo TEXT,
      photo_uri TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (bean_id) REFERENCES Beans (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS BrewLogPhotos (
      id TEXT PRIMARY KEY NOT NULL,
      brew_log_id TEXT NOT NULL,
      photo_uri TEXT NOT NULL,
      photo_type TEXT NOT NULL DEFAULT 'espresso_result',
      created_at TEXT NOT NULL,
      FOREIGN KEY (brew_log_id) REFERENCES BrewLogs (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AiAnalysisResults (
      id TEXT PRIMARY KEY NOT NULL,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      bean_id TEXT,
      photo_uri TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      parsed_json TEXT NOT NULL,
      uncertain_fields TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS NotificationSchedules (
      id TEXT PRIMARY KEY NOT NULL,
      bean_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      type TEXT NOT NULL,
      fire_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (bean_id) REFERENCES Beans (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ResourceGroups (
      id TEXT PRIMARY KEY NOT NULL,
      equipment_profile_id TEXT NOT NULL,
      name TEXT NOT NULL,
      memo TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (equipment_profile_id) REFERENCES EquipmentProfiles (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ResourceLinks (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      memo TEXT,
      tag TEXT,
      source_type TEXT,
      published_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES ResourceGroups (id) ON DELETE CASCADE
    );
  `);

  const productColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(CoffeeProducts)');
  const existingProduct = new Set(productColumns.map(column => column.name));
  const productMigrations: Array<[string, string]> = [
    ['tasting_notes', 'ALTER TABLE CoffeeProducts ADD COLUMN tasting_notes TEXT'],
    ['user_status', "ALTER TABLE CoffeeProducts ADD COLUMN user_status TEXT NOT NULL DEFAULT 'normal'"],
  ];
  for (const [name, sql] of productMigrations) {
    if (!existingProduct.has(name)) await db.execAsync(sql);
  }

  const beanColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(Beans)');
  const existingBean = new Set(beanColumns.map(column => column.name));
  const beanMigrations: Array<[string, string]> = [
    ['product_id', 'ALTER TABLE Beans ADD COLUMN product_id TEXT'],
    ['initial_weight_gram', 'ALTER TABLE Beans ADD COLUMN initial_weight_gram REAL'],
    ['remaining_weight_gram', 'ALTER TABLE Beans ADD COLUMN remaining_weight_gram REAL'],
    ['lot_status', "ALTER TABLE Beans ADD COLUMN lot_status TEXT NOT NULL DEFAULT 'open'"],
    ['seller', 'ALTER TABLE Beans ADD COLUMN seller TEXT'],
    ['price', 'ALTER TABLE Beans ADD COLUMN price REAL'],
    ['lot_memo', 'ALTER TABLE Beans ADD COLUMN lot_memo TEXT'],
  ];
  for (const [name, sql] of beanMigrations) {
    if (!existingBean.has(name)) await db.execAsync(sql);
  }

  const orphanLots = await db.getAllAsync<{
    id: string; name: string; roastery: string | null; origin: string | null; variety: string | null; process: string | null;
    roast_level: string | null; memo: string | null; created_at: string; updated_at: string;
  }>('SELECT id, name, roastery, origin, variety, process, roast_level, memo, created_at, updated_at FROM Beans WHERE product_id IS NULL');
  for (const lot of orphanLots) {
    const productId = createId();
    const now = nowIso();
    await db.runAsync(
      `INSERT INTO CoffeeProducts (id, name, roastery, origin, variety, process, roast_level, tasting_notes, user_status, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, lot.name, lot.roastery, lot.origin, lot.variety, lot.process, lot.roast_level, null, 'normal', lot.memo, lot.created_at ?? now, lot.updated_at ?? now]
    );
    await db.runAsync('UPDATE Beans SET product_id = ?, updated_at = ? WHERE id = ?', [productId, now, lot.id]);
  }

  const brewLogColumnsForLot = await db.getAllAsync<{ name: string }>('PRAGMA table_info(BrewLogs)');
  if (!new Set(brewLogColumnsForLot.map(column => column.name)).has('purchase_lot_id')) {
    await db.execAsync('ALTER TABLE BrewLogs ADD COLUMN purchase_lot_id TEXT');
    await db.runAsync('UPDATE BrewLogs SET purchase_lot_id = bean_id WHERE purchase_lot_id IS NULL');
  }

  const beanRowsForLots = await db.getAllAsync<{
    id: string; product_id: string | null; purchase_date: string | null; roast_date: string | null; opened_date: string | null; expiry_date: string | null;
    storage_type: string | null; initial_weight_gram: number | null; remaining_weight_gram: number | null; lot_status: string | null;
    seller: string | null; price: number | null; lot_memo: string | null; main_photo_uri: string | null; created_at: string; updated_at: string;
  }>('SELECT id, product_id, purchase_date, roast_date, opened_date, expiry_date, storage_type, initial_weight_gram, remaining_weight_gram, lot_status, seller, price, lot_memo, main_photo_uri, created_at, updated_at FROM Beans WHERE product_id IS NOT NULL');
  for (const lot of beanRowsForLots) {
    await db.runAsync(
      `INSERT OR IGNORE INTO CoffeePurchaseLots
       (id, product_id, purchase_date, roast_date, opened_date, expiry_date, storage_type, initial_weight_gram, remaining_weight_gram, lot_status, seller, price, lot_memo, main_photo_uri, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lot.id, lot.product_id, lot.purchase_date, lot.roast_date, lot.opened_date, lot.expiry_date, lot.storage_type, lot.initial_weight_gram, lot.remaining_weight_gram, lot.lot_status ?? 'open', lot.seller, lot.price, lot.lot_memo, lot.main_photo_uri, lot.created_at, lot.updated_at]
    );
  }
  const beanPhotosForLots = await db.getAllAsync<{ id: string; bean_id: string; photo_uri: string; photo_type: string; created_at: string }>(
    'SELECT id, bean_id, photo_uri, photo_type, created_at FROM BeanPhotos'
  );
  for (const photo of beanPhotosForLots) {
    await db.runAsync(
      'INSERT OR IGNORE INTO PurchaseLotPhotos (id, purchase_lot_id, photo_uri, photo_type, created_at) VALUES (?, ?, ?, ?, ?)',
      [photo.id, photo.bean_id, photo.photo_uri, photo.photo_type, photo.created_at]
    );
  }

  const brewColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(BrewLogs)');
  const existing = new Set(brewColumns.map(column => column.name));
  const migrations: Array<[string, string]> = [
    ['recording_mode_used', 'ALTER TABLE BrewLogs ADD COLUMN recording_mode_used TEXT'],
    ['dose_mode', 'ALTER TABLE BrewLogs ADD COLUMN dose_mode TEXT'],
    ['basket_type', 'ALTER TABLE BrewLogs ADD COLUMN basket_type TEXT'],
    ['shot_button', 'ALTER TABLE BrewLogs ADD COLUMN shot_button TEXT'],
    ['grind_size_external', 'ALTER TABLE BrewLogs ADD COLUMN grind_size_external REAL'],
    ['inner_burr_setting', 'ALTER TABLE BrewLogs ADD COLUMN inner_burr_setting REAL'],
    ['actual_dose_gram', 'ALTER TABLE BrewLogs ADD COLUMN actual_dose_gram REAL'],
    ['first_drip_seconds', 'ALTER TABLE BrewLogs ADD COLUMN first_drip_seconds REAL'],
    ['time_measurement_source', 'ALTER TABLE BrewLogs ADD COLUMN time_measurement_source TEXT'],
    ['temperature_offset', 'ALTER TABLE BrewLogs ADD COLUMN temperature_offset REAL'],
    ['preinfusion_seconds', 'ALTER TABLE BrewLogs ADD COLUMN preinfusion_seconds REAL'],
    ['basket', 'ALTER TABLE BrewLogs ADD COLUMN basket TEXT'],
    ['dose_level', 'ALTER TABLE BrewLogs ADD COLUMN dose_level TEXT'],
    ['pressure_zone', 'ALTER TABLE BrewLogs ADD COLUMN pressure_zone TEXT'],
    ['used_a_bit_more', 'ALTER TABLE BrewLogs ADD COLUMN used_a_bit_more INTEGER NOT NULL DEFAULT 0'],
    ['used_razor_trim', 'ALTER TABLE BrewLogs ADD COLUMN used_razor_trim INTEGER NOT NULL DEFAULT 0'],
    ['auto_dose_reset_done', 'ALTER TABLE BrewLogs ADD COLUMN auto_dose_reset_done INTEGER NOT NULL DEFAULT 0'],
    ['programmed_volume_changed', 'ALTER TABLE BrewLogs ADD COLUMN programmed_volume_changed INTEGER NOT NULL DEFAULT 0'],
    ['next_action', 'ALTER TABLE BrewLogs ADD COLUMN next_action TEXT'],
    ['puck_prep', 'ALTER TABLE BrewLogs ADD COLUMN puck_prep TEXT'],
    ['tamping', 'ALTER TABLE BrewLogs ADD COLUMN tamping TEXT'],
    ['channeling', 'ALTER TABLE BrewLogs ADD COLUMN channeling TEXT'],
    ['shot_result', 'ALTER TABLE BrewLogs ADD COLUMN shot_result TEXT'],
    ['water_ml', 'ALTER TABLE BrewLogs ADD COLUMN water_ml REAL'],
    ['milk_ml', 'ALTER TABLE BrewLogs ADD COLUMN milk_ml REAL'],
    ['serving_temperature', 'ALTER TABLE BrewLogs ADD COLUMN serving_temperature TEXT'],
  ];
  for (const [name, sql] of migrations) {
    if (!existing.has(name)) await db.execAsync(sql);
  }

  const photoColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(BrewLogPhotos)');
  if (!new Set(photoColumns.map(column => column.name)).has('photo_type')) {
    await db.execAsync("ALTER TABLE BrewLogPhotos ADD COLUMN photo_type TEXT NOT NULL DEFAULT 'espresso_result'");
  }

  const resourceColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(ResourceLinks)');
  const existingResource = new Set(resourceColumns.map(column => column.name));
  const resourceMigrations: Array<[string, string]> = [
    ['tag', 'ALTER TABLE ResourceLinks ADD COLUMN tag TEXT'],
    ['source_type', 'ALTER TABLE ResourceLinks ADD COLUMN source_type TEXT'],
    ['published_date', 'ALTER TABLE ResourceLinks ADD COLUMN published_date TEXT'],
  ];
  for (const [name, sql] of resourceMigrations) {
    if (!existingResource.has(name)) await db.execAsync(sql);
  }
};
