<svelte:options customElement="websocket-time-machine" />

<script>
  // Smart Component - Uses stores directly for state management
  import ConnectionPanel from './lib/components/connection/ConnectionPanel.svelte';
  import FilterPanel from './lib/components/filters/FilterPanel.svelte';
  import ActionsPanel from './lib/components/actions/ActionsPanel.svelte';
  import MessagesPanel from './lib/components/messages/MessagesPanel.svelte';
  import { i18n, getMessageWord } from './lib/utils/i18n.js';
  import { parseMessageData } from './lib/utils/message-utils.js';
  import { getNestedValue, extractFieldPaths } from './lib/utils/filter-utils.js';
  import {
    wsConnection,
    autoCapture,
    connectWebSocket,
    disconnectWebSocket,
  } from './lib/stores/websocket.js';
  import {
    messages,
    pagination,
    addMessage,
    clearMessages as clearMessagesAction,
    importMessages as importMessagesAction,
  } from './lib/stores/messages.js';
  import {
    filterRequestId,
    customFilterField,
    customFilterValue,
    groupByRequestId,
  } from './lib/stores/filters.js';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  // Local UI-only state
  let wsUrl = $state('');
  let ws = null;

  // UI state using reactive Map and Set in Svelte 5
  let primitiveFields = new SvelteSet();
  let fieldValues = new SvelteMap();
  let expandedMessages = $state(new Set());
  let expandedNestedPaths = $state(new Map());

  // Derived state - field extraction
  let availableFields = $derived.by(() => getAllFieldPaths($messages));
  let fieldIsFilterable = $derived(primitiveFields.has($customFilterField));
  let availableValues = $derived.by(() => {
    if (!fieldIsFilterable) {
      return [];
    }
    if (!fieldValues.has($customFilterField)) {
      return [];
    }
    return Array.from(fieldValues.get($customFilterField)).sort();
  });

  // Derived state - filtering
  let filteredByRequestId = $derived.by(() => {
    if (!$filterRequestId) {
      return $messages;
    }
    return $messages.filter((msg) => {
      const data = parseMessageData(msg);
      return data && data.requestId && data.requestId.includes($filterRequestId);
    });
  });

  let filteredMessages = $derived(filterByCustomField(filteredByRequestId));

  let groupedMessages = $derived.by(() => {
    if (!$groupByRequestId) {
      return null;
    }
    return groupMessagesByRequestId(filteredMessages);
  });

  // Derived state - pagination
  let totalPages = $derived(Math.ceil(filteredMessages.length / $pagination.messagesPerPage));
  let visibleMessages = $derived(
    filteredMessages.slice(
      $pagination.currentPage * $pagination.messagesPerPage,
      ($pagination.currentPage + 1) * $pagination.messagesPerPage
    )
  );
  let startIndex = $derived($pagination.currentPage * $pagination.messagesPerPage);

  // Get all available field paths from messages
  function getAllFieldPaths(msgs) {
    const fieldsSet = new SvelteSet();
    const primFields = new SvelteSet();
    const valuesMap = new SvelteMap();

    for (const msg of msgs) {
      fieldsSet.add('type');
      fieldsSet.add('timestamp');
      primFields.add('type');
      primFields.add('timestamp');

      if (!valuesMap.has('type')) {
        valuesMap.set('type', new Set());
      }
      if (!valuesMap.has('timestamp')) {
        valuesMap.set('timestamp', new Set());
      }
      valuesMap.get('type').add(String(msg.type));
      valuesMap.get('timestamp').add(String(msg.timestamp));

      const data = parseMessageData(msg);
      if (data) {
        const dataPaths = extractFieldPaths(data, 'data', primFields, valuesMap);
        dataPaths.forEach((path) => fieldsSet.add(path));
      }
    }

    primitiveFields = primFields;
    fieldValues = valuesMap;

    return Array.from(fieldsSet).sort();
  }

  // Filter messages by custom field
  function filterByCustomField(msgs) {
    if (!$customFilterField || !$customFilterValue) {
      return msgs;
    }

    return msgs.filter((msg) => {
      let value;

      if ($customFilterField.startsWith('data.')) {
        const data = parseMessageData(msg);
        if (!data) {
          return false;
        }
        const fieldPath = $customFilterField.substring(5);
        value = getNestedValue(data, fieldPath);
      } else {
        value = msg[$customFilterField];
      }

      if (value === undefined || value === null) {
        return false;
      }

      const valueStr = String(value).toLowerCase();
      const filterStr = $customFilterValue.toLowerCase();

      return valueStr.includes(filterStr);
    });
  }

  // Group messages by requestId - returns a regular Map (reactive through $derived)
  function groupMessagesByRequestId(msgs) {
    const groups = new SvelteMap();

    for (const msg of msgs) {
      const data = parseMessageData(msg);
      const requestId = data?.requestId;

      if (requestId) {
        if (!groups.has(requestId)) {
          groups.set(requestId, []);
        }
        groups.get(requestId).push(msg);
      }
    }

    return groups;
  }

  // WebSocket handlers
  function connect() {
    ws = connectWebSocket(wsUrl);

    if (ws) {
      ws.onmessage = (event) => {
        if ($autoCapture) {
          const message = {
            timestamp: new Date().toISOString(),
            type: 'received',
            data: event.data,
          };
          const wasOnLastPage =
            $pagination.currentPage === totalPages - 1 || $messages.length === 0;
          addMessage(message);

          if (wasOnLastPage) {
            pagination.update((p) => ({
              ...p,
              currentPage: Math.max(0, Math.ceil($messages.length / p.messagesPerPage) - 1),
            }));
          }
        }
      };
    }
  }

  function disconnect() {
    disconnectWebSocket();
  }

  // Message operations
  function clearMessages() {
    clearMessagesAction();
    filterRequestId.set('');
    wsConnection.update((state) => ({ ...state, statusMessage: i18n.messagesCleared }));
  }

  function exportMessages() {
    const dataStr = JSON.stringify($messages, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `websocket-messages-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    wsConnection.update((state) => ({ ...state, statusMessage: i18n.messagesExported }));
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
      wsConnection.update((state) => ({ ...state, statusMessage: i18n.importing }));
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported =
            typeof e.target.result === 'string'
              ? JSON.parse(e.target.result)
              : JSON.parse(new TextDecoder().decode(e.target.result));
          if (!Array.isArray(imported)) {
            wsConnection.update((state) => ({ ...state, statusMessage: i18n.importError }));
            return;
          }

          importMessagesAction(imported);
          wsConnection.update((state) => ({
            ...state,
            statusMessage: i18n.imported(imported.length, getMessageWord(imported.length)),
          }));
        } catch {
          wsConnection.update((state) => ({
            ...state,
            statusMessage: i18n.importErrorInvalidJson,
          }));
        }
      };
      reader.readAsText(file);
    }
  }

  // UI handlers - using reactive Set and Map with $state()
  function toggleMessageExpansion(index) {
    if (expandedMessages.has(index)) {
      expandedMessages.delete(index);
      expandedNestedPaths.delete(index);
    } else {
      expandedMessages.add(index);
      if (!expandedNestedPaths.has(index)) {
        expandedNestedPaths.set(index, new Set());
      }
    }
  }

  function toggleNestedPath(messageIndex, path) {
    if (!expandedNestedPaths.has(messageIndex)) {
      expandedNestedPaths.set(messageIndex, new Set());
    }
    const paths = expandedNestedPaths.get(messageIndex);
    if (paths.has(path)) {
      paths.delete(path);
    } else {
      paths.add(path);
    }
  }

  // Pagination handlers
  function nextPage() {
    pagination.update((p) => ({
      ...p,
      currentPage: Math.min(p.currentPage + 1, totalPages - 1),
    }));
  }

  function prevPage() {
    pagination.update((p) => ({
      ...p,
      currentPage: Math.max(p.currentPage - 1, 0),
    }));
  }

  function goToLastPage() {
    pagination.update((p) => ({
      ...p,
      currentPage: Math.max(0, totalPages - 1),
    }));
  }
</script>

<div class="container">
  <div class="header">
    <h1>{i18n.title}</h1>
    <p class="subtitle">{i18n.subtitle}</p>
  </div>

  <div class="main-content">
    <div class="controls-column">
      <ConnectionPanel
        bind:wsUrl
        isConnected={$wsConnection.isConnected}
        statusMessage={$wsConnection.statusMessage}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <div class="capture-panel">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={$autoCapture} />
          {i18n.autoCapture}
        </label>
      </div>

      <FilterPanel
        bind:filterRequestId={$filterRequestId}
        bind:customFilterField={$customFilterField}
        bind:customFilterValue={$customFilterValue}
        bind:groupByRequestId={$groupByRequestId}
        {availableFields}
        {fieldIsFilterable}
        {availableValues}
      />

      <ActionsPanel messages={$messages} onExport={exportMessages} onImport={handleImport} onClear={clearMessages} />
    </div>

    <div class="messages-column">
      <MessagesPanel
        messages={$messages}
        {filteredMessages}
        groupByRequestId={$groupByRequestId}
        {groupedMessages}
        currentPage={$pagination.currentPage}
        messagesPerPage={$pagination.messagesPerPage}
        {totalPages}
        {visibleMessages}
        {startIndex}
        {expandedMessages}
        {expandedNestedPaths}
        onToggleExpand={toggleMessageExpansion}
        onTogglePath={toggleNestedPath}
        onPrevPage={prevPage}
        onNextPage={nextPage}
        onLastPage={goToLastPage}
      />
    </div>
  </div>
</div>

<style>
  .container {
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      Roboto,
      Oxygen,
      Ubuntu,
      Cantarell,
      sans-serif;
    max-width: 100%;
    margin: 0 auto;
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
  }

  .header h1 {
    margin: 0;
    color: #333;
    font-size: 28px;
  }

  .subtitle {
    color: #666;
    margin: 5px 0 0;
  }

  /* Mobile-first layout: stacked vertically */
  .main-content {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .controls-column {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .messages-column {
    display: flex;
    flex-direction: column;
  }

  /* Tablet breakpoint: 768px and up */
  @media (min-width: 768px) {
    .container {
      padding: 30px;
    }

    .header h1 {
      font-size: 32px;
    }
  }

  /* Desktop breakpoint: 1024px and up - two-column layout */
  @media (min-width: 1024px) {
    .container {
      max-width: 1400px;
      padding: 40px;
    }

    .main-content {
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 30px;
      align-items: start;
    }

    .controls-column {
      position: sticky;
      top: 20px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
    }

    .messages-column {
      min-width: 0; /* Prevent grid blowout */
    }
  }

  .capture-panel {
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: #555;
    font-weight: 500;
  }

  .checkbox-label input[type='checkbox'] {
    cursor: pointer;
  }
</style>
