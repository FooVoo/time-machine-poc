# Refactoring Guide: WebSocketTimeMachine Component

This guide provides step-by-step instructions for refactoring the WebSocketTimeMachine component from a monolithic 1,243-line file into a well-structured, maintainable architecture.

## Quick Start: Begin Using Utilities

The first step has already been prepared! Three utility modules are ready to use:

### Available Utilities

1. **`src/lib/utils/message-utils.js`**
   - `parseMessageData(msg)` - Parse JSON message data
   - `formatValue(value)` - Format values for display
   - `getValueType(value)` - Get value type
   - `getValuePreview(value)` - Get preview for complex values

2. **`src/lib/utils/filter-utils.js`**
   - `getNestedValue(obj, path)` - Get nested property values
   - `extractFieldPaths(obj, prefix, primFields, valuesMap)` - Extract field paths

3. **`src/lib/utils/i18n.js`**
   - `i18n` object - All UI text strings
   - `pluralizeRussian(count, one, few, many)` - Russian pluralization
   - `getMessageWord(count)` - Get correct message plural form

### How to Start Using Them

Simply import at the top of `WebSocketTimeMachine.svelte`:

```javascript
<script>
  import { parseMessageData, formatValue, getValueType, getValuePreview } from './lib/utils/message-utils.js';
  import { getNestedValue, extractFieldPaths } from './lib/utils/filter-utils.js';
  import { i18n, getMessageWord } from './lib/utils/i18n.js';
  
  // Rest of your code...
  // You can now delete the duplicate function definitions
</script>
```

## Full Refactoring Roadmap

### Phase 1: Extract Utilities ✅ (COMPLETED)

**Status**: Ready to use  
**Risk**: 🟢 Low  
**Effort**: Already done  

**Files Created**:
- `src/lib/utils/message-utils.js`
- `src/lib/utils/filter-utils.js`
- `src/lib/utils/i18n.js`

**Next**: Update WebSocketTimeMachine.svelte to import these utilities

---

### Phase 2: Create Component Structure (Next Step)

**Goal**: Set up the directory structure for components

```bash
# Create component directories
mkdir -p src/lib/components/connection
mkdir -p src/lib/components/filters
mkdir -p src/lib/components/messages
mkdir -p src/lib/components/viewer
mkdir -p src/lib/components/actions
```

---

### Phase 3: Extract ConnectionPanel

**Complexity**: Easy (80 lines)  
**Risk**: 🟢 Low  

Create `src/lib/components/connection/ConnectionPanel.svelte`:

```svelte
<script>
  import { i18n } from '../../utils/i18n.js';
  
  let { 
    wsUrl = $bindable(''),
    isConnected = false,
    statusMessage = '',
    onConnect,
    onDisconnect 
  } = $props();
</script>

<div class="connection-panel">
  <div class="input-group">
    <label for="ws-url">{i18n.wsUrlLabel}</label>
    <input
      id="ws-url"
      type="text"
      bind:value={wsUrl}
      disabled={isConnected}
      placeholder={i18n.wsUrlPlaceholder}
    />
  </div>

  <div class="button-group">
    {#if isConnected}
      <button class="btn btn-danger" onclick={onDisconnect}>
        {i18n.disconnect}
      </button>
    {:else}
      <button class="btn btn-primary" onclick={onConnect}>
        {i18n.connect}
      </button>
    {/if}
  </div>

  <div class="status">
    <span class="status-indicator" class:connected={isConnected}></span>
    <span class="status-text">
      {statusMessage || (isConnected ? i18n.connected : i18n.disconnected)}
    </span>
  </div>
</div>

<style>
  /* Copy relevant styles from main component */
</style>
```

**Usage in main component**:
```svelte
<ConnectionPanel 
  bind:wsUrl 
  {isConnected} 
  {statusMessage}
  onConnect={connect}
  onDisconnect={disconnect}
/>
```

---

### Phase 4: Extract FilterPanel

**Complexity**: Medium (120 lines)  
**Risk**: 🟡 Medium  

Create `src/lib/components/filters/FilterPanel.svelte`:

