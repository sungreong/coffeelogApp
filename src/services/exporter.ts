import Encoding from 'encoding-japanese';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { zipSync } from 'fflate';
import { getAllBeanPhotos, getEquipmentProfiles, getResourceGroups, getResourceLinks } from '../db/queries';
import { Bean, BrewLog, CsvEncoding } from '../types/models';

interface ExportOptions {
  scopeLabel?: string;
}

const safeFilePart = (value: string | null | undefined) => {
  const text = (value ?? 'all').trim().replace(/[\\/:*?"<>|\s]+/g, '_');
  return text.length ? text : 'all';
};

const csvEscape = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const base64FromBytes = (bytes: Uint8Array) => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(binary);
};

const writeText = async (uri: string, text: string, encoding: CsvEncoding) => {
  if (encoding === 'utf8-bom') {
    await FileSystem.writeAsStringAsync(uri, `\uFEFF${text}`);
    return;
  }
  const sjis = Encoding.convert(Encoding.stringToCode(text), { to: 'SJIS', from: 'UNICODE', type: 'array' });
  await FileSystem.writeAsStringAsync(uri, base64FromBytes(Uint8Array.from(sjis)), { encoding: FileSystem.EncodingType.Base64 });
};

export const buildCsv = (logs: BrewLog[]) => {
  const header = [
    'record_id', 'created_at', 'recording_mode_used', 'drink_type', 'bean_name', 'roastery', 'dose_mode', 'basket_type', 'shot_button', 'grind_size',
    'grind_size_external', 'inner_burr_setting', 'grind_seconds', 'speed', 'actual_dose_g', 'dose_g', 'yield_g', 'brew_seconds',
    'first_drip_seconds', 'time_measurement_source', 'water_temperature', 'temperature_offset', 'preinfusion', 'preinfusion_seconds', 'dose_level',
    'pressure_zone', 'used_a_bit_more', 'used_razor_trim', 'auto_dose_reset_done', 'programmed_volume_changed', 'next_action',
    'basket', 'puck_prep', 'tamping', 'channeling', 'shot_result', 'water_ml', 'milk_ml', 'serving_temperature', 'rating',
    'acidity', 'sweetness', 'bitterness', 'body', 'memo', 'photo_count',
  ];
  const rows = logs.map(log => [
    log.id,
    log.brewedAt,
    log.recordingModeUsed ?? '',
    log.drinkType ?? '',
    log.beanName ?? '',
    log.roastery ?? '',
    log.doseMode ?? '',
    log.basketType ?? '',
    log.shotButton ?? '',
    log.grindSize ?? '',
    log.grindSizeExternal ?? '',
    log.innerBurrSetting ?? '',
    log.grindSeconds ?? '',
    log.speed ?? '',
    log.actualDoseGram ?? '',
    log.doseGram ?? '',
    log.yieldGram ?? '',
    log.brewSeconds ?? '',
    log.firstDripSeconds ?? '',
    log.timeMeasurementSource ?? '',
    log.waterTemperature ?? '',
    log.temperatureOffset ?? '',
    log.preinfusion ? 'Y' : '',
    log.preinfusionSeconds ?? '',
    log.doseLevel ?? '',
    log.pressureZone ?? '',
    log.usedABitMore ? 'Y' : '',
    log.usedRazorTrim ? 'Y' : '',
    log.autoDoseResetDone ? 'Y' : '',
    log.programmedVolumeChanged ? 'Y' : '',
    log.nextAction ?? '',
    log.basket ?? '',
    log.puckPrep ?? '',
    log.tamping ?? '',
    log.channeling ?? '',
    log.shotResult ?? '',
    log.waterMl ?? '',
    log.milkMl ?? '',
    log.servingTemperature ?? '',
    log.rating ?? '',
    log.acidity ?? '',
    log.sweetness ?? '',
    log.bitterness ?? '',
    log.body ?? '',
    log.resultMemo ?? '',
    log.photoUri ? 1 : 0,
  ]);
  return [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\r\n');
};

export const exportCsv = async (logs: BrewLog[], encoding: CsvEncoding, options: ExportOptions = {}) => {
  const fileName = `coffeelog_logs_${safeFilePart(options.scopeLabel)}_${new Date().toISOString().slice(0, 10)}_${encoding}.csv`;
  const uri = `${FileSystem.documentDirectory}${fileName}`;
  await writeText(uri, buildCsv(logs), encoding);
  await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'CoffeeLog 추출 기록 CSV' });
  return uri;
};

export const exportJson = async (beans: Bean[], logs: BrewLog[], options: ExportOptions = {}) => {
  const uri = `${FileSystem.documentDirectory}coffeelog_backup_${safeFilePart(options.scopeLabel)}_${new Date().toISOString().slice(0, 10)}.json`;
  const beanIds = new Set(beans.map(bean => bean.id));
  const [allBeanPhotos, equipment, resourceGroups, resourceLinks] = await Promise.all([getAllBeanPhotos(), getEquipmentProfiles(), getResourceGroups(), getResourceLinks()]);
  const beanPhotos = allBeanPhotos.filter(photo => beanIds.has(photo.beanId));
  const data = {
    export_version: 1,
    exported_at: new Date().toISOString(),
    scope: options.scopeLabel ?? '전체',
    beans,
    bean_photos: beanPhotos,
    brew_logs: logs,
    equipment_profiles: equipment,
    resource_groups: resourceGroups,
    resource_links: resourceLinks,
    photos: [...new Set([...beans.map(bean => bean.mainPhotoUri), ...beanPhotos.map(photo => photo.photoUri), ...logs.map(log => log.photoUri)].filter(Boolean))],
  };
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
  await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'CoffeeLog JSON Export' });
  return uri;
};

export const exportZip = async (beans: Bean[], logs: BrewLog[], options: ExportOptions = {}) => {
  const beanIds = new Set(beans.map(bean => bean.id));
  const [allBeanPhotos, equipment, resourceGroups, resourceLinks] = await Promise.all([getAllBeanPhotos(), getEquipmentProfiles(), getResourceGroups(), getResourceLinks()]);
  const beanPhotos = allBeanPhotos.filter(photo => beanIds.has(photo.beanId));
  const files: Record<string, Uint8Array> = {
    'data/export.json': new TextEncoder().encode(JSON.stringify({ export_version: 1, exported_at: new Date().toISOString(), scope: options.scopeLabel ?? '전체', beans, bean_photos: beanPhotos, brew_logs: logs, equipment_profiles: equipment, resource_groups: resourceGroups, resource_links: resourceLinks }, null, 2)),
  };
  let index = 1;
  const photoUris = [...new Set([...beans.map(b => b.mainPhotoUri), ...beanPhotos.map(p => p.photoUri), ...logs.map(l => l.photoUri)].filter(Boolean) as string[])];
  for (const uri of photoUris) {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      files[`photos/photo_${String(index).padStart(4, '0')}.jpg`] = bytes;
      index += 1;
    } catch {
      // Skip photo URIs Android no longer grants.
    }
  }
  const zipped = zipSync(files);
  const uri = `${FileSystem.documentDirectory}coffeelog_backup_${safeFilePart(options.scopeLabel)}_${new Date().toISOString().slice(0, 10)}.zip`;
  await FileSystem.writeAsStringAsync(uri, base64FromBytes(zipped), { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'application/zip', dialogTitle: 'CoffeeLog ZIP Export' });
  return uri;
};
