# Web Component Integration Guide

This document explains how to use WebSocket Time Machine as a web component in various frameworks including Angular, React, Vue, and vanilla JavaScript.

## Overview

WebSocket Time Machine is packaged as a standards-compliant Web Component (Custom Element) that can be used in any modern web application, regardless of framework.

**Custom Element Name:** `<websocket-time-machine>`

**Package Exports:**
- ES Module: `dist/websocket-time-machine.es.js` (108KB)
- UMD Module: `dist/websocket-time-machine.umd.js` (65KB)

## Installation

### npm/yarn
```bash
npm install websocket-time-machine
# or
yarn add websocket-time-machine
```

### CDN
```html
<script type="module" src="https://unpkg.com/websocket-time-machine@latest/dist/websocket-time-machine.es.js"></script>
```

## Framework Integration

### Angular

#### 1. Enable Custom Elements Schema

In your module:

```typescript
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA], // Add this
  bootstrap: [AppComponent]
})
export class AppModule { }
```

#### 2. Import the Component

In your component or main.ts:

```typescript
import 'websocket-time-machine';
```

#### 3. Use in Template

```html
<websocket-time-machine></websocket-time-machine>
```

#### 4. Full Example with Service Integration

See [angular-integration/ws-time-machine-controls.component.ts](../angular-integration/ws-time-machine-controls.component.ts) for a complete example that integrates with Angular services.

**Example Component:**

```typescript
import { Component, OnInit } from '@angular/core';
import 'websocket-time-machine';

@Component({
  selector: 'app-websocket-viewer',
  template: `
    <div class="container">
      <h2>WebSocket Message Viewer</h2>
      <websocket-time-machine></websocket-time-machine>
    </div>
  `,
  styles: [`
    .container {
      padding: 20px;
    }
  `]
})
export class WebsocketViewerComponent implements OnInit {
  ngOnInit() {
    // Component is now available in the DOM
    console.log('WebSocket Time Machine loaded');
  }
}
```

### React

#### 1. Import and Use

```jsx
import { useEffect, useRef } from 'react';
import 'websocket-time-machine';

function WebSocketViewer() {
  const elementRef = useRef(null);

  useEffect(() => {
    // Component is now available
    if (elementRef.current) {
      console.log('WebSocket Time Machine loaded');
    }
  }, []);

  return (
    <div className="container">
      <h2>WebSocket Message Viewer</h2>
      <websocket-time-machine ref={elementRef}></websocket-time-machine>
    </div>
  );
}

export default WebSocketViewer;
```

#### 2. TypeScript Support

Create a type declaration file (`websocket-time-machine.d.ts`):

```typescript
declare namespace JSX {
  interface IntrinsicElements {
    'websocket-time-machine': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
  }
}
```

### Vue 3

#### 1. Import in Component

```vue
<template>
  <div class="container">
    <h2>WebSocket Message Viewer</h2>
    <websocket-time-machine></websocket-time-machine>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import 'websocket-time-machine';

onMounted(() => {
  console.log('WebSocket Time Machine loaded');
});
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
```

#### 2. Configure Vue to Ignore Custom Element

In `vite.config.js` or `vue.config.js`:

```javascript
export default {
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag === 'websocket-time-machine'
      }
    }
  }
}
```

### Vanilla JavaScript

#### 1. Import via Script Tag

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WebSocket Time Machine</title>
  <script type="module">
    import 'https://unpkg.com/websocket-time-machine@latest/dist/websocket-time-machine.es.js';
    
    // Component is now available
    document.addEventListener('DOMContentLoaded', () => {
      console.log('WebSocket Time Machine loaded');
    });
  </script>
</head>
<body>
  <h1>WebSocket Message Viewer</h1>
  <websocket-time-machine></websocket-time-machine>
</body>
</html>
```

#### 2. Using npm Bundle

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WebSocket Time Machine</title>
  <script type="module" src="./node_modules/websocket-time-machine/dist/websocket-time-machine.es.js"></script>
</head>
<body>
  <h1>WebSocket Message Viewer</h1>
  <websocket-time-machine></websocket-time-machine>
</body>
</html>
```

