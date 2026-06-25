import storage from "@system.storage"
import { MFA_ACCOUNTS } from "./totp"

const STORAGE_KEY = "mfa_config_snapshot"

export function loadMfaAccounts(callback) {
  storage.get({
    key: STORAGE_KEY,
    default: "",
    success(data) {
      callback(parseStoredAccounts(data))
    },
    fail() {
      callback(defaultAccounts())
    }
  })
}

export function saveMfaAccounts(accounts, callback) {
  const payload = JSON.stringify({
    version: 1,
    updatedAt: Date.now(),
    configs: normalizeAccounts(accounts)
  })

  storage.set({
    key: STORAGE_KEY,
    value: payload,
    success() {
      if (callback) {
        callback(true)
      }
    },
    fail() {
      if (callback) {
        callback(false)
      }
    }
  })
}

export function parseConfigSnapshot(rawPayload) {
  try {
    const snapshot = typeof rawPayload === "object" ? rawPayload : JSON.parse(rawPayload)
    if (!snapshot || snapshot.type !== "mfa_config_snapshot") {
      return null
    }
    return {
      version: snapshot.version || 1,
      sentAt: snapshot.sentAt || Date.now(),
      configs: normalizeAccounts(snapshot.configs || [])
    }
  } catch (error) {
    return null
  }
}

export function normalizeAccounts(accounts) {
  if (!Array.isArray(accounts)) {
    return []
  }

  const normalized = []
  for (let index = 0; index < accounts.length; index++) {
    const account = normalizeAccount(accounts[index])
    if (account) {
      normalized.push(account)
    }
  }
  return normalized
}

export function findAccountById(accounts, id) {
  for (let index = 0; index < accounts.length; index++) {
    if (accounts[index].id === id) {
      return accounts[index]
    }
  }
  return accounts[0] || null
}

function parseStoredAccounts(data) {
  if (!data) {
    return defaultAccounts()
  }

  try {
    const stored = JSON.parse(data)
    if (stored && Array.isArray(stored.configs)) {
      return normalizeAccounts(stored.configs)
    }
    return defaultAccounts()
  } catch (error) {
    return defaultAccounts()
  }
}

function normalizeAccount(account) {
  if (!account || !account.secret) {
    return null
  }

  const secret = String(account.secret).toUpperCase().replace(/[\s=-]/g, "")
  if (!secret) {
    return null
  }

  return {
    id: String(account.id || `${account.issuer || "issuer"}-${account.accountName || Date.now()}`),
    issuer: String(account.issuer || "Issuer"),
    accountName: String(account.accountName || "Account"),
    secret,
    digits: normalizeNumber(account.digits, 6, 6, 8),
    period: normalizeNumber(account.period, 30, 15, 120),
    algorithm: "SHA1",
    updatedAt: account.updatedAt || Date.now()
  }
}

function normalizeNumber(value, fallback, min, max) {
  const parsed = Number(value)
  if (isNaN(parsed)) {
    return fallback
  }
  return Math.max(min, Math.min(max, parsed))
}

function defaultAccounts() {
  return normalizeAccounts(MFA_ACCOUNTS)
}
