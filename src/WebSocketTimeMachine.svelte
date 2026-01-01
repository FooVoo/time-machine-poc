<svelte:options customElement="websocket-time-machine" />

<script>
  let wsUrl = '';
  let ws = null;
  let isConnected = false;
  let messages = [];
  let autoCapture = false;
  let replayMode = false;
  let statusMessage = '';
  let messageHistory = []; // Imported history for replay mode
  let responseMap = {}; // Map for O(1) lookup of responses
  
  const REPLAY_RESPONSE_DELAY_MS = 100; // Delay before simulating response

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
          messages = [...messages, message];
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
    messageHistory = [];
    responseMap = {};
    replayMode = false;
    statusMessage = 'Messages and history cleared';
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

  function buildResponseMap(history) {
    // Build a map for O(1) lookup: sent message -> received response
    const map = {};
    for (let i = 0; i < history.length; i++) {
      if (history[i].type === 'sent') {
        // Look for the next received message
        for (let j = i + 1; j < history.length; j++) {
          if (history[j].type === 'received') {
            map[history[i].data] = history[j].data;
            break;
          }
        }
      }
    }
    return map;
  }

  function handleImport(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          messageHistory = Array.isArray(imported) ? imported : [];
          messages = [...messageHistory];
          responseMap = buildResponseMap(messageHistory);
          statusMessage = `Imported ${messageHistory.length} messages`;
        } catch (error) {
          statusMessage = 'Import failed: Invalid JSON';
        }
      };
      reader.readAsText(file);
    }
  }

  function handleReplayMode(messageData) {
    // Check if there's a matching response in the map
    const matchingResponse = responseMap[messageData];
    
    if (matchingResponse) {
      // Found a match - simulate the response locally
      if (autoCapture) {
        const sentMsg = {
          timestamp: new Date().toISOString(),
          type: 'sent',
          data: messageData
        };
        messages = [...messages, sentMsg];
        
        // Simulate receiving the matching response after a short delay
        setTimeout(() => {
          const receivedMsg = {
            timestamp: new Date().toISOString(),
            type: 'received',
            data: matchingResponse
          };
          messages = [...messages, receivedMsg];
          statusMessage = 'Replayed from history';
        }, REPLAY_RESPONSE_DELAY_MS);
      }
      return true; // Message was intercepted
    }
    
    // No match found - will pass through
    statusMessage = 'No match in history, passing through';
    return false;
  }

  function sendMessage(messageData) {
    if (ws && isConnected) {
      // In replay mode, try to intercept and match against history
      if (replayMode && handleReplayMode(messageData)) {
        return; // Message was intercepted and replayed
      }
      
      // Normal mode or pass-through: send to actual WebSocket
      ws.send(messageData);
      if (autoCapture) {
        const message = {
          timestamp: new Date().toISOString(),
          type: 'sent',
          data: messageData
        };
        messages = [...messages, message];
      }
    }
  }

  let messageToSend = '';
  
  function handleSend() {
    if (messageToSend.trim()) {
      sendMessage(messageToSend);
      messageToSend = '';
    }
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
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={replayMode} disabled={messageHistory.length === 0} />
      Replay mode (intercept and match against history)
    </label>
    {#if messageHistory.length > 0}
      <div class="history-info">
        📚 History loaded: {messageHistory.length} messages available for replay
      </div>
    {/if}
  </div>

  {#if isConnected}
    <div class="send-panel">
      <div class="input-group">
        <label for="message">Send Message:</label>
        <input 
          id="message"
          type="text" 
          bind:value={messageToSend} 
          placeholder="Enter message to send"
          on:keypress={(e) => e.key === 'Enter' && handleSend()}
        />
      </div>
      <button class="btn btn-secondary" on:click={handleSend}>Send</button>
    </div>
  {/if}

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
    <h2>Captured Messages ({messages.length})</h2>
    <div class="messages-list">
      {#each messages as message, index}
        <div class="message-item" class:sent={message.type === 'sent'} class:received={message.type === 'received'}>
          <div class="message-header">
            <span class="message-index">#{index + 1}</span>
            <span class="message-type">{message.type}</span>
            <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
          </div>
          <div class="message-data">{message.data}</div>
        </div>
      {:else}
        <div class="empty-state">No messages captured yet</div>
      {/each}
    </div>
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

  .btn-secondary {
    background: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #545b62;
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

  .history-info {
    padding: 10px;
    background: #e7f3ff;
    border-left: 4px solid #2196f3;
    border-radius: 4px;
    color: #1565c0;
    font-size: 14px;
    margin-top: 5px;
  }

  .send-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    display: flex;
    gap: 10px;
    align-items: flex-end;
  }

  .send-panel .input-group {
    flex: 1;
    margin-bottom: 0;
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
</style>
