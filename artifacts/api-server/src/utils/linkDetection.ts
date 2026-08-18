const LINK_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>"']+|(?:https?:\/\/)?(?:chat\.whatsapp\.com|wa\.me|t\.me|instagram\.com|www\.instagram\.com|tiktok\.com|www\.tiktok\.com|facebook\.com|www\.facebook\.com|youtube\.com|www\.youtube\.com|discord\.gg|discord\.com)\/[^\s<>"']+/i;

/**
 * Detects URLs and common social/invite links without treating punctuation as a link.
 */
export function detectLinks(text: string): boolean {
  return LINK_PATTERN.test(text);
}