# Web Workers Documentation

This document provides detailed information about the Web Workers used in the WebSocket Time Machine component.

## Overview

The component uses a Web Worker-based architecture to handle large datasets (12,000+ messages, 12MB) without blocking the main UI thread. This results in a 99.6% memory reduction in the main thread and significantly improved performance.

## Architecture

```
Main Thread (UI)          Web Workers (Background)
─────────────────         ─────────────────────────
│ Svelte Component │  ←→  │ messageStorage.worker.js │
│ (~100KB memory)  │      │ (stores 12MB of messages) │
│                  │  ←→  │ jsonParser.worker.js     │
│ Displays 50 msgs │      │ (parses JSON on import)  │
└──────────────────┘      └──────────────────────────┘
```

## Workers

### 1. jsonParser.worker.js

**Purpose:** Offloads JSON parsing from the main thread to prevent UI blocking when importing large files.

**API:**

#### Input (from main thread):
```javascript
{
  fileContent: string  // JSON file content as a string
}
```

#### Output (to main thread):
```javascript
// Success
{
  success: true,
  data: Array<Object>  // Parsed JSON data
}

// Error
{
  success: false,
  error: string  // Error message
}
```

**Usage Example:**
```javascript
const worker = new Worker(new URL('./jsonParser.worker.js', import.meta.url), { type: 'module' });

worker.onmessage = (event) => {
  if (event.data.success) {
    console.log('Parsed data:', event.data.data);
  } else {
    console.error('Parse error:', event.data.error);
  }
  worker.terminate();
};

worker.postMessage({ fileContent: jsonString });
```

### 2. messageStorage.worker.js

**Purpose:** Single source of truth for all message data. Stores the complete dataset and serves paginated slices to the main app.

**State:**
- `messages`: Complete array of all messages (12,000+)
- `filteredIndices`: Array of indices matching current filters
- `groupedData`: Messages grouped by request ID

**API:**

#### Actions

##### setMessages
Store the complete message dataset (typically from import).

**Input:**
```javascript
{
  action: 'setMessages',
  data: {
    messages: Array<Message>
  }
}
```

**Output:**
```javascript
{
  success: true,
  action: 'setMessages',
  totalCount: number,
  filteredCount: number
}
```

##### appendMessages
Append new messages (for real-time WebSocket capture).

**Input:**
```javascript
{
  action: 'appendMessages',
  data: {
    messages: Array<Message>
  }
}
```

**Output:**
```javascript
{
  success: true,
  action: 'appendMessages',
  totalCount: number,
  filteredCount: number
}
```

**Note:** If a filter is active, new messages won't appear until the filter is re-applied.

##### filter
Apply filters and return filtered count (not the full dataset).

**Input:**
```javascript
{
  action: 'filter',
  data: {
    filterRequestId: string,      // Optional: filter by request ID
    customFilterField: string,     // Optional: field path (e.g., 'data.status')
    customFilterValue: string      // Optional: value to search for
  }
}
```

**Output:**
```javascript
{
  success: true,
  action: 'filter',
  filteredCount: number
}
```

##### getSlice
Request a paginated slice of filtered messages.

**Input:**
```javascript
{
  action: 'getSlice',
  data: {
    start: number,  // Start index
    end: number     // End index (exclusive)
  }
}
```

**Output:**
```javascript
{
  success: true,
  action: 'getSlice',
  slice: Array<Message>,     // Messages for this page
  totalCount: number,
  filteredCount: number
}
```

##### group
Group filtered messages by request ID.

**Input:**
```javascript
{
  action: 'group',
  data: {}
}
```

**Output:**
```javascript
{
  success: true,
  action: 'group',
  grouped: Array<[string, Array<Message>]>  // [requestId, messages] tuples
}
```

##### extractFields
Analyze message structure to extract all field paths and values.

**Input:**
```javascript
{
  action: 'extractFields',
  data: {}
}
```

**Output:**
```javascript
{
  success: true,
  action: 'extractFields',
  fields: Array<string>,              // All field paths
  primitiveFields: Array<string>,      // Primitive (filterable) fields
  fieldValues: Array<[string, Array<string>]>  // [fieldPath, values] tuples
}
```

##### export
Serialize messages for download.

**Input:**
```javascript
{
  action: 'export',
  data: {
    filtered: boolean  // true = export filtered only, false = export all
  }
}
```

