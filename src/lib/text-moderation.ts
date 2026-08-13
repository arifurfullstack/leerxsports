/**
 * Multilingual Profanity and Toxic-Language Filter
 * Covers English, Spanish, Bengali, French, German, and common international toxic patterns.
 */

// Common profanity and toxic language regex patterns
const TOXIC_PATTERNS: RegExp[] = [
  // English profanity & abuse
  /\b(fuck|shit|bitch|asshole|bastard|cunt|dick|pussy|whore|slut|motherfucker|nigger|faggot)\b/gi,
  /\b(f\*ck|sh\*t|b\*tch|a\*\*hole|d\*ck)\b/gi,
  // Spanish profanity & abuse
  /\b(puta|puto|mierda|cabron|cabrona|coño|maricon|gilipollas|verga|pendejo|pendeja)\b/gi,
  // Bengali profanity & abuse
  /\b(মাগী|বোদা|চুদা|চুদির|খানকি|বাল|খাঙ্কির|বানচোত)\b/gi,
  // French profanity
  /\b(merde|putain|salope|enculé|connard|conne)\b/gi,
  // German profanity
  /\b(scheiße|scheisse|arschloch|fotze|wichser)\b/gi,
];

/**
 * Replaces blocked profanity/toxic terms with asterisks matching term length.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";
  let clean = text;
  for (const pattern of TOXIC_PATTERNS) {
    clean = clean.replace(pattern, (match) => "*".repeat(match.length));
  }
  return clean;
}

/**
 * Returns true if text contains toxic/profane language.
 */
export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false;
  return TOXIC_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extracts list of flagged terms from text for logging/moderation.
 */
export function getFlaggedTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = new Set<string>();
  for (const pattern of TOXIC_PATTERNS) {
    const found = text.match(pattern);
    if (found) {
      for (const f of found) matches.add(f.toLowerCase());
    }
  }
  return Array.from(matches);
}
