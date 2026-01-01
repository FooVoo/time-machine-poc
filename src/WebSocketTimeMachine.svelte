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
  
  // Pagination state
  let currentPage = 0;
  let messagesPerPage = 50;
  
  // Computed values for filtering and grouping
  $: filteredMessages = filterRequestId 
    ? messages.filter(msg => {
        try {
          const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
          return data.requestId && data.requestId.includes(filterRequestId);
        } catch {
          return false;
        }
      })
    : messages;
  
  $: groupedMessages = groupByRequestId ? groupMessagesByRequestId(filteredMessages) : null;
  
  $: displayMessages = groupByRequestId ? [] : filteredMessages;
  
  $: totalPages = Math.ceil(displayMessages.length / messagesPerPage);
  $: visibleMessages = displayMessages.slice(
    currentPage * messagesPerPage,
    (currentPage + 1) * messagesPerPage
  );
  $: startIndex = currentPage * messagesPerPage;
  
  function groupMessagesByRequestId(msgs) {
    const groups = new Map();
    
    for (const msg of msgs) {
      try {
        const data = typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
        const requestId = data.requestId;
        
        if (requestId) {
          if (!groups.has(requestId)) {
            groups.set(requestId, []);
          }
          groups.get(requestId).push(msg);
        }
      } catch {
        // Skip messages that can't be parsed
      }
    }
    
    return groups;
  }

  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        isConnected = true;
        statusMessage = 'Connected to ' + wsUrl;
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
        statusMessage = 'WebSocket error occurred';
      };
      
      ws.onclose = () => {
        isConnected = false;
        statusMessage = 'Disconnected';
      };
    } catch (error) {
      statusMessage = 'Connection failed: ' + error.message;
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
    statusMessage = 'Messages cleared';
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
    statusMessage = 'Messages exported';
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
      statusMessage = 'Importing...';
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            statusMessage = 'Import failed: Invalid format';
            return;
          }
          
          messages = imported.slice();
          currentPage = 0;
          statusMessage = `Imported ${messages.length} messages`;
        } catch (error) {
          statusMessage = 'Import failed: Invalid JSON';
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
    <h1>WebSocket Time Machine</h1>
    <p class="subtitle">Export and Import WebSocket Messages</p>
  </div>

  <div class="connection-panel">
    <div class="input-group">
      <label for="ws-url">WebSocket URL:</label>
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
        <button class="btn btn-danger" on:click={disconnect}>Disconnect</button>
      {:else}
        <button class="btn btn-primary" on:click={connect}>Connect</button>
      {/if}
    </div>

    <div class="status">
      <span class="status-indicator" class:connected={isConnected}></span>
      <span class="status-text">{statusMessage || (isConnected ? 'Connected' : 'Disconnected')}</span>
    </div>
  </div>

  <div class="capture-panel">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={autoCapture} />
      Auto-capture messages
    </label>
  </div>
  
  <div class="filter-panel">
    <div class="input-group">
      <label for="filter">Filter by Request ID:</label>
      <input 
        id="filter"
        type="text" 
        bind:value={filterRequestId} 
        placeholder="Enter request ID to filter"
      />
    </div>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={groupByRequestId} />
      Group by Request ID
    </label>
  </div>

  <div class="actions-panel">
    <button class="btn btn-success" on:click={exportMessages} disabled={messages.length === 0}>
      Export Messages ({messages.length})
    </button>
    
    <label class="btn btn-info file-label">
      Import Messages
      <input 
        type="file" 
        accept=".json" 
        on:change={handleImport}
        style="display: none;"
      />
    </label>
    
    <button class="btn btn-warning" on:click={clearMessages} disabled={messages.length === 0}>
      Clear Messages
    </button>
  </div>

  <div class="messages-panel">
    <h2>Captured Messages ({filteredMessages.length}{filterRequestId ? ` filtered from ${messages.length}` : ''})</h2>
    
    {#if groupByRequestId && groupedMessages}
      <!-- Grouped view by Request ID -->
      <div class="grouped-messages">
        {#each [...groupedMessages.entries()] as [requestId, msgs]}
          <div class="request-group">
            <div class="group-header">
              <strong>Request ID:</strong> {requestId}
              <span class="group-count">({msgs.length} messages)</span>
            </div>
            <div class="group-messages">
              {#each msgs as message, index}
                <div class="message-item" class:sent={message.type === 'sent'} class:received={message.type === 'received'}>
                  <div class="message-header">
                    <span class="message-type">{message.type}</span>
                    <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div class="message-data">{message.data}</div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="empty-state">No messages with Request ID found</div>
        {/each}
      </div>
    {:else}
      <!-- Regular list view with pagination -->
      {#if !groupByRequestId && displayMessages.length > messagesPerPage}
        <div class="pagination-controls">
          <button class="btn btn-sm" on:click={prevPage} disabled={currentPage === 0}>
            Previous
          </button>
          <span class="page-info">
            Page {currentPage + 1} of {totalPages} 
            (showing {startIndex + 1}-{Math.min(startIndex + messagesPerPage, displayMessages.length)} of {displayMessages.length})
          </span>
          <button class="btn btn-sm" on:click={nextPage} disabled={currentPage === totalPages - 1}>
            Next
          </button>
          <button class="btn btn-sm" on:click={goToLastPage}>
            Latest
          </button>
        </div>
      {/if}
      
      <div class="messages-list">
        {#each visibleMessages as message, index}
          <div class="message-item" class:sent={message.type === 'sent'} class:received={message.type === 'received'}>
            <div class="message-header">
              <span class="message-index">#{startIndex + index + 1}</span>
              <span class="message-type">{message.type}</span>
              <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-data">{message.data}</div>
          </div>
        {:else}
          <div class="empty-state">No messages captured yet</div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
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

  .message-data {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    word-break: break-word;
    color: #333;
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
