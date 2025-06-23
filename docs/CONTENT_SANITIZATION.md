# Content Sanitization in Chrome Extensions

## Problem

When using `chrome.scripting.executeScript`, the executed function runs in the content script context of the target page, which doesn't have access to background script variables like `DOMPurify`.

## Solutions

### Solution 1: Pre-sanitization (Recommended) ✅

**Implementation**: Already applied to `background.ts`

Sanitize content in the background script before passing it to the content script. This is the cleanest approach because:

- All sanitization logic stays in one place
- No need to inject external libraries into content scripts
- Better performance (sanitization happens once)
- More secure (trusted context handles sanitization)

```typescript
// Sanitize in background script
const sanitizedContent = sanitizeHTML(content);
// Pass sanitized content to content script
```

### Solution 2: Library Injection

**Implementation**: Available in `src/lib/content-sanitizer.ts`

Inject DOMPurify into the page context before executing scripts that need it:

```typescript
// Inject library first
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['path/to/dompurify.min.js']
});

// Then execute script that uses the library
await chrome.scripting.executeScript({
  target: { tabId },
  func: () => {
    // DOMPurify is now available as window.DOMPurify
  }
});
```

### Solution 3: Inline Sanitizer

**Implementation**: Available in `src/lib/content-sanitizer.ts`

Create a simple sanitizer function that doesn't rely on external libraries:

```typescript
const createContentSanitizer = () => ({
  sanitize: (html: string): string => {
    // Basic sanitization logic
  }
});
```

## Recommendation

Use **Solution 1** (pre-sanitization) because it:

- Follows the principle of least privilege
- Keeps sanitization logic centralized
- Avoids potential conflicts with page scripts
- Is more performant
- Is easier to maintain and test

## Security Notes

1. Always sanitize user content before injection
2. Use trusted contexts (background/service worker) for sanitization
3. Minimize code execution in content script context
4. Validate all inputs from external sources (popup, web pages)
