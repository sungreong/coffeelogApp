export type AiProvider = 'none' | 'openai' | 'gemini';
export type AiKeyProvider = Exclude<AiProvider, 'none'>;
export type AiKeyTestStatus = 'untested' | 'success' | 'failed';
export type CsvEncoding = 'utf8-bom' | 'cp949';
export type RecordingMode = 'quick' | 'guided' | 'precision';
export type TermHelpVisibility = 'off' | 'minimal' | 'recommended' | 'full';
export type TimeMeasurementSource = 'manual' | 'in_app_timer' | 'external_scale' | 'external_timer' | 'estimated';
export type DoseMode = 'auto' | 'manual';
export type BasketType = 'single_wall_1cup' | 'single_wall_2cup' | 'dual_wall_1cup' | 'dual_wall_2cup';
export type ShotButton = '1cup' | '2cup' | 'manual';
export type DoseLevel = 'under' | 'ideal' | 'a_bit_more' | 'over' | 'unknown';
export type PressureZone = 'low' | 'espresso_range' | 'high' | 'unknown';
export type NextAction = 'keep' | 'grind_finer' | 'grind_coarser' | 'increase_yield' | 'decrease_yield' | 'increase_dose' | 'decrease_dose';
export type BrewPhotoType = 'bean_label' | 'roast_date_label' | 'grind_dial' | 'dose_gauge' | 'tamped_puck' | 'pressure_gauge' | 'espresso_result' | 'spent_puck' | 'clean_descale_light';
export type ResourceSourceType = 'official' | 'manual' | 'youtube' | 'community' | 'note';
export type BeanLotStatus = 'unopened' | 'open' | 'finished' | 'archived';
export type CoffeeProductUserStatus = 'normal' | 'wishlist' | 'archived';

export interface CoffeeProduct {
  id: string;
  name: string;
  roastery: string | null;
  origin: string | null;
  variety: string | null;
  process: string | null;
  roastLevel: string | null;
  tastingNotes: string | null;
  userStatus: CoffeeProductUserStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoffeePurchaseLot {
  id: string;
  productId: string;
  purchaseDate: string | null;
  roastDate: string | null;
  openedDate: string | null;
  expiryDate: string | null;
  storageType: string | null;
  initialWeightGram: number | null;
  remainingWeightGram: number | null;
  lotStatus: BeanLotStatus;
  seller: string | null;
  price: number | null;
  lotMemo: string | null;
  mainPhotoUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bean {
  id: string;
  productId: string | null;
  name: string;
  roastery: string | null;
  origin: string | null;
  variety: string | null;
  process: string | null;
  roastLevel: string | null;
  purchaseDate: string | null;
  roastDate: string | null;
  openedDate: string | null;
  expiryDate: string | null;
  storageType: string | null;
  initialWeightGram: number | null;
  remainingWeightGram: number | null;
  lotStatus: BeanLotStatus;
  seller: string | null;
  price: number | null;
  lotMemo: string | null;
  memo: string | null;
  mainPhotoUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeanPhoto {
  id: string;
  beanId: string;
  photoUri: string;
  photoType: string;
  createdAt: string;
}

export interface BeanDefaultSetting {
  id: string;
  beanId: string;
  equipmentProfileId: string | null;
  grindSize: string | null;
  speed: string | null;
  grindSeconds: number | null;
  doseGram: number | null;
  yieldGram: number | null;
  targetBrewSeconds: number | null;
  drinkType: string | null;
  memo: string | null;
}

export interface BrewLog {
  id: string;
  beanId: string;
  purchaseLotId: string | null;
  beanName?: string;
  roastery?: string | null;
  equipmentProfileId: string | null;
  brewedAt: string;
  recordingModeUsed: RecordingMode | null;
  drinkType: string | null;
  doseMode: DoseMode | null;
  basketType: BasketType | null;
  shotButton: ShotButton | null;
  grindSize: string | null;
  grindSizeExternal: number | null;
  innerBurrSetting: number | null;
  speed: string | null;
  grindSeconds: number | null;
  actualDoseGram: number | null;
  doseGram: number | null;
  yieldGram: number | null;
  brewSeconds: number | null;
  firstDripSeconds: number | null;
  timeMeasurementSource: TimeMeasurementSource | null;
  waterTemperature: number | null;
  temperatureOffset: number | null;
  preinfusion: boolean;
  preinfusionSeconds: number | null;
  basket: string | null;
  doseLevel: DoseLevel | null;
  pressureZone: PressureZone | null;
  usedABitMore: boolean;
  usedRazorTrim: boolean;
  autoDoseResetDone: boolean;
  programmedVolumeChanged: boolean;
  nextAction: NextAction | null;
  puckPrep: string | null;
  tamping: string | null;
  channeling: string | null;
  shotResult: string | null;
  waterMl: number | null;
  milkMl: number | null;
  servingTemperature: string | null;
  rating: number | null;
  acidity: number | null;
  sweetness: number | null;
  bitterness: number | null;
  body: number | null;
  isFavorite: boolean;
  resultMemo: string | null;
  photoUri: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrewLogPhoto {
  id: string;
  brewLogId: string;
  photoUri: string;
  photoType: BrewPhotoType;
  createdAt: string;
}

export interface PendingTimerResult {
  brewSeconds: number;
  firstDripSeconds: number | null;
  preinfusionSeconds: number | null;
  measuredAt: string;
  source: 'in_app_timer';
}

export interface AiAnalysisParsed {
  bean_name: string | null;
  roastery: string | null;
  origin: string | null;
  variety: string | null;
  process: string | null;
  roast_level: string | null;
  purchase_date?: string | null;
  roast_date: string | null;
  opened_date?: string | null;
  expiry_date: string | null;
  weight: string | null;
  initial_weight_gram?: number | null;
  seller?: string | null;
  price?: number | null;
  recommended_brew_method: string | null;
  visible_text_summary: string | null;
  uncertain_fields: string[];
  warnings?: string[];
  conflicts?: Array<{ field: string; candidates: Array<{ value: string; evidenceText?: string | null; sourcePhotoIds?: string[] }> }>;
  unknown_dates?: Array<{ rawText: string; normalizedDate?: string | null; possibleMeanings?: string[]; evidenceText?: string | null; sourcePhotoIds?: string[] }>;
}

export interface AiKeyMeta {
  id: string;
  provider: AiKeyProvider;
  label: string;
  maskedKey: string;
  createdAt: string;
  lastTestedAt: string | null;
  lastTestStatus: AiKeyTestStatus;
  active: boolean;
}

export interface AiAnalysisResult {
  id: string;
  provider: AiProvider;
  modelName: string;
  beanId: string | null;
  photoUri: string;
  rawJson: string;
  parsedJson: string;
  uncertainFields: string;
  createdAt: string;
}

export interface CoffeeStats {
  beanCount: number;
  logCount: number;
  recent7DaysCount: number;
  topBeanName: string;
  averageRating: number | null;
}

export interface EquipmentProfile {
  id: string;
  name: string;
  type: string | null;
  brand: string | null;
  model: string | null;
  memo: string | null;
}

export interface ResourceGroup {
  id: string;
  equipmentProfileId: string;
  name: string;
  memo: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResourceLink {
  id: string;
  groupId: string;
  title: string;
  url: string;
  memo: string | null;
  tag: string | null;
  sourceType: ResourceSourceType | null;
  publishedDate: string | null;
  createdAt: string;
  updatedAt: string;
}
