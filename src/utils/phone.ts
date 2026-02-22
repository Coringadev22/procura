/**
 * Brazilian phone number normalization and validation utilities.
 * All normalized phones are in E.164 format: +5511999998888
 */

/** Strip all non-digit characters */
function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalize a raw Brazilian phone string to E.164 format.
 * Accepts: "11 99999-8888", "(11)999998888", "5511999998888", "+5511999998888", etc.
 * Returns null if invalid.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  let digits = digitsOnly(raw);

  // Remove leading zeros
  digits = digits.replace(/^0+/, "");

  // If starts with 55 and has 12-13 digits, it already has country code
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    // Already has country code
  } else if (digits.length === 10 || digits.length === 11) {
    // DDD + number (10 = landline, 11 = mobile)
    digits = "55" + digits;
  } else {
    return null; // Invalid length
  }

  const ddd = parseInt(digits.substring(2, 4), 10);
  if (ddd < 11 || ddd > 99) return null;

  const numberPart = digits.substring(4);

  // Mobile: 9 digits starting with 9
  if (numberPart.length === 9 && numberPart.startsWith("9")) {
    return "+" + digits;
  }

  // Landline: 8 digits starting with 2-5
  const firstDigit = parseInt(numberPart[0], 10);
  if (numberPart.length === 8 && firstDigit >= 2 && firstDigit <= 5) {
    return "+" + digits;
  }

  return null; // Invalid pattern
}

/**
 * Check if a normalized E.164 phone is a valid Brazilian number.
 */
export function isValidBrazilianPhone(normalized: string): boolean {
  if (!normalized.startsWith("+55")) return false;
  const digits = normalized.substring(1); // remove +
  return digits.length === 12 || digits.length === 13;
}

/**
 * Check if a normalized E.164 phone is a mobile number.
 * Mobile numbers have 13 chars: +55XX9XXXXXXXX
 */
export function isMobilePhone(normalized: string): boolean {
  if (!normalized.startsWith("+55")) return false;
  const digits = normalized.substring(1);
  // 13 digits total (55 + DDD + 9-digit mobile)
  return digits.length === 13 && digits[4] === "9";
}

/**
 * Parse a raw phone string that may contain multiple phones
 * (comma, semicolon, or slash separated).
 * Returns array of normalized valid phones.
 */
export function parsePhoneList(raw: string): string[] {
  if (!raw || !raw.trim()) return [];

  const parts = raw.split(/[,;/]+/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    const normalized = normalizePhone(part);
    if (normalized) {
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Merge multiple phone sources, deduplicate, and prioritize mobile numbers first.
 * Returns comma-separated string of normalized phones, or null if none.
 */
export function mergePhones(
  existing: string | null,
  ...newPhones: (string | null | string[])[]
): string | null {
  const all = new Set<string>();

  // Parse existing
  if (existing) {
    for (const p of parsePhoneList(existing)) {
      all.add(p);
    }
  }

  // Add new phones
  for (const source of newPhones) {
    if (!source) continue;
    if (Array.isArray(source)) {
      for (const p of source) {
        const n = normalizePhone(p);
        if (n) all.add(n);
      }
    } else {
      for (const p of parsePhoneList(source)) {
        all.add(p);
      }
    }
  }

  if (all.size === 0) return null;

  // Sort: mobile first, then landline
  const sorted = [...all].sort((a, b) => {
    const aMobile = isMobilePhone(a) ? 0 : 1;
    const bMobile = isMobilePhone(b) ? 0 : 1;
    return aMobile - bMobile;
  });

  return sorted.join(", ");
}
