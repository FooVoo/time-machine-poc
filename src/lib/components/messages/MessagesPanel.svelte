<script>
  import { i18n, getMessageWord } from '../../utils/i18n.js';
  import PaginationControls from './PaginationControls.svelte';
  import MessageItem from './MessageItem.svelte';

  let {
    messages = [],
    filteredMessages = [],
    groupByRequestId = false,
    groupedMessages = null,
    currentPage,
    messagesPerPage,
    totalPages,
    visibleMessages,
    startIndex,
    expandedMessages,
    expandedNestedPaths,
    onToggleExpand,
    onTogglePath,
    onPrevPage,
    onNextPage,
    onLastPage,
  } = $props();
</script>

<div class="messages-panel">
  <h2>
    {i18n.capturedMessages(
      filteredMessages.length,
      filteredMessages.length !== messages.length ? messages.length : null
    )}
  </h2>

  {#if groupByRequestId && groupedMessages}
    <!-- Grouped view by Request ID -->
    <div class="grouped-messages">
      {#each [...groupedMessages.entries()] as [requestId, msgs] (requestId)}
        <div class="request-group">
          <div class="group-header">
            <strong>{i18n.requestIdHeader}</strong>
            {requestId}
            <span class="group-count">{i18n.messagesCount(msgs.length, getMessageWord(msgs.length))}</span>
          </div>
          <div class="group-messages">
            {#each msgs as message, index (`group-${requestId}-${index}`)}
              {@const globalIndex = `group-${requestId}-${index}`}
              {@const isExpanded = expandedMessages.has(globalIndex)}

              <MessageItem
                {message}
                index={globalIndex}
                {isExpanded}
                expandedPaths={expandedNestedPaths.get(globalIndex)}
                onToggleExpand={() => onToggleExpand(globalIndex)}
                {onTogglePath}
                showIndex={false}
              />
            {/each}
          </div>
        </div>
      {:else}
        <div class="empty-state">{i18n.noMessagesWithRequestId}</div>
      {/each}
    </div>
  {:else}
    <!-- Regular list view with pagination -->
    {#if !groupByRequestId && filteredMessages.length > messagesPerPage}
      <PaginationControls
        {currentPage}
        {totalPages}
        {startIndex}
        endIndex={Math.min(startIndex + messagesPerPage, filteredMessages.length)}
        totalItems={filteredMessages.length}
        onPrev={onPrevPage}
        onNext={onNextPage}
        onLast={onLastPage}
      />
    {/if}

    <div class="messages-list">
      {#each visibleMessages as message, index (startIndex + index)}
        {@const globalIndex = startIndex + index}
        {@const isExpanded = expandedMessages.has(globalIndex)}

        <MessageItem
          {message}
          index={globalIndex}
          {isExpanded}
          expandedPaths={expandedNestedPaths.get(globalIndex)}
          onToggleExpand={() => onToggleExpand(globalIndex)}
          {onTogglePath}
        />
      {:else}
        <div class="empty-state">{i18n.noMessagesCaptured}</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .messages-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

  .grouped-messages {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .request-group {
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 15px;
    background: #fafafa;
  }

  .group-header {
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 2px solid #ddd;
    font-size: 14px;
    color: #333;
  }

  .group-count {
    margin-left: 10px;
    color: #666;
    font-weight: normal;
  }

  .group-messages {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .empty-state {
    text-align: center;
    padding: 40px;
    color: #999;
    font-style: italic;
  }
</style>
