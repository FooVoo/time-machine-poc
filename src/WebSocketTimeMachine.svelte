<svelte:options customElement="websocket-time-machine" />

<script>
  let wsUrl = '';
  let ws = null;
  let isConnected = false;
  let messages = [];
  let autoCapture = false;
  let statusMessage = '';
  
  // Filtering and grouping
  let filterRequestId = '';
  let groupByRequestId = false;
  let customFilterField = '';
  let customFilterValue = '';
  let showFieldSuggestions = false;
  let availableFields = [];
  let expandedMessages = new Set();
  
  // Constants
  const AUTOCOMPLETE_BLUR_DELAY = 200;
  const MAX_AUTOCOMPLETE_SUGGESTIONS = 10;
  
  // Pagination state
  let currentPage = 0;
  let messagesPerPage = 50;
  
  // Russian pluralization helper
  function pluralizeRussian(count, one, few, many) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    
    if (mod10 === 1 && mod100 !== 11) {
      return one;
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      return few;
    } else {
      return many;
    }
  }
  
  // Parse message data once and cache it
  function parseMessageData(msg) {
    try {
      return typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
    } catch {
      return null;
    }
  }
  
  // Extract all field paths from an object (including nested)
  function extractFieldPaths(obj, prefix = '') {
    const paths = [];
    
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key in obj) {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          paths.push(...extractFieldPaths(obj[key], path));
        }
      }
    }
    
    return paths;
  }
  
  // Get all available field paths from messages
  function getAllFieldPaths(msgs) {
    const fieldsSet = new Set();
    
    for (const msg of msgs) {
      // Add top-level message fields
      fieldsSet.add('type');
      fieldsSet.add('timestamp');
      fieldsSet.add('data');
      
      // Parse and add nested data fields
      const data = parseMessageData(msg);
      if (data) {
        const dataPaths = extractFieldPaths(data, 'data');
        dataPaths.forEach(path => fieldsSet.add(path));
      }
    }
    
    return Array.from(fieldsSet).sort();
  }
  
  // Get value from nested path
  function getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  // Filter messages by custom field
  function filterByCustomField(msgs) {
    if (!customFilterField || !customFilterValue) {
      return msgs;
    }
    
    return msgs.filter(msg => {
      let value;
      
      if (customFilterField.startsWith('data.')) {
        const data = parseMessageData(msg);
        if (!data) return false;
        const fieldPath = customFilterField.substring(5); // Remove 'data.' prefix
        value = getNestedValue(data, fieldPath);
      } else {
        value = msg[customFilterField];
      }
      
      if (value === undefined || value === null) return false;
      
      const valueStr = String(value).toLowerCase();
      const filterStr = customFilterValue.toLowerCase();
      
      return valueStr.includes(filterStr);
    });
  }
  
  // Toggle message expansion
  function toggleMessageExpansion(index) {
    if (expandedMessages.has(index)) {
      expandedMessages.delete(index);
    } else {
      expandedMessages.add(index);
    }
    expandedMessages = expandedMessages;
  }
  
  // Format value for display (handle different types)
  function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  }
  
  // Computed values for filtering and grouping
  $: {
    // Update available fields when messages change
    availableFields = getAllFieldPaths(messages);
  }
  
  $: filteredByRequestId = filterRequestId 
    ? messages.filter(msg => {
        const data = parseMessageData(msg);
        return data && data.requestId && data.requestId.includes(filterRequestId);
      })
    : messages;
  
  $: filteredMessages = filterByCustomField(filteredByRequestId);
  
  $: groupedMessages = groupByRequestId ? groupMessagesByRequestId(filteredMessages) : null;
  
  $: displayMessages = groupByRequestId ? [] : filteredMessages;
  
  $: totalPages = Math.ceil(displayMessages.length / messagesPerPage);
  $: visibleMessages = displayMessages.slice(
    currentPage * messagesPerPage,
    (currentPage + 1) * messagesPerPage
  );
  $: startIndex = currentPage * messagesPerPage;
  
  $: filteredFieldSuggestions = customFilterField 
    ? availableFields.filter(f => f.toLowerCase().includes(customFilterField.toLowerCase()))
    : availableFields;
  
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

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        isConnected = true;
        statusMessage = 'Подключено к ' + wsUrl;
      };
      
      ws.onmessage = (event) => {
        if (autoCapture) {
          const message = {
            timestamp: new Date().toISOString(),
            type: 'received',
            data: event.data
          };
          // Use push instead of spread operator for better performance
          const wasOnLastPage = currentPage === totalPages - 1 || messages.length === 0;
          messages.push(message);
          messages = messages; // Trigger reactivity
          
          // Auto-scroll to latest page if user was viewing the last page
          if (wasOnLastPage) {
            currentPage = Math.max(0, Math.ceil(messages.length / messagesPerPage) - 1);
          }
        }
      };
      
      ws.onerror = (error) => {
        statusMessage = 'Ошибка WebSocket соединения';
      };
      
      ws.onclose = () => {
        isConnected = false;
        statusMessage = 'Отключено';
      };
    } catch (error) {
      statusMessage = 'Ошибка подключения: ' + error.message;
    }
  }

  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
      isConnected = false;
    }
  }

  function clearMessages() {
    messages = [];
    currentPage = 0;
    filterRequestId = '';
    statusMessage = 'Сообщения очищены';
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
    statusMessage = 'Сообщения экспортированы';
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
      statusMessage = 'Импорт...';
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            statusMessage = 'Ошибка импорта: Неверный формат';
            return;
          }
          
          messages = imported.slice();
          currentPage = 0;
          statusMessage = `Импортировано ${messages.length} ${pluralizeRussian(messages.length, 'сообщение', 'сообщения', 'сообщений')}`;
        } catch (error) {
          statusMessage = 'Ошибка импорта: Некорректный JSON';
        }
      };
      reader.readAsText(file);
    }
  }
  
  function goToPage(page) {
    if (page >= 0 && page < totalPages) {
      currentPage = page;
    }
  }
  
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
    <h1>Машина Времени WebSocket</h1>
    <p class="subtitle">Экспорт и Импорт WebSocket сообщений</p>
  </div>

  <div class="connection-panel">
    <div class="input-group">
      <label for="ws-url">URL WebSocket:</label>
      <input 
        id="ws-url"
        type="text" 
        bind:value={wsUrl} 
        disabled={isConnected}
        placeholder="ws://localhost:8080"
      />
    </div>
    
    <div class="button-group">
      {#if isConnected}
        <button class="btn btn-danger" on:click={disconnect}>Отключить</button>
      {:else}
        <button class="btn btn-primary" on:click={connect}>Подключить</button>
      {/if}
    </div>

    <div class="status">
      <span class="status-indicator" class:connected={isConnected}></span>
      <span class="status-text">{statusMessage || (isConnected ? 'Подключено' : 'Отключено')}</span>
    </div>
  </div>

  <div class="capture-panel">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={autoCapture} />
      Автоматически захватывать сообщения
    </label>
  </div>
  
  <div class="filter-panel">
    <div class="filter-section">
      <h3>Фильтр по ID запроса</h3>
      <div class="input-group">
        <label for="filter">ID запроса:</label>
        <input 
          id="filter"
          type="text" 
          bind:value={filterRequestId} 
          placeholder="Введите ID запроса для фильтрации"
        />
      </div>
    </div>
    
    <div class="filter-section">
      <h3>Фильтр по пользовательскому полю</h3>
      <div class="custom-filter-group">
        <div class="input-group autocomplete-container">
          <label for="custom-field">Поле:</label>
          <input 
            id="custom-field"
            type="text" 
            bind:value={customFilterField}
            on:focus={() => showFieldSuggestions = true}
            on:blur={() => setTimeout(() => showFieldSuggestions = false, AUTOCOMPLETE_BLUR_DELAY)}
            placeholder="напр. data.userId, type, timestamp"
            autocomplete="off"
          />
          {#if showFieldSuggestions && filteredFieldSuggestions.length > 0}
            <div class="autocomplete-dropdown">
              {#each filteredFieldSuggestions.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS) as field}
                <div 
                  class="autocomplete-item"
                  role="button"
                  tabindex="0"
                  on:mousedown={() => {
                    customFilterField = field;
                    showFieldSuggestions = false;
                  }}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      customFilterField = field;
                      showFieldSuggestions = false;
                    }
                  }}
                >
                  {field}
                </div>
              {/each}
              {#if filteredFieldSuggestions.length > MAX_AUTOCOMPLETE_SUGGESTIONS}
                <div class="autocomplete-more">
                  +{filteredFieldSuggestions.length - MAX_AUTOCOMPLETE_SUGGESTIONS} ещё...
                </div>
              {/if}
            </div>
          {/if}
        </div>
        <div class="input-group">
          <label for="custom-value">Значение:</label>
          <input 
            id="custom-value"
            type="text" 
            bind:value={customFilterValue}
            placeholder="Введите значение для поиска"
          />
        </div>
      </div>
    </div>
    
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={groupByRequestId} />
      Группировать по ID запроса
    </label>
  </div>

  <div class="actions-panel">
    <button class="btn btn-success" on:click={exportMessages} disabled={messages.length === 0}>
      Экспортировать сообщения ({messages.length})
    </button>
    
    <label class="btn btn-info file-label">
      Импортировать сообщения
      <input 
        type="file" 
        accept=".json" 
        on:change={handleImport}
        style="display: none;"
      />
    </label>
    
    <button class="btn btn-warning" on:click={clearMessages} disabled={messages.length === 0}>
      Очистить сообщения
    </button>
  </div>

  <div class="messages-panel">
    <h2>Захваченные сообщения ({filteredMessages.length}{filterRequestId ? ` из ${messages.length}` : ''})</h2>
    
    {#if groupByRequestId && groupedMessages}
      <!-- Grouped view by Request ID -->
      <div class="grouped-messages">
        {#each [...groupedMessages.entries()] as [requestId, msgs]}
          <div class="request-group">
            <div class="group-header">
              <strong>ID запроса:</strong> {requestId}
              <span class="group-count">({msgs.length} {pluralizeRussian(msgs.length, 'сообщение', 'сообщения', 'сообщений')})</span>
            </div>
            <div class="group-messages">
              {#each msgs as message, index}
                {@const globalIndex = `group-${requestId}-${index}`}
                {@const isExpanded = expandedMessages.has(globalIndex)}
                {@const parsedData = parseMessageData(message)}
                
                <div class="message-item" class:sent={message.type === 'sent'} class:received={message.type === 'received'}>
                  <div class="message-header">
                    <span class="message-type">{message.type}</span>
                    <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
                    <button 
                      class="expand-btn" 
                      on:click={() => toggleMessageExpansion(globalIndex)}
                      title={isExpanded ? 'Свернуть' : 'Развернуть JSON'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>
                  
                  {#if isExpanded && parsedData}
                    <div class="json-viewer">
                      <pre class="json-content">{JSON.stringify(parsedData, null, 2)}</pre>
                    </div>
                  {:else if isExpanded && !parsedData}
                    <div class="message-data primitive">
                      <span class="primitive-label">Примитивное значение:</span>
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
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-state">Не найдено сообщений с ID запроса</div>
        {/each}
      </div>
    {:else}
      <!-- Regular list view with pagination -->
      {#if !groupByRequestId && displayMessages.length > messagesPerPage}
        <div class="pagination-controls">
          <button class="btn btn-sm" on:click={prevPage} disabled={currentPage === 0}>
            Предыдущая
          </button>
          <span class="page-info">
            Страница {currentPage + 1} из {totalPages} 
            (показано {startIndex + 1}-{Math.min(startIndex + messagesPerPage, displayMessages.length)} из {displayMessages.length})
          </span>
          <button class="btn btn-sm" on:click={nextPage} disabled={currentPage === totalPages - 1}>
            Следующая
          </button>
          <button class="btn btn-sm" on:click={goToLastPage}>
            Последняя
          </button>
        </div>
      {/if}
      
      <div class="messages-list">
        {#each visibleMessages as message, index}
          {@const globalIndex = startIndex + index}
          {@const isExpanded = expandedMessages.has(globalIndex)}
          {@const parsedData = parseMessageData(message)}
          
          <div class="message-item" class:sent={message.type === 'sent'} class:received={message.type === 'received'}>
            <div class="message-header">
              <span class="message-index">#{globalIndex + 1}</span>
              <span class="message-type">{message.type}</span>
              <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
              <button 
                class="expand-btn" 
                on:click={() => toggleMessageExpansion(globalIndex)}
                title={isExpanded ? 'Свернуть' : 'Развернуть JSON'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            </div>
            
            {#if isExpanded && parsedData}
              <div class="json-viewer">
                <pre class="json-content">{JSON.stringify(parsedData, null, 2)}</pre>
              </div>
            {:else if isExpanded && !parsedData}
              <div class="message-data primitive">
                <span class="primitive-label">Примитивное значение:</span>
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
        {:else}
          <div class="empty-state">Сообщения ещё не захвачены</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  :host {
    --json-viewer-max-height: 400px;
  }
  
  .container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
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

  .connection-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .input-group {
    margin-bottom: 15px;
  }

  .input-group label {
    display: block;
    margin-bottom: 5px;
    color: #555;
    font-weight: 500;
  }

  .input-group input[type="text"] {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .input-group input[type="text"]:disabled {
    background: #f0f0f0;
    cursor: not-allowed;
  }

  .button-group {
    margin-bottom: 15px;
  }

  .btn {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0056b3;
  }

  .btn-danger {
    background: #dc3545;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #c82333;
  }

  .btn-success {
    background: #28a745;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #218838;
  }

  .btn-info {
    background: #17a2b8;
    color: white;
  }

  .btn-info:hover:not(:disabled) {
    background: #138496;
  }

  .btn-warning {
    background: #ffc107;
    color: #333;
  }

  .btn-warning:hover:not(:disabled) {
    background: #e0a800;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #dc3545;
  }

  .status-indicator.connected {
    background: #28a745;
  }

  .status-text {
    color: #555;
    font-size: 14px;
  }

  .capture-panel {
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .filter-panel {
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .filter-section {
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 15px;
  }
  
  .filter-section:last-of-type {
    border-bottom: none;
  }
  
  .filter-section h3 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
  
  .custom-filter-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }
  
  .autocomplete-container {
    position: relative;
  }
  
  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 4px 4px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
  }
  
  .autocomplete-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s;
  }
  
  .autocomplete-item:hover {
    background: #f0f0f0;
  }
  
  .autocomplete-more {
    padding: 8px 12px;
    font-size: 12px;
    color: #666;
    font-style: italic;
    background: #f8f9fa;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    color: #555;
    font-weight: 500;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"]:disabled {
    cursor: not-allowed;
  }

  .actions-panel {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .file-label {
    display: inline-block;
  }

  .messages-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .messages-panel h2 {
    margin: 0 0 15px;
    color: #333;
    font-size: 20px;
  }
  
  .pagination-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin-bottom: 15px;
    padding: 10px;
    background: #f8f9fa;
    border-radius: 4px;
  }
  
  .page-info {
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }
  
  .btn-sm {
    padding: 6px 12px;
    font-size: 12px;
  }

  .messages-list {
    max-height: 400px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .message-item {
    padding: 12px;
    border-radius: 4px;
    border-left: 4px solid #ccc;
  }

  .message-item.sent {
    background: #e3f2fd;
    border-left-color: #2196f3;
  }

  .message-item.received {
    background: #f3e5f5;
    border-left-color: #9c27b0;
  }

  .message-header {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
    font-size: 12px;
    color: #666;
  }

  .message-index {
    font-weight: bold;
  }

  .message-type {
    text-transform: uppercase;
    font-weight: 500;
  }

  .message-time {
    margin-left: auto;
  }
  
  .expand-btn {
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 3px;
    padding: 2px 8px;
    font-size: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .expand-btn:hover {
    background: #e0e0e0;
  }

  .message-data {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    word-break: break-word;
    color: #333;
  }
  
  .message-data.primitive {
    display: flex;
    gap: 8px;
  }
  
  .primitive-label {
    font-weight: 600;
    color: #555;
  }
  
  .primitive-value {
    color: #0066cc;
  }
  
  .json-viewer {
    margin-top: 10px;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    overflow: auto;
    max-height: var(--json-viewer-max-height);
  }
  
  .json-content {
    margin: 0;
    padding: 12px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    color: #333;
    overflow-x: auto;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
  }
  
  .grouped-messages {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .request-group {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .group-header {
    background: #f8f9fa;
    padding: 12px 15px;
    border-bottom: 1px solid #ddd;
    font-size: 14px;
    color: #333;
  }
  
  .group-count {
    margin-left: 10px;
    color: #666;
    font-size: 12px;
  }
  
  .group-messages {
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
</style>
