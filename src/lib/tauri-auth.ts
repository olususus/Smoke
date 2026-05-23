/** Normalize Tauri command payloads (may be snake_case or camelCase). */

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface PollResult {
  status: string;
  token?: string;
  username?: string;
  avatarUrl?: string;
  retryAfterSecs?: number;
  message?: string;
}

type UnknownRecord = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export function normalizeDeviceCode(raw: unknown): DeviceCodeResponse {
  const r = (raw ?? {}) as UnknownRecord;
  const deviceCode = str(r.deviceCode) || str(r.device_code);
  const userCode = str(r.userCode) || str(r.user_code);
  const verificationUri =
    str(r.verificationUri) || str(r.verification_uri) || "https://github.com/login/device";
  const expiresIn = num(r.expiresIn ?? r.expires_in, 900);
  const interval = num(r.interval, 5);

  if (!deviceCode || !userCode) {
    throw new Error("Invalid device code response from GitHub");
  }

  return { deviceCode, userCode, verificationUri, expiresIn, interval };
}

export function normalizePollResult(raw: unknown): PollResult {
  const r = (raw ?? {}) as UnknownRecord;
  const retryRaw = r.retryAfterSecs ?? r.retry_after_secs;
  return {
    status: str(r.status) || "pending",
    token: str(r.token) || undefined,
    username: str(r.username) || undefined,
    avatarUrl: str(r.avatarUrl) || str(r.avatar_url) || undefined,
    retryAfterSecs: typeof retryRaw === "number" && retryRaw > 0 ? retryRaw : undefined,
    message: str(r.message) || undefined,
  };
}
