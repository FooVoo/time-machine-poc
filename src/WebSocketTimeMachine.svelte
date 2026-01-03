<svelte:options customElement="websocket-time-machine" />

<script>
  // Smart Component - Contains business logic and state management
  import ConnectionPanel from './lib/components/connection/ConnectionPanel.svelte';
  import FilterPanel from './lib/components/filters/FilterPanel.svelte';
  import ActionsPanel from './lib/components/actions/ActionsPanel.svelte';
  import MessagesPanel from './lib/components/messages/MessagesPanel.svelte';
  import { i18n, getMessageWord } from './lib/utils/i18n.js';
  import { parseMessageData } from './lib/utils/message-utils.js';
  import { getNestedValue, extractFieldPaths } from './lib/utils/filter-utils.js';

  // WebSocket connection state
  let wsUrl = $state('');
  let ws = null;
  let isConnected = $state(false);
  let statusMessage = $state('');

  // Messages state
  let messages = $state([]);
  let autoCapture = $state(false);

  // Filtering state
  let filterRequestId = $state('');
  let groupByRequestId = $state(false);
  let customFilterField = $state('');
  let customFilterValue = $state('');

  // Pagination state
  let currentPage = $state(0);
  let messagesPerPage = $state(50);

  // UI state
  let primitiveFields = new Set();
  let fieldValues = new Map();
  let expandedMessages = $state(new Set());
  let expandedNestedPaths = $state(new Map());

  // Derived state - field extraction
  let availableFields = $derived.by(() => getAllFieldPaths(messages));
  let fieldIsFilterable = $derived(primitiveFields.has(customFilterField));
  let availableValues = $derived.by(() => {
    if (!fieldIsFilterable) {
      return [];
    }
    if (!fieldValues.has(customFilterField)) {
      return [];
    }
    return Array.from(fieldValues.get(customFilterField)).sort();
  });

  // Derived state - filtering
  let filteredByRequestId = $derived.by(() => {
    if (!filterRequestId) {
      return messages;
    }
    return messages.filter((msg) => {
      const data = parseMessageData(msg);
      return data && data.requestId && data.requestId.includes(filterRequestId);
    });
  });

  let filteredMessages = $derived(filterByCustomField(filteredByRequestId));

  let groupedMessages = $derived.by(() => {
    if (!groupByRequestId) {
      return null;
    }
    return groupMessagesByRequestId(filteredMessages);
  });

  // Derived state - pagination
  let totalPages = $derived(Math.ceil(filteredMessages.length / messagesPerPage));
  let visibleMessages = $derived(
    filteredMessages.slice(currentPage * messagesPerPage, (currentPage + 1) * messagesPerPage)
  );
  let startIndex = $derived(currentPage * messagesPerPage);

  // Get all available field paths from messages
  function getAllFieldPaths(msgs) {
    const fieldsSet = new Set();
    const primFields = new Set();
    const valuesMap = new Map();

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
    if (!customFilterField || !customFilterValue) {
      return msgs;
    }

    return msgs.filter((msg) => {
      let value;

      if (customFilterField.startsWith('data.')) {
        const data = parseMessageData(msg);
        if (!data) {
          return false;
        }
        const fieldPath = customFilterField.substring(5);
        value = getNestedValue(data, fieldPath);
      } else {
        value = msg[customFilterField];
      }

      if (value === undefined || value === null) {
        return false;
      }

      const valueStr = String(value).toLowerCase();
      const filterStr = customFilterValue.toLowerCase();

      return valueStr.includes(filterStr);
    });
  }

  // Group messages by requestId
  function groupMessagesByRequestId(msgs) {
    const groups = new Map();

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
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        isConnected = true;
        statusMessage = `${i18n.connectedTo(wsUrl)}`;
      };

      ws.onmessage = (event) => {
        if (autoCapture) {
          const message = {
            timestamp: new Date().toISOString(),
            type: 'received',
            data: event.data,
          };
          const wasOnLastPage = currentPage === totalPages - 1 || messages.length === 0;
          messages.push(message);
          messages = messages;

          if (wasOnLastPage) {
            currentPage = Math.max(0, Math.ceil(messages.length / messagesPerPage) - 1);
          }
        }
      };

      ws.onerror = () => {
        statusMessage = i18n.connectionError;
      };

      ws.onclose = () => {
        isConnected = false;
        statusMessage = i18n.disconnectedStatus;
      };
    } catch (error) {
      statusMessage = i18n.connectionErrorWithMsg(error.message);
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
      isConnected = false;
    }
  }

  // Message operations
  function clearMessages() {
    messages = [];
    currentPage = 0;
    filterRequestId = '';
    statusMessage = i18n.messagesCleared;
  }

  function exportMessages() {
    const dataStr = JSON.stringify(messages, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `websocket-messages-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    statusMessage = i18n.messagesExported;
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
      statusMessage = i18n.importing;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported =
            typeof e.target.result === 'string'
              ? JSON.parse(e.target.result)
              : JSON.parse(new TextDecoder().decode(e.target.result));
          if (!Array.isArray(imported)) {
            statusMessage = i18n.importError;
            return;
          }

          messages = imported.slice();
          currentPage = 0;
          statusMessage = i18n.imported(messages.length, getMessageWord(messages.length));
        } catch {
          statusMessage = i18n.importErrorInvalidJson;
        }
      };
      reader.readAsText(file);
    }
  }

  // UI handlers
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
    expandedMessages = expandedMessages;
    expandedNestedPaths = expandedNestedPaths;
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
    expandedNestedPaths = expandedNestedPaths;
  }

  // Pagination handlers
  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  function goToLastPage() {
    currentPage = Math.max(0, totalPages - 1);
  }
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

  <ActionsPanel {messages} onExport={exportMessages} onImport={handleImport} onClear={clearMessages} />

  <MessagesPanel
    {messages}
    {filteredMessages}
    {groupByRequestId}
    {groupedMessages}
    {currentPage}
    {messagesPerPage}
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

<style>
  :host {
    --json-viewer-max-height: 400px;
  }

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
    max-width: 900px;
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
