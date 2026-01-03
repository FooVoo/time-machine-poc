# Application Architecture

## Overview

This document provides a comprehensive overview of the WebSocketTimeMachine application architecture, including component structure, state management, and data flow.

## Architecture Diagram

```mermaid
graph TB
    subgraph "Application Layer"
        WTM[WebSocketTimeMachine.svelte<br/>Smart Container - 266 lines]
    end
    
    subgraph "Presentation Layer"
        CP[ConnectionPanel.svelte<br/>128 lines]
        FP[FilterPanel.svelte<br/>147 lines]
        AP[ActionsPanel.svelte<br/>75 lines]
        MP[MessagesPanel.svelte<br/>162 lines]
    end
    
    subgraph "Message Display Components"
        MI[MessageItem.svelte<br/>130 lines]
        JV[JsonViewer.svelte<br/>21 lines]
        NDV[NestedDataViewer.svelte<br/>160 lines]
        PC[PaginationControls.svelte<br/>61 lines]
    end
    
    subgraph "State Management (Svelte Stores)"
        WS[websocket.js<br/>WebSocket State]
        MS[messages.js<br/>Messages State]
        FS[filters.js<br/>Filter State]
    end
    
    subgraph "Utility Layer"
        MU[message-utils.js<br/>Parsing & Formatting]
        FU[filter-utils.js<br/>Filtering Logic]
        I18N[i18n.js<br/>Internationalization]
    end
    
    WTM --> CP
    WTM --> FP
    WTM --> AP
    WTM --> MP
    
    MP --> MI
    MP --> PC
    MI --> JV
    JV --> NDV
    NDV --> NDV
    
    WTM -.uses.-> WS
    WTM -.uses.-> MS
    WTM -.uses.-> FS
    
    WTM -.uses.-> MU
    WTM -.uses.-> FU
    WTM -.uses.-> I18N
    
    CP -.uses.-> I18N
    FP -.uses.-> I18N
    AP -.uses.-> I18N
    MP -.uses.-> I18N
    MI -.uses.-> MU
    MI -.uses.-> I18N
    NDV -.uses.-> MU
    NDV -.uses.-> I18N
    PC -.uses.-> I18N
    
    style WTM fill:#4a90e2,color:#fff
    style WS fill:#50c878,color:#fff
    style MS fill:#50c878,color:#fff
    style FS fill:#50c878,color:#fff
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant WTM as WebSocketTimeMachine
    participant Stores as Svelte Stores
    participant WS as WebSocket
    participant Components as UI Components

    User->>WTM: Connect to WebSocket
    WTM->>Stores: connectWebSocket(url)
    Stores->>WS: new WebSocket(url)
    WS-->>Stores: Connection established
    Stores-->>WTM: Update $wsConnection
    WTM->>Components: Pass isConnected prop
    Components-->>User: Show connected status

    WS->>WTM: onmessage event
    WTM->>Stores: addMessage(message)
    Stores-->>WTM: Update $messages
    WTM->>Components: Pass messages prop
    Components-->>User: Display new message

    User->>Components: Filter by requestId
    Components->>WTM: Update filterRequestId
    WTM->>Stores: filterRequestId.set(value)
    Stores-->>WTM: Update $filterRequestId
    WTM->>WTM: Compute filteredMessages
    WTM->>Components: Pass filteredMessages
    Components-->>User: Show filtered results
```

## State Management Architecture

```mermaid
graph LR
    subgraph "Svelte Stores"
        WS[wsConnection<br/>url, ws, isConnected,<br/>statusMessage]
        AC[autoCapture<br/>boolean]
        MS[messages<br/>Array of messages]
        PG[pagination<br/>currentPage,<br/>messagesPerPage]
        FR[filterRequestId<br/>string]
        CF[customFilterField<br/>string]
        CV[customFilterValue<br/>string]
        GB[groupByRequestId<br/>boolean]
    end
    
    subgraph "Component State"
        WTM[WebSocketTimeMachine<br/>Uses stores via $store]
        UI[UI-only State<br/>expandedMessages,<br/>expandedPaths,<br/>primitiveFields,<br/>fieldValues]
    end
    
    WTM -.subscribes.-> WS
    WTM -.subscribes.-> AC
    WTM -.subscribes.-> MS
    WTM -.subscribes.-> PG
    WTM -.subscribes.-> FR
    WTM -.subscribes.-> CF
    WTM -.subscribes.-> CV
    WTM -.subscribes.-> GB
    
    WTM --> UI
    
    style WS fill:#50c878
    style AC fill:#50c878
    style MS fill:#50c878
    style PG fill:#50c878
    style FR fill:#50c878
    style CF fill:#50c878
    style CV fill:#50c878
    style GB fill:#50c878
    style WTM fill:#4a90e2,color:#fff
```