```svelte
<script>
  import { i18n } from '../../utils/i18n.js';
  
  let {
    filterRequestId = $bindable(''),
    customFilterField = $bindable(''),
    customFilterValue = $bindable(''),
    groupByRequestId = $bindable(false),
    availableFields = [],
    fieldIsFilterable = false,
    availableValues = []
  } = $props();
</script>

<div class="filter-panel">
  <!-- Request ID filter section -->
  <div class="filter-section">
    <h3>{i18n.filterByRequestId}</h3>
    <div class="input-group">
      <label for="filter">{i18n.requestIdLabel}</label>
      <input
        id="filter"
        type="text"
        bind:value={filterRequestId}
        placeholder={i18n.requestIdPlaceholder}
      />
    </div>
  </div>

  <!-- Custom field filter section -->
  <div class="filter-section">
    <h3>{i18n.filterByCustomField}</h3>
    <div class="custom-filter-group">
      <div class="input-group">
        <label for="custom-field">{i18n.fieldLabel}</label>
        <input
          id="custom-field"
          type="text"
          bind:value={customFilterField}
          list="field-suggestions"
          placeholder={i18n.fieldPlaceholder}
          autocomplete="off"
        />
        <datalist id="field-suggestions">
          {#each availableFields as field (field)}
            <option value={field}></option>
          {/each}
        </datalist>
      </div>
      <div class="input-group">
        <label for="custom-value">{i18n.valueLabel}</label>
        <input
          id="custom-value"
          type="text"
          bind:value={customFilterValue}
          list={fieldIsFilterable ? 'value-suggestions' : null}
          placeholder={i18n.valuePlaceholder}
          disabled={!fieldIsFilterable}
          title={fieldIsFilterable ? i18n.selectValueFromList : i18n.selectPrimitiveField}
        />
        {#if fieldIsFilterable}
          <datalist id="value-suggestions">
            {#each availableValues as value (value)}
              <option value={value}></option>
            {/each}
          </datalist>
        {/if}
      </div>
    </div>
  </div>

  <!-- Group by checkbox -->
  <label class="checkbox-label">
    <input type="checkbox" bind:checked={groupByRequestId} />
    {i18n.groupByRequestId}
  </label>
</div>

<style>
  /* Copy relevant styles */
</style>
```

---

### Phase 5: Extract JsonViewer

**Complexity**: Medium (100 lines)  
**Risk**: 🟡 Medium  

Create `src/lib/components/viewer/JsonViewer.svelte`:

```svelte
<script>
  import { formatValue, getValueType, getValuePreview } from '../../utils/message-utils.js';
  import NestedDataViewer from './NestedDataViewer.svelte';
  
  let {
    data,
    messageIndex,
    expandedPaths = $bindable(new Set()),
    onTogglePath
  } = $props();
</script>

<div class="json-viewer">
  <NestedDataViewer
    {data}
    {messageIndex}
    {expandedPaths}
    {onTogglePath}
    path=""
  />
</div>

<style>
  /* Copy JSON viewer styles */
</style>
```

Convert the `{#snippet nestedDataViewer}` into a separate component:

Create `src/lib/components/viewer/NestedDataViewer.svelte`:

```svelte
<script>
  import { formatValue, getValueType, getValuePreview } from '../../utils/message-utils.js';
  
  let {
    data,
    messageIndex,
    expandedPaths,
    onTogglePath,
    path = ''
  } = $props();
  
  function isExpanded(itemPath) {
    return expandedPaths?.has(itemPath) || false;
  }
  
  function togglePath(itemPath) {
    onTogglePath?.(messageIndex, itemPath);
  }
</script>

<div class="nested-data">
  {#if Array.isArray(data)}
    {#each data as item, index (`${path}[${index}]`)}
      {@const itemPath = `${path}[${index}]`}
      {@const itemType = getValueType(item)}
      {@const isComplex = itemType === 'object' || itemType === 'array'}
      {@const expanded = isExpanded(itemPath)}
      
      <div class="nested-item">
        <div class="nested-key">
          {#if isComplex}
            <button 
              class="nested-toggle" 
              onclick={() => togglePath(itemPath)}
              title={expanded ? 'Свернуть' : 'Развернуть'}
            >
              {expanded ? '▼' : '▶'}
            </button>
          {:else}
            <span class="nested-no-toggle"></span>
          {/if}
          <span class="nested-index">[{index}]:</span>
          {#if !expanded && isComplex}
            <span class="nested-preview">{getValuePreview(item)}</span>
          {/if}
        </div>
        {#if expanded && isComplex}
          <div class="nested-children">
            <svelte:self
              data={item}
              {messageIndex}
              {expandedPaths}
              {onTogglePath}
              path={itemPath}
            />
          </div>
        {:else if !isComplex}
          <span class="nested-value nested-value-{itemType}">{formatValue(item)}</span>
        {/if}
      </div>
    {/each}
  {:else if typeof data === 'object' && data !== null}
    {#each Object.entries(data) as [key, value] (path ? `${path}.${key}` : key)}
      {@const itemPath = path ? `${path}.${key}` : key}
      {@const itemType = getValueType(value)}
      {@const isComplex = itemType === 'object' || itemType === 'array'}
      {@const expanded = isExpanded(itemPath)}
      
      <div class="nested-item">
        <div class="nested-key">
          {#if isComplex}
            <button 
              class="nested-toggle" 
              onclick={() => togglePath(itemPath)}
              title={expanded ? 'Свернуть' : 'Развернуть'}
            >
              {expanded ? '▼' : '▶'}
            </button>
          {:else}
            <span class="nested-no-toggle"></span>
          {/if}
          <span class="nested-property">{key}:</span>
          {#if !expanded && isComplex}
            <span class="nested-preview">{getValuePreview(value)}</span>
          {/if}
        </div>
        {#if expanded && isComplex}
          <div class="nested-children">
            <svelte:self
              data={value}
              {messageIndex}
              {expandedPaths}
              {onTogglePath}
              path={itemPath}
            />
          </div>
        {:else if !isComplex}
          <span class="nested-value nested-value-{itemType}">{formatValue(value)}</span>
        {/if}
      </div>
    {/each}
  {:else}
    <span class="nested-value nested-value-{getValueType(data)}">{formatValue(data)}</span>
  {/if}
</div>

<style>
  /* Copy nested viewer styles */
</style>
```

