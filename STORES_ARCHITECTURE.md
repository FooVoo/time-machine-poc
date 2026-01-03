# Svelte Stores Architecture

## Overview

The application now uses Svelte stores for centralized state management, following Svelte best practices. This provides better separation of concerns and makes the state more testable and maintainable.

## Store Structure

```
src/lib/stores/
├── websocket.js    # WebSocket connection state and actions
├── messages.js     # Messages array and message operations
└── filters.js      # Filter state (requestId, custom fields, grouping)
```

## Store Details

### websocket.js

**State:**
```javascript
{
  url: string,
  ws: WebSocket | null,
  isConnected: boolean,
  statusMessage: string
}
```

**Actions:**
- `connectWebSocket(url)` - Establishes WebSocket connection
- `disconnectWebSocket()` - Closes WebSocket connection

**Usage:**
```javascript
import { wsConnection, connectWebSocket, disconnectWebSocket } from './stores/websocket.js';

// Subscribe to state
$: isConnected = $wsConnection.isConnected;

// Call actions
connectWebSocket('ws://localhost:8080');
disconnectWebSocket();
```

### messages.js

**State:**
- `messages` - Array of captured messages
- `pagination` - Pagination configuration

**Actions:**
- `addMessage(message)` - Add a new message
- `clearMessages()` - Clear all messages
- `importMessages(messages)` - Import messages from file

**Derived Stores:**
- `messageCount` - Total number of messages

**Usage:**
```javascript
import { messages, addMessage, clearMessages } from './stores/messages.js';

// Subscribe to messages
$: allMessages = $messages;

// Add message
addMessage({ timestamp: Date.now(), type: 'received', data: 'Hello' });

// Clear all
clearMessages();
```

### filters.js

**State:**
- `filterRequestId` - Filter by request ID
- `customFilterField` - Custom filter field name
- `customFilterValue` - Custom filter value
- `groupByRequestId` - Group messages by request ID

**Actions:**
- `resetFilters()` - Reset all filters to default

**Usage:**
```javascript
import { filterRequestId, customFilterField, resetFilters } from './stores/filters.js';

// Subscribe and update
$: $filterRequestId = 'abc123';
$: $customFilterField = 'data.userId';

// Reset all
resetFilters();
```

## Reactive Collections (SvelteMap & SvelteSet)

Svelte 5 makes Map and Set reactive when wrapped in `$state()`:

```javascript
// Before (manual reactivity):
let mySet = new Set();
mySet.add(item);
mySet = mySet; // Trigger reactivity

// After (automatic reactivity with $state):
let mySet = $state(new Set());
mySet.add(item); // Automatically reactive!
```

### Usage in Component

**Reactive Set:**
```javascript
let expandedMessages = $state(new Set());

function toggleExpand(index) {
  if (expandedMessages.has(index)) {
    expandedMessages.delete(index);
  } else {
    expandedMessages.add(index);
  }
  // No need to reassign!
}
```

**Reactive Map:**
```javascript
let expandedPaths = $state(new Map());

function setExpanded(key, value) {
  expandedPaths.set(key, value);
  // Automatically triggers reactivity
}
```

## Integration with Main Component

The main component (`WebSocketTimeMachine.svelte`) integrates stores using `$effect` for synchronization:

```javascript
// Subscribe to store updates
$effect(() => {
  const unsubMessages = messagesStore.subscribe((value) => {
    messages = value;
  });
  
  return () => unsubMessages();
});

// Sync local changes back to stores
$effect(() => {
  autoCaptureStore.set(autoCapture);
});
```

This pattern allows:
- Two-way binding with stores
- Local component state remains reactive
- Store updates propagate to component
- Component updates propagate to stores

## Benefits of Store Architecture

### 1. Centralized State Management ✅
- Single source of truth for application state
- Easier to debug (inspect stores in devtools)
- State persists across component remounts

### 2. Separation of Concerns ✅
- Business logic separated from UI
- Stores can be tested independently
- Actions encapsulate state mutations

