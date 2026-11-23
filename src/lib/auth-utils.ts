import crypto from 'crypto';

/**
 * Hash a 4-digit PIN using SHA-256 for secure storage.
 */
export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin.trim()).digest('hex');
}

/**
 * Verify an input PIN against a stored PIN (supports both hashed and legacy plain text).
 */
export function verifyPin(inputPin: string, storedPin?: string | null): boolean {
  if (!storedPin) return false;
  const trimmed = inputPin.trim();
  const hashed = hashPin(trimmed);
  return storedPin === hashed || storedPin === trimmed;
}

/**
 * Check if the input is a valid 4-digit numeric PIN.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}