## Features

### Built-in Functionality

The web component includes:

- **WebSocket Connection Management**
  - Connect to WebSocket URL
  - Auto-capture incoming messages
  - Real-time message display

- **Message Filtering**
  - Filter by request ID (partial match)
  - Filter by custom fields (dot notation)
  - Group by request ID

- **Message Management**
  - Import message history from JSON
  - Export messages to JSON
  - Clear message history
  - Pagination (50 messages per page)

- **Performance Optimized**
  - Web Worker architecture
  - Handles 12,000+ messages efficiently
  - Only 50 messages in main thread at a time
  - 99.6% memory reduction vs traditional approach

### UI Elements

The component provides a complete UI with:
- WebSocket connection controls (URL input, connect/disconnect buttons)
- Auto-capture toggle
- Message filters (request ID, custom fields)
- Pagination controls
- Import/Export buttons
- Message expansion for detailed view
- Status messages in Russian

## Customization

### Styling

The web component uses Shadow DOM, which provides style encapsulation. To customize styles, you can:

1. **CSS Variables** (if exposed by component)
2. **Global Styles** (for the outer container)
3. **::part Pseudo-elements** (if parts are exposed)

Example:

```css
/* Style the custom element container */
websocket-time-machine {
  display: block;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
```

### Programmatic Access

You can access the web component via JavaScript:

```javascript
const element = document.querySelector('websocket-time-machine');

// The component manages its own state internally
// Access via DOM APIs if custom methods/properties are exposed
```

## Architecture

### Component Structure

```
websocket-time-machine (Custom Element)
│
├─ Shadow DOM (encapsulated styles and markup)
│  ├─ Connection controls
│  ├─ Filter controls
│  ├─ Message list (paginated)
│  └─ Export/Import controls
│
└─ Web Workers (background threads)
   ├─ jsonParser.worker.js (0.21KB)
   │  └─ Parses JSON files without blocking UI
   │
   └─ messageStorage.worker.js (2.71KB)
       ├─ Stores all 12,000 messages
       ├─ Filters messages
       ├─ Returns paginated slices
       └─ Groups by request ID
```

### Memory Architecture

```
Main Thread (UI)                    Web Worker (Background)
─────────────────                   ───────────────────────
│ Custom Element  │                 │ Message Storage     │
│ (~100KB memory) │  ←requests→    │ (12MB isolated)     │
│                 │  ←50 messages←  │                     │
│ Visible: 50 msgs│                 │ Stored: 12K msgs    │
└─────────────────┘                 └─────────────────────┘
```

**Benefits:**
- Main thread: ~100KB (only visible slice)
- Worker thread: 12MB (all messages, isolated)
- **99.6% memory reduction** in UI thread
- No UI blocking during import/filter operations

## Performance Characteristics

### Benchmarks

- **Import 12MB JSON file:** ~40-90ms (non-blocking)
- **Filter 12K messages:** ~50% faster than v1 (single-pass algorithm)
- **Page navigation:** Instant (requests 50 messages from worker)
- **Real-time capture:** Batched every 10 messages or 100ms
- **Build size:** 108KB ES module, 65KB UMD

### Optimization Techniques

1. **Web Worker Architecture:** Isolates 12MB dataset from main thread
2. **Slice-Based Pagination:** Transfers only 50 messages at a time
3. **Single-Pass Filtering:** Optimized algorithms with no intermediate arrays
4. **Batch Message Capture:** Buffers real-time messages before worker sync
5. **Lazy Expansion:** Message details loaded on-demand

## Browser Support

**Minimum Requirements:**
- Web Components (Custom Elements v1)
- ES Modules
- Web Workers
- Shadow DOM

**Supported Browsers:**
- Chrome/Edge 67+
- Firefox 63+
- Safari 12.1+
- Opera 54+

**Polyfills:**

For older browsers, include:

