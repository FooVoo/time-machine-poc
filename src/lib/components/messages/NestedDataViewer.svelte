<script>
  import { formatValue, getValueType, getValuePreview } from '../../utils/message-utils.js';
  import NestedDataViewer from './NestedDataViewer.svelte';

  let { data, messageIndex, expandedPaths, onTogglePath, path = '' } = $props();

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
            <NestedDataViewer data={item} {messageIndex} {expandedPaths} {onTogglePath} path={itemPath} />
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
            <NestedDataViewer data={value} {messageIndex} {expandedPaths} {onTogglePath} path={itemPath} />
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
  .nested-data {
    padding-left: 20px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .nested-item {
    margin: 4px 0;
  }

  .nested-key {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .nested-toggle {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 16px;
    font-size: 10px;
  }

  .nested-toggle:hover {
    color: #333;
  }

  .nested-no-toggle {
    display: inline-block;
    width: 16px;
  }

  .nested-index,
  .nested-property {
    color: #881391;
    font-weight: 500;
  }

  .nested-preview {
    color: #888;
    font-style: italic;
  }

  .nested-children {
    margin-left: 8px;
  }

  .nested-value {
    margin-left: 20px;
  }

  .nested-value-string {
    color: #a31515;
  }

  .nested-value-number {
    color: #098658;
  }

  .nested-value-boolean {
    color: #0000ff;
  }

  .nested-value-null,
  .nested-value-undefined {
    color: #808080;
  }
</style>
