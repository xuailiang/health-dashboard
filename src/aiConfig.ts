const AI_KEY_STORAGE = 'health-dashboard-ai-key'
const AI_URL_STORAGE = 'health-dashboard-ai-url'
const AI_MODEL_STORAGE = 'health-dashboard-ai-model'

export const DEFAULT_AI_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_AI_MODEL = 'anthropic/claude-sonnet-4.6'

export function getStoredAiKey(): string | null {
  const envKey = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined
  if (envKey) return envKey
  return localStorage.getItem(AI_KEY_STORAGE) || sessionStorage.getItem('openrouter_key')
}

export function hasEnvAiKey(): boolean {
  return Boolean(import.meta.env.VITE_OPENROUTER_API_KEY)
}

export function setStoredAiKey(key: string, storage: 'local' | 'session' = 'local') {
  if (storage === 'session') sessionStorage.setItem('openrouter_key', key)
  else localStorage.setItem(AI_KEY_STORAGE, key)
}

export function clearStoredAiKey() {
  localStorage.removeItem(AI_KEY_STORAGE)
  sessionStorage.removeItem('openrouter_key')
}

export function getStoredAiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_AI_BASE_URL as string | undefined
  if (envUrl) return envUrl
  return localStorage.getItem(AI_URL_STORAGE) || sessionStorage.getItem('ai_base_url') || DEFAULT_AI_BASE_URL
}

export function setStoredAiBaseUrl(url: string, storage: 'local' | 'session' = 'local') {
  if (storage === 'session') sessionStorage.setItem('ai_base_url', url)
  else localStorage.setItem(AI_URL_STORAGE, url)
}

export function getStoredAiModel(defaultModel = DEFAULT_AI_MODEL): string {
  const envModel = import.meta.env.VITE_AI_MODEL as string | undefined
  if (envModel) return envModel
  return localStorage.getItem(AI_MODEL_STORAGE) || sessionStorage.getItem('ai_model_name') || defaultModel
}

export function setStoredAiModel(model: string, storage: 'local' | 'session' = 'local') {
  if (storage === 'session') sessionStorage.setItem('ai_model_name', model)
  else localStorage.setItem(AI_MODEL_STORAGE, model)
}