---

### Phase 6: Extract MessageItem

**Complexity**: Easy (60 lines)  
**Risk**: 🟢 Low  

Create `src/lib/components/messages/MessageItem.svelte`:

```svelte
<script>
  import { parseMessageData, formatValue } from '../../utils/message-utils.js';
  import { i18n } from '../../utils/i18n.js';
  import JsonViewer from '../viewer/JsonViewer.svelte';
  
  let {
    message,
    index,
    isExpanded = false,
    expandedPaths,
    onToggleExpand,
    onTogglePath,
    showIndex = true
  } = $props();
  
  let parsedData = $derived(parseMessageData(message));
</script>

<div 
  class="message-item" 
  class:sent={message.type === 'sent'} 
  class:received={message.type === 'received'}
>
  <div class="message-header">
    {#if showIndex}
      <span class="message-index">#{index + 1}</span>
    {/if}
    <span class="message-type">{message.type}</span>
    <span class="message-time">
      {new Date(message.timestamp).toLocaleTimeString()}
    </span>
    <button
      class="expand-btn"
      onclick={() => onToggleExpand(index)}
      title={isExpanded ? i18n.collapseJson : i18n.expandJson}
    >
      {isExpanded ? '▼' : '▶'}
    </button>
  </div>

  {#if isExpanded && parsedData}
    <JsonViewer 
      data={parsedData}
      messageIndex={index}
      {expandedPaths}
      {onTogglePath}
    />
  {:else if isExpanded && !parsedData}
    <div class="message-data primitive">
      <span class="primitive-label">{i18n.primitiveValue}</span>
      <span class="primitive-value">{formatValue(message.data)}</span>
    </div>
  {:else}
    <div class="message-data">
      {#if parsedData}
        {JSON.stringify(parsedData)}
      {:else}
        {formatValue(message.data)}
      {/if}
    </div>
  {/if}
</div>

<style>
  /* Copy message item styles */
</style>
```

---

### Phase 7: Extract PaginationControls

**Complexity**: Easy (40 lines)  
**Risk**: 🟢 Low  

Create `src/lib/components/messages/PaginationControls.svelte`:

```svelte
<script>
  import { i18n } from '../../utils/i18n.js';
  
  let {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    onPrev,
    onNext,
    onLast
  } = $props();
</script>

<div class="pagination-controls">
  <button class="btn btn-sm" onclick={onPrev} disabled={currentPage === 0}>
    {i18n.previous}
  </button>
  <span class="page-info">
    {i18n.pageOf(currentPage + 1, totalPages)}
    {i18n.showing(startIndex + 1, endIndex, totalItems)}
  </span>
  <button class="btn btn-sm" onclick={onNext} disabled={currentPage === totalPages - 1}>
    {i18n.next}
  </button>
  <button class="btn btn-sm" onclick={onLast}>
    {i18n.last}
  </button>
</div>

<style>
  /* Copy pagination styles */
</style>
```

---

### Phase 8: Reassemble Main Component

After extracting components, the main file becomes much simpler:

