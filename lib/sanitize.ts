/**
 * Input sanitization utilities to prevent XSS attacks
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Remove potentially dangerous HTML tags while preserving content
 */
export function stripHtmlTags(text: string): string {
  if (!text) return '';
  return text
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all other HTML tags but keep content
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize user input for storage
 * - Escapes HTML entities
 * - Removes control characters
 * - Trims whitespace
 */
export function sanitizeInput(text: string): string {
  if (!text) return '';
  return escapeHtml(text)
    // Remove control characters (except newlines and tabs)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize for display (use when rendering user content)
 * More aggressive - strips all HTML
 */
export function sanitizeForDisplay(text: string): string {
  if (!text) return '';
  return stripHtmlTags(text)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
}

/**
 * Sanitize URL - only allow http/https protocols
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize a bounty creation request
 */
export function sanitizeBountyInput(data: {
  question?: string;
  description?: string;
  tags?: string[];
}): {
  question: string;
  description?: string;
  tags: string[];
} {
  return {
    question: sanitizeInput(data.question || ''),
    description: data.description ? sanitizeInput(data.description) : undefined,
    tags: (data.tags || []).map(tag => sanitizeInput(tag).toLowerCase().slice(0, 50)),
  };
}
