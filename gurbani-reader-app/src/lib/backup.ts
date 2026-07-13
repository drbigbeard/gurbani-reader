import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { PersonalData, ReaderPreferences } from './persistence';

export interface GurbaniReaderBackup {
  format: 'gurbani-reader-backup';
  version: 1;
  exportedAt: string;
  personal: PersonalData;
  preferences: ReaderPreferences;
}

export async function exportBackup(personal: PersonalData, preferences: ReaderPreferences): Promise<void> {
  const backup: GurbaniReaderBackup = { format: 'gurbani-reader-backup', version: 1, exportedAt: new Date().toISOString(), personal, preferences };
  const data = JSON.stringify(backup, null, 2); const name = `Gurbani-Reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const uri = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({ title: 'Gurbani Reader backup', text: 'Bookmarks, notes, collections and preferences', url: uri.uri, dialogTitle: 'Save or share backup' });
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}

export function parseBackup(text: string): GurbaniReaderBackup {
  const parsed = JSON.parse(text) as Partial<GurbaniReaderBackup>;
  if (parsed.format !== 'gurbani-reader-backup' || parsed.version !== 1 || !parsed.personal || !parsed.preferences) throw new Error('Not a Gurbani Reader backup');
  return parsed as GurbaniReaderBackup;
}