```svelte
<svelte:options customElement="websocket-time-machine" />

<script>
  import ConnectionPanel from './lib/components/connection/ConnectionPanel.svelte';
  import FilterPanel from './lib/components/filters/FilterPanel.svelte';
  import MessagesPanel from './lib/components/messages/MessagesPanel.svelte';
  import ActionsPanel from './lib/components/actions/ActionsPanel.svelte';
  import { i18n, getMessageWord } from './lib/utils/i18n.js';
  import { parseMessageData } from './lib/utils/message-utils.js';
  
  // State
  let wsUrl = $state('');
  let ws = null;
  let isConnected = $state(false);
  let messages = $state([]);
  let autoCapture = $state(false);
  let statusMessage = $state('');
  
  // Filtering
  let filterRequestId = $state('');
  let groupByRequestId = $state(false);
  let customFilterField = $state('');
  let customFilterValue = $state('');
  
  // Pagination
  let currentPage = $state(0);
  let messagesPerPage = $state(50);
  
  // ... business logic functions (connect, disconnect, etc.)
  
  // Derived state
  let filteredMessages = $derived(/* filtering logic */);
  let totalPages = $derived(Math.ceil(filteredMessages.length / messagesPerPage));
</script>

<div class="container">
  <div class="header">
    <h1>{i18n.title}</h1>
    <p class="subtitle">{i18n.subtitle}</p>
  </div>

  <ConnectionPanel 
    bind:wsUrl 
    {isConnected} 
    {statusMessage}
    onConnect={connect}
    onDisconnect={disconnect}
  />

  <div class="capture-panel">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={autoCapture} />
      {i18n.autoCapture}
    </label>
  </div>

  <FilterPanel
    bind:filterRequestId
    bind:customFilterField
    bind:customFilterValue
    bind:groupByRequestId
    {availableFields}
    {fieldIsFilterable}
    {availableValues}
  />

  <ActionsPanel
    {messages}
    onExport={exportMessages}
    onImport={handleImport}
    onClear={clearMessages}
  />

  <MessagesPanel
    {messages}
    {filteredMessages}
    {groupByRequestId}
    {currentPage}
    {messagesPerPage}
    {totalPages}
  />
</div>

<style>
  /* Only container and header styles */
</style>
```

**Result**: Main component reduced from 1,243 lines to ~150 lines!

---

## Testing Strategy

### Unit Tests for Utilities

Create `src/lib/utils/__tests__/message-utils.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { parseMessageData, formatValue, getValueType } from '../message-utils.js';

describe('parseMessageData', () => {
  it('should parse JSON string', () => {
    const msg = { data: '{"key": "value"}' };
    expect(parseMessageData(msg)).toEqual({ key: 'value' });
  });

  it('should return object as-is', () => {
    const msg = { data: { key: 'value' } };
    expect(parseMessageData(msg)).toEqual({ key: 'value' });
  });

  it('should return null for invalid JSON', () => {
    const msg = { data: 'invalid json' };
    expect(parseMessageData(msg)).toBeNull();
  });
});

describe('formatValue', () => {
  it('should format null', () => {
    expect(formatValue(null)).toBe('null');
  });

  it('should format undefined', () => {
    expect(formatValue(undefined)).toBe('undefined');
  });

  it('should format string', () => {
    expect(formatValue('hello')).toBe('hello');
  });

  it('should format number', () => {
    expect(formatValue(42)).toBe('42');
  });

  it('should format boolean', () => {
    expect(formatValue(true)).toBe('true');
  });

  it('should stringify objects', () => {
    expect(formatValue({ a: 1 })).toContain('"a"');
  });
});
```

---

## Migration Checklist

### Preparation
- [ ] Review SVELTE_ANALYSIS.md
- [ ] Understand current architecture
- [ ] Set up testing framework (Vitest)
- [ ] Create backup branch

### Phase 1: Utilities ✅
- [x] Create utility files
- [x] Export functions
- [ ] Import in main component
- [ ] Remove duplicate functions
- [ ] Test utilities
- [ ] Verify build works

### Phase 2: Component Structure
- [ ] Create component directories
- [ ] Plan component interfaces
- [ ] Document props and events

### Phase 3-7: Extract Components
For each component:
- [ ] Create component file
- [ ] Copy relevant code
- [ ] Define props/events
- [ ] Copy styles
- [ ] Import in main component
- [ ] Test component
- [ ] Remove from main file

### Phase 8: Final Integration
- [ ] Verify all components work together
- [ ] Run full test suite
- [ ] Check performance
- [ ] Update documentation
- [ ] Code review
- [ ] Merge to main

---

## Best Practices

### Component Communication
- Use props for data down
- Use events for actions up
- Use stores for shared state
- Minimize prop drilling

### Styling
- Keep styles scoped to components
- Extract common styles to shared file
- Use CSS variables for theming

### Testing
- Test utilities first (easiest)
- Test components in isolation
- Test integration last
- Aim for 80%+ coverage

### Git Strategy
- One component per commit
- Test before committing
- Write descriptive commit messages
- Keep main branch stable

---

## Rollback Plan

If issues arise during refactoring:

1. **Utilities phase**: Simply remove imports and keep old functions
2. **Component phase**: Comment out new component, uncomment old code
3. **Full rollback**: `git revert` to previous commit

---

## Success Metrics

- ✅ Main component < 200 lines
- ✅ Each component < 150 lines
- ✅ Test coverage > 80%
- ✅ Build time unchanged
- ✅ No functionality lost
- ✅ ESLint errors = 0

---

## Questions?

See SVELTE_ANALYSIS.md for detailed architecture diagrams and pitfall analysis.

**Ready to start?** Begin by importing the utility files in your main component!
