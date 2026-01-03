<script>
  import { parseMessageData, formatValue } from '../../utils/message-utils.js';
  import { i18n } from '../../utils/i18n.js';
  import JsonViewer from './JsonViewer.svelte';

  let {
    message,
    index,
    isExpanded = false,
    expandedPaths,
    onToggleExpand,
    onTogglePath,
    showIndex = true,
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
    <span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
    <button
      class="expand-btn"
      onclick={onToggleExpand}
      title={isExpanded ? i18n.collapseJson : i18n.expandJson}
    >
      {isExpanded ? '▼' : '▶'}
    </button>
  </div>

  {#if isExpanded && parsedData}
    <JsonViewer data={parsedData} messageIndex={index} {expandedPaths} {onTogglePath} />
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
</style>
