import type { ProjectLanguage } from './projectTypes'

export const DEFAULT_LANGUAGE: ProjectLanguage = { code: 'en', name: 'English' }

export const LANGUAGE_OPTIONS: ProjectLanguage[] = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'es', name: 'Spanish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
]

export function languageNameForCode(code?: string) {
  return LANGUAGE_OPTIONS.find((language) => language.code === code)?.name || DEFAULT_LANGUAGE.name
}

export function normalizeLanguage(language?: Partial<ProjectLanguage> | null): ProjectLanguage {
  if (!language?.code) return DEFAULT_LANGUAGE
  return {
    code: language.code,
    name: language.name || languageNameForCode(language.code),
  }
}

export async function resolveConfiguredLanguage(detected?: ProjectLanguage | null): Promise<ProjectLanguage> {
  try {
    const config = await window.electronAPI.getConfig()
    if (config.languageMode === 'manual' && config.languageCode) {
      return normalizeLanguage({ code: config.languageCode, name: config.languageName })
    }
  } catch {
    // Fall back to detected/default language when config is unavailable.
  }
  return normalizeLanguage(detected)
}

export async function getManualLanguageOverride(): Promise<ProjectLanguage | undefined> {
  try {
    const config = await window.electronAPI.getConfig()
    if (config.languageMode === 'manual' && config.languageCode) {
      return normalizeLanguage({ code: config.languageCode, name: config.languageName })
    }
  } catch {
    // No configured override.
  }
  return undefined
}