**Output:**
```javascript
{
  success: true,
  action: 'export',
  messages: Array<Message>
}
```

##### clear
Reset all data (clear messages, filters, groups).

**Input:**
```javascript
{
  action: 'clear',
  data: {}
}
```

**Output:**
```javascript
{
  success: true,
  action: 'clear'
}
```

## Data Types

### Message
```typescript
interface Message {
  timestamp: string;        // ISO 8601 timestamp
  type: 'sent' | 'received'; // Message direction
  data: string | object;    // JSON string or parsed object
}
```

### Parsed Message Data
The `data` field typically contains:
```typescript
interface MessageData {
  requestId?: string;    // Request identifier
  action?: string;       // Action type (e.g., 'getUserProfile')
  status?: string;       // Response status (e.g., 'success')
  data?: any;           // Payload data
  [key: string]: any;   // Other fields
}
```

## Performance Characteristics

### Memory Usage
- **Before optimization:** Main thread held 24MB (12K messages + filtered copies)
- **After optimization:** Main thread holds ~100KB (50 visible messages only)
- **Reduction:** 99.6% memory savings in main thread

### Filter Performance
- **Single-pass algorithm:** ~50% faster than previous map+filter approach
- **Constants extracted:** Field path calculations moved outside loops
- **Indexed access:** Direct array indexing instead of full array operations

### Real-time Capture
- **Batching:** Messages buffered in groups of 10 or every 100ms
- **Async sync:** Non-blocking append to worker storage
- **Auto-scroll:** Intelligent page navigation when viewing last page

## Best Practices

### 1. Worker Lifecycle
```javascript
// Initialize once
const worker = new Worker(new URL('./messageStorage.worker.js', import.meta.url), { type: 'module' });

// Use for entire component lifecycle
// ...

// Cleanup on unmount
worker.terminate();
```

### 2. Error Handling
```javascript
worker.onmessage = (event) => {
  if (event.data.success) {
    // Handle success
  } else {
    console.error('Worker error:', event.data.error);
    // Show user-friendly error message
  }
};

worker.onerror = (error) => {
  console.error('Worker error:', error);
  // Fallback to main thread or show error UI
};
```

### 3. Pagination
Request slices as needed, not the full dataset:
```javascript
// Good: Request only current page
worker.postMessage({
  action: 'getSlice',
  data: { start: 0, end: 50 }
});

// Bad: Don't request all messages
// This defeats the purpose of the worker architecture
```

### 4. Filtering
Let the worker handle filtering logic:
```javascript
// Good: Send filter criteria to worker
worker.postMessage({
  action: 'filter',
  data: {
    filterRequestId: 'req-123',
    customFilterField: 'data.status',
    customFilterValue: 'success'
  }
});

// Then request a slice
worker.postMessage({
  action: 'getSlice',
  data: { start: 0, end: 50 }
});

// Bad: Don't filter in main thread
// const filtered = allMessages.filter(...); // Memory intensive
```

## Debugging

### Enable Worker Logging
Add console.log statements in worker files:
```javascript
// In messageStorage.worker.js
case 'filter':
  console.log('Filtering with:', actionData);
  // ... filter logic
  console.log('Filtered count:', indices.length);
```

### Inspect Worker Memory
Use Chrome DevTools:
1. Open DevTools
2. Go to Memory tab
3. Take heap snapshot
4. Filter by "Worker" to see worker-specific memory

### Monitor Message Traffic
```javascript
worker.onmessage = (event) => {
  console.log('Worker response:', event.data);
  // Process response
};

worker.postMessage(request);
console.log('Sent to worker:', request);
```

## Migration from Synchronous Code

If migrating from synchronous filtering:

**Before:**
```javascript
let filteredMessages = messages.filter(msg => {
  const data = parseMessageData(msg);
  return data?.requestId?.includes(filterText);
});
```

**After:**
```javascript
worker.postMessage({
  action: 'filter',
  data: { filterRequestId: filterText }
});

worker.onmessage = (event) => {
  if (event.data.action === 'filter') {
    // Update UI with count
    filteredCount = event.data.filteredCount;
    // Request first page
    worker.postMessage({
      action: 'getSlice',
      data: { start: 0, end: 50 }
    });
  }
};
```

## See Also

- [messageUtils.js](../src/messageUtils.js) - Shared utility functions
- [WebSocketTimeMachine.svelte](../src/WebSocketTimeMachine.svelte) - Main component
- [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
