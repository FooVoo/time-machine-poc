<script>
  import { i18n } from '../../utils/i18n.js';

  let { wsUrl = $bindable(''), isConnected = false, statusMessage = '', onConnect, onDisconnect } =
    $props();
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
      <button class="btn btn-danger" onclick={onDisconnect}>{i18n.disconnect}</button>
    {:else}
      <button class="btn btn-primary" onclick={onConnect}>{i18n.connect}</button>
    {/if}
  </div>

  <div class="status">
    <span class="status-indicator" class:connected={isConnected}></span>
    <span class="status-text"
      >{statusMessage || (isConnected ? i18n.connected : i18n.disconnected)}</span
    >
  </div>
</div>

<style>
  .connection-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

  .input-group input[type='text'] {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
  }

  .input-group input[type='text']:disabled {
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
</style>
