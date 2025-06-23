# Storage System Documentation

## Overview

The storage system provides a flexible way to manage different types of content in Chrome extension storage with proper key prefixing and type safety.

## Basic Usage

### Default Storage Instance

```typescript
import { Storage } from '@/lib/config';

// Store content
await Storage.storeContent('user123', '<p>Hello World</p>');

// Retrieve content
const content = await Storage.getContent('user123');

// Remove content
await Storage.removeContent('user123');

// Clear all content for this storage instance
await Storage.clearAllContent();
```

### Creating Custom Storage Instances

```typescript
import { createStorage } from '@/lib/config';

// Create specialized storage instances
const contentStorage = createStorage('abscribe_content');
const tempStorage = createStorage('temp_data');
const cacheStorage = createStorage('cache');
const userPrefsStorage = createStorage('user_prefs');

// Each instance manages its own namespace
await contentStorage.storeContent('doc1', '<p>Document content</p>');
await tempStorage.storeContent('doc1', '<p>Temporary data</p>');
await cacheStorage.storeContent('doc1', '<p>Cached data</p>');

// Storage keys will be:
// - abscribe_content_doc1
// - temp_data_doc1  
// - cache_doc1
```

## Key Features

- **Namespaced Storage**: Each storage instance uses a unique prefix to avoid key conflicts
- **Type Safety**: Full TypeScript support with proper interfaces
- **Consistent API**: All storage instances share the same interface
- **Automatic Cleanup**: Easy cleanup of storage data by prefix
- **Logging**: Built-in logging for debugging and monitoring
- **Timestamps**: Automatic timestamp tracking for stored content

## Migration Notes

The default `Storage` instance maintains backward compatibility with the previous `abscribe_content_` prefix, so existing code continues to work without changes.