## Component Hierarchy

```
WebSocketTimeMachine (Smart Container - 266 lines)
├── ConnectionPanel (Presentational - 128 lines)
│   └── WebSocket connection UI
├── CapturePanel (Inline - 10 lines)
│   └── Auto-capture checkbox
├── FilterPanel (Presentational - 147 lines)
│   ├── Request ID filter
│   ├── Custom field filter
│   └── Group by checkbox
├── ActionsPanel (Presentational - 75 lines)
│   ├── Export button
│   ├── Import button
│   └── Clear button
└── MessagesPanel (Coordinator - 162 lines)
    ├── PaginationControls (Presentational - 61 lines)
    ├── MessagesList OR GroupedMessages
    └── MessageItem (Presentational - 130 lines)
        └── JsonViewer (Presentational - 21 lines)
            └── NestedDataViewer (Recursive - 160 lines)
```

## Store Actions Flow

```mermaid
graph TD
    subgraph "WebSocket Actions"
        CA[connectWebSocket url]
        DA[disconnectWebSocket]
    end
    
    subgraph "Message Actions"
        AM[addMessage message]
        CM[clearMessages]
        IM[importMessages array]
    end
    
    subgraph "Filter Actions"
        RF[resetFilters]
    end
    
    subgraph "Stores"
        WS[wsConnection]
        MS[messages]
        FS[filters]
    end
    
    CA --> WS
    DA --> WS
    AM --> MS
    CM --> MS
    IM --> MS
    RF --> FS
    
    WS -.notifies.-> C[Components]
    MS -.notifies.-> C
    FS -.notifies.-> C
    
    style CA fill:#e8f5e9
    style DA fill:#ffebee
    style AM fill:#e8f5e9
    style CM fill:#ffebee
    style IM fill:#e8f5e9
    style RF fill:#ffebee
```

## Key Design Patterns

### 1. Smart/Dumb Component Pattern

**Smart Component (Container):**
- `WebSocketTimeMachine.svelte`
- Manages application state via stores
- Contains business logic
- Coordinates between child components
- Handles side effects (WebSocket, file I/O)

**Dumb Components (Presentational):**
- `ConnectionPanel`, `FilterPanel`, `ActionsPanel`, etc.
- Pure UI components
- Receive data via props
- Emit events for user actions
- No business logic
- Highly reusable

### 2. Store Pattern

**Centralized State:**
- All application state in Svelte stores
- Single source of truth
- Reactive updates via `$store` syntax

**Store Actions:**
- Encapsulate state mutations
- Handle complex logic
- Provide clean API

### 3. Reactive Collections

**Using Svelte 5 `$state()`:**
```javascript
let expandedMessages = $state(new Set());
let expandedPaths = $state(new Map());
```

- Automatic reactivity
- No manual reassignment needed
- Works with built-in Map and Set

## Component Communication

### Props Down, Events Up

```mermaid
graph TB
    Parent[Smart Container]
    Child1[Presentational Component 1]
    Child2[Presentational Component 2]
    
    Parent -->|props| Child1
    Parent -->|props| Child2
    Child1 -->|events| Parent
    Child2 -->|events| Parent
    
    style Parent fill:#4a90e2,color:#fff
```

### Store-based Communication

```mermaid
graph LR
    C1[Component A]
    C2[Component B]
    Store[(Svelte Store)]
    
    C1 -.writes.-> Store
    Store -.reads.-> C2
    C2 -.writes.-> Store
    Store -.reads.-> C1
    
    style Store fill:#50c878,color:#fff
```

## File Structure