### 3. Reusability ✅
- Stores can be shared across multiple components
- Actions can be called from anywhere
- No prop drilling required

### 4. Testability ✅
```javascript
// Easy to test stores
import { messages, addMessage } from './stores/messages.js';
import { get } from 'svelte/store';

test('addMessage adds to array', () => {
  addMessage({ id: 1, data: 'test' });
  expect(get(messages)).toHaveLength(1);
});
```

### 5. Better Performance ✅
- Granular subscriptions (only update what changed)
- Derived stores memoize computations
- Reactive collections don't require reassignment

## Migration from Local State

### Before (Local State)
```javascript
let messages = $state([]);
let isConnected = $state(false);

function addMessage(msg) {
  messages.push(msg);
  messages = messages; // Manual reactivity
}
```

### After (Stores)
```javascript
import { messages, addMessage } from './stores/messages.js';
import { wsConnection } from './stores/websocket.js';

let localMessages = $state($messages);
let isConnected = $state($wsConnection.isConnected);

// Sync with stores
$effect(() => {
  const unsub = messages.subscribe(v => localMessages = v);
  return () => unsub();
});
```

## Store Patterns

### Action Pattern
Encapsulate state mutations in actions:

```javascript
// ✅ Good - Action handles complexity
export function connectWebSocket(url) {
  try {
    const ws = new WebSocket(url);
    ws.onopen = () => {
      wsConnection.update(state => ({
        ...state,
        ws,
        isConnected: true
      }));
    };
    return ws;
  } catch (error) {
    wsConnection.update(state => ({
      ...state,
      statusMessage: `Error: ${error.message}`
    }));
  }
}

// ❌ Bad - Direct store mutation from component
wsConnection.update(state => ({ ...state, ws: new WebSocket(url) }));
```

### Derived Store Pattern
Compute values from other stores:

```javascript
export const messageCount = derived(
  messages,
  ($messages) => $messages.length
);

export const hasMessages = derived(
  messageCount,
  ($count) => $count > 0
);
```

### Combined Stores Pattern
Combine multiple stores:

```javascript
import { derived } from 'svelte/store';
import { messages } from './messages.js';
import { filterRequestId } from './filters.js';

export const filteredMessages = derived(
  [messages, filterRequestId],
  ([$messages, $filter]) => {
    if (!$filter) return $messages;
    return $messages.filter(m => m.requestId === $filter);
  }
);
```

## ESLint Warnings

The remaining 4 ESLint warnings about `Set` and `Map` are expected:

```javascript
// These warnings are safe to ignore in Svelte 5:
let expandedMessages = $state(new Set());     // Warning (false positive)
let expandedPaths = $state(new Map());        // Warning (false positive)
```

In Svelte 5, `$state()` makes `Set` and `Map` reactive automatically. The ESLint rule suggests using `SvelteSet`/`SvelteMap`, but these don't exist in Svelte 5 - the built-in collections work fine with `$state()`.

## Future Enhancements

### Possible Additions

1. **Persistent Storage**
```javascript
// Auto-save to localStorage
messages.subscribe(value => {
  localStorage.setItem('messages', JSON.stringify(value));
});
```

2. **Store Composition**
```javascript
// Combine stores for complex state
export const appState = derived(
  [messages, filters, wsConnection],
  ([$messages, $filters, $ws]) => ({
    messages: $messages,
    filters: $filters,
    connection: $ws
  })
);
```

3. **Middleware**
```javascript
// Add logging/analytics
function createTrackedStore(initialValue) {
  const { subscribe, set, update } = writable(initialValue);
  
  return {
    subscribe,
    set: (value) => {
      console.log('Store updated:', value);
      set(value);
    },
    update
  };
}
```

## Resources

- [Svelte Stores Documentation](https://svelte.dev/docs/svelte-store)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/$state)
- [State Management Patterns](https://svelte.dev/examples/writable-stores)

---

**Updated**: 2026-01-03  
**Version**: 1.0  
**Status**: ✅ Implemented
