import DOMPurify from 'dompurify';

// Configure DOMPurify with allowed tags and attributes for safe HTML rendering
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
  'blockquote', 'pre', 'code', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'style'];

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Uses DOMPurify with a restrictive allowlist of tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target'], // Allow target attribute for links
  });
}

/**
 * Creates a safe innerHTML object for React's dangerouslySetInnerHTML
 */
export function createSafeHtml(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) };
}