```
src/
├── WebSocketTimeMachine.svelte          # Smart container (266 lines)
├── main.js                               # Entry point
├── lib/
│   ├── components/
│   │   ├── connection/
│   │   │   └── ConnectionPanel.svelte    # 128 lines
│   │   ├── filters/
│   │   │   └── FilterPanel.svelte        # 147 lines
│   │   ├── actions/
│   │   │   └── ActionsPanel.svelte       # 75 lines
│   │   └── messages/
│   │       ├── MessagesPanel.svelte      # 162 lines
│   │       ├── MessageItem.svelte        # 130 lines
│   │       ├── JsonViewer.svelte         # 21 lines
│   │       ├── NestedDataViewer.svelte   # 160 lines
│   │       └── PaginationControls.svelte # 61 lines
│   ├── stores/
│   │   ├── websocket.js                  # WebSocket state
│   │   ├── messages.js                   # Messages state
│   │   └── filters.js                    # Filter state
│   └── utils/
│       ├── message-utils.js              # Message parsing
│       ├── filter-utils.js               # Filtering logic
│       └── i18n.js                       # Internationalization
└── __tests__/                            # Future: Test files
```

## Performance Considerations

### Optimization Strategies

1. **Pagination** - Display 50 messages per page
2. **Lazy Parsing** - Parse JSON only when needed
3. **Derived Stores** - Memoize computed values
4. **Granular Components** - Update only what changed
5. **Reactive Collections** - Automatic change detection

### Bundle Size

| Build | Size | Gzipped | Notes |
|-------|------|---------|-------|
| ESM | 126.24 KB | 34.27 KB | Modern bundler target |
| UMD | 76.67 KB | 26.35 KB | Universal module |

## Security Considerations

### XSS Prevention

- No `@html` usage (prevents XSS)
- User input sanitized before display
- JSON parsing with error handling

### WebSocket Security

- User provides WebSocket URL
- No automatic connection
- Connection status clearly displayed
- Disconnect functionality available

## Testing Strategy

### Unit Tests

**Utility Functions:**
- `parseMessageData()`
- `formatValue()`
- `filterByCustomField()`
- `getAllFieldPaths()`

**Store Actions:**
- `connectWebSocket()`
- `addMessage()`
- `clearMessages()`
- `resetFilters()`

### Component Tests

**Presentational Components:**
- Props render correctly
- Events emit properly
- UI interactions work

**Integration Tests:**
- Store updates propagate
- Component communication works
- Full workflows complete

## Future Enhancements

### Planned Improvements

1. **Testing** - Add comprehensive test suite
2. **TypeScript** - Add type safety
3. **Virtual Scrolling** - Handle 10,000+ messages
4. **Persistence** - Save to localStorage
5. **Export Formats** - CSV, XML support
6. **Themes** - Dark mode support
7. **Accessibility** - ARIA labels, keyboard navigation

### Architectural Evolution

```mermaid
graph LR
    V1[v1.0<br/>Monolithic<br/>1,243 lines]
    V2[v2.0<br/>Smart/Dumb<br/>266+884 lines]
    V3[v3.0<br/>+Stores<br/>Same+Stores]
    V4[v4.0<br/>Future<br/>+Tests+TS]
    
    V1 -->|Refactor| V2
    V2 -->|Add Stores| V3
    V3 -->|Enhance| V4
    
    style V1 fill:#ffcdd2
    style V2 fill:#c8e6c9
    style V3 fill:#b2dfdb
    style V4 fill:#b3e5fc
```

## Code Metrics

### Current State

| Metric | Value |
|--------|-------|
| Total Components | 9 |
| Smart Components | 1 |
| Presentational Components | 8 |
| Stores | 3 |
| Utilities | 3 |
| Total Lines (Components) | 1,150 |
| Main Component Lines | 266 |
| Average Component Size | 128 lines |
| ESLint Warnings | 4 (false positives) |

### Improvement from v1.0

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Main Component | 1,243 lines | 266 lines | -78.6% |
| ESLint Errors | 17 | 4 | -76.5% |
| Test Coverage | 0% | 0% | TBD |
| Maintainability | Low | High | ✅ |

## Conclusion

The application follows modern Svelte 5 patterns with:
- ✅ Smart/dumb component architecture
- ✅ Centralized state management with stores
- ✅ Reactive collections with `$state()`
- ✅ Clean separation of concerns
- ✅ Highly testable architecture
- ✅ Excellent maintainability

---

**Version**: 3.0  
**Last Updated**: 2026-01-03  
**Status**: ✅ Production Ready
