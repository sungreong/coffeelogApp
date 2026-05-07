import * as FileSystem from 'expo-file-system/legacy';
import { createId } from '../utils';

const photoDir = `${FileSystem.documentDirectory}photos/`;

const getExtension = (uri: string) => {
  const clean = uri.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.heic')) return 'heic';
  return 'jpg';
};

export const persistPhoto = async (sourceUri: string, prefix = 'photo') => {
  await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
  const targetUri = `${photoDir}${prefix}_${createId()}.${getExtension(sourceUri)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  return targetUri;
};

export const deletePhotoFile = async (uri: string | null | undefined) => {
  if (!uri || !FileSystem.documentDirectory || !uri.startsWith(photoDir)) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // File cleanup should never block the user's data flow.
  }
};

export const clearPhotoDirectory = async () => {
  try {
    const info = await FileSystem.getInfoAsync(photoDir);
    if (info.exists) await FileSystem.deleteAsync(photoDir, { idempotent: true });
  } catch {
    // Best-effort cleanup; DB reset remains the source of truth.
  }
};