```html
<script src="https://unpkg.com/@webcomponents/webcomponentsjs@latest/webcomponents-loader.js"></script>
```

## Troubleshooting

### Component Not Rendering

**Issue:** Custom element doesn't appear

**Solution:**
1. Ensure the script is loaded before using the element
2. Check browser console for errors
3. Verify the element name is correct: `<websocket-time-machine>` (all lowercase, hyphen-separated)

### TypeScript Errors

**Issue:** TypeScript doesn't recognize custom element

**Solution:** Add type declaration (see React section above)

### Framework-Specific Issues

**Angular:** Add `CUSTOM_ELEMENTS_SCHEMA` to module
**Vue:** Configure `isCustomElement` in compiler options
**React:** Use `ref` for component instance access

### Performance Issues

**Issue:** Slow with large message sets

**Solution:**
1. The component handles 12,000+ messages efficiently
2. Check browser DevTools Performance tab
3. Ensure Web Workers are not blocked
4. Verify only one component instance exists

### Import/Export Not Working

**Issue:** File import/export fails

**Solution:**
1. Check file format (must be JSON array)
2. Verify browser allows file downloads
3. Check console for worker errors
4. Ensure file size is reasonable (<50MB)

## Best Practices

### 1. Single Instance

Use only one instance per page for optimal performance:

```html
<!-- Good -->
<websocket-time-machine></websocket-time-machine>

<!-- Avoid -->
<websocket-time-machine></websocket-time-machine>
<websocket-time-machine></websocket-time-machine>
```

### 2. Lazy Loading

Load the component only when needed:

```javascript
// Lazy load on route change (React Router example)
const WebSocketViewer = lazy(() => 
  import('./components/WebSocketViewer')
);
```

### 3. Memory Management

The component manages its own memory efficiently, but:
- Clear messages when not needed
- Export data before clearing if needed
- Don't keep multiple instances in memory

### 4. Error Handling

Monitor the component's status messages:

```javascript
const element = document.querySelector('websocket-time-machine');
// Status is displayed in the component UI
```

## API Reference

While the component is primarily UI-driven, you can interact with it programmatically if needed.

### Element Reference

```javascript
const element = document.querySelector('websocket-time-machine');
```

### Internal State

The component manages its state internally using Svelte 5's reactivity system. State includes:
- WebSocket connection status
- Message count (total and filtered)
- Current page
- Filter values
- Expanded message states

All state is encapsulated within the component's Shadow DOM.

## Examples

### Complete Angular Integration

See the [angular-integration](../angular-integration) directory for:
- `ws-replay.service.ts` - Service for message replay
- `ws-service-integration-example.ts` - WebSocket service integration
- `ws-time-machine-controls.component.ts` - Control component example

### Standalone HTML Demo

See [demo.html](../demo.html) in the repository root for a complete standalone example.

### Integration with Existing WebSocket

```javascript
// Your existing WebSocket code
const ws = new WebSocket('wss://example.com/socket');

ws.onmessage = (event) => {
  // Your message handling
  handleMessage(event.data);
  
  // Also forward to Time Machine for capture
  // (if you've implemented programmatic message injection)
};
```

## Migration from Older Versions

If upgrading from a previous version:

1. **v1.0 → v2.0:**
   - Component now uses Web Workers
   - Memory usage reduced by 99.6%
   - Filtering is 50% faster
   - No API changes required

2. **Breaking Changes:**
   - None (backward compatible)

## Further Documentation

- [Web Workers API](./WORKERS.md) - Detailed worker architecture
- [Angular Integration](../angular-integration/README.md) - Angular-specific guide
- [Main README](../README.md) - Project overview
- [Performance Metrics](../PERFORMANCE.md) - Benchmarks and optimization details

## Support

For issues, questions, or contributions:
- GitHub Issues: [FooVoo/time-machine-poc](https://github.com/FooVoo/time-machine-poc)
- Documentation: See `docs/` directory
- Examples: See `angular-integration/` directory

## License

See [LICENSE](../LICENSE) file for details.
