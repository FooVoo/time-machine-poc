/**
 * @fileoverview WebSocket Time Machine Web Component
 * 
 * A Svelte-based web component for capturing, filtering, and replaying WebSocket messages.
 * Designed to handle large datasets (12,000+ messages) efficiently using Web Workers.
 * 
 * @customElement websocket-time-machine
 * 
 * @example
 * <!-- Usage in HTML -->
 * <websocket-time-machine></websocket-time-machine>
 * 
 * @example
 * // Usage in Angular
 * import 'websocket-time-machine';
 * // In template:
 * <websocket-time-machine></websocket-time-machine>
 * 
 * @architecture
 * - Main thread: UI rendering + 50 visible messages (~100KB memory)
 * - Web Worker: Stores all 12K messages (~12MB isolated memory)
 * - Communication: Slice-based pagination to minimize data transfer
 */
<svelte:options customElement="websocket-time-machine" />

<script>
  import { untrack } from 'svelte';
  import { parseMessageData } from './messageUtils.js';
  
  // ============================================================================
  // CONFIGURATION CONSTANTS
  // ============================================================================
  
  /** @const {number} Maximum import file size in bytes (100MB) */
  const MAX_IMPORT_FILE_SIZE = 100 * 1024 * 1024;
  
  /** @const {number} Number of messages to validate during import */
  const VALIDATION_SAMPLE_SIZE = 100;
  
  /** @const {number} Threshold for large import warning */
  const LARGE_IMPORT_WARNING_THRESHOLD = 50000;
  
  /** @const {number} Threshold for large export warning */
  const LARGE_EXPORT_WARNING_THRESHOLD = 50000;
  
  /** @const {number} WebSocket connection timeout in milliseconds */
  const CONNECTION_TIMEOUT_MS = 10000;
  
  // ============================================================================
  // STATE: WebSocket Connection
  // ============================================================================
  
  /** @type {string} WebSocket URL to connect to */
  let wsUrl = $state('');
  
  /** @type {WebSocket|null} Active WebSocket connection */
  let ws = null;
  
  /** @type {boolean} Whether WebSocket is currently connected */
  let isConnected = $state(false);
  
  /** @type {boolean} Whether to automatically capture incoming messages */
  let autoCapture = $state(false);
  
  /** @type {string} Current status message to display to user */
  let statusMessage = $state('');
  
  /** @type {number|null} Connection timeout handle */
  let connectionTimeout = null;

  // ============================================================================
  // STATE: Filtering and Grouping
  // ============================================================================
  
  /** @type {string} Request ID to filter messages by (partial match) */
  let filterRequestId = $state('');
  
  /** @type {boolean} Whether to group messages by request ID */
  let groupByRequestId = $state(false);
  
  /** @type {string} Custom field path to filter on (e.g., 'data.status') */
  let customFilterField = $state('');
  
  /** @type {string} Value to search for in custom field (case-insensitive) */
  let customFilterValue = $state('');

  // ============================================================================
  // STATE: Pagination
  // ============================================================================
  
  /** @type {number} Current page index (0-based) */
  let currentPage = $state(0);
  
  /** @type {number} Number of messages to display per page */
  let messagesPerPage = $state(50);

  // ============================================================================
  // STATE: Message Counts (Worker holds actual messages)
  // ============================================================================
  
  /** @type {number} Total number of messages stored in worker */
  let totalMessageCount = $state(0);
  
  /** @type {number} Number of messages matching current filters */
  let filteredMessageCount = $state(0);

  // ============================================================================
  // STATE: Worker-based results (only slices, not full dataset)
  // ============================================================================
  
  /** @type {Array<Object>} Currently visible messages (one page worth) */
  let visibleMessages = $state([]);
  
  /** @type {Map<string, Array<Object>>|null} Messages grouped by request ID */
  let groupedMessages = $state(null);
  
  /** @type {Set<string>} Set of primitive (filterable) field paths */
  let primitiveFields = new Set();
  
  /** @type {Map<string, Set<string>>} Map of field paths to their unique values */
  let fieldValues = new Map();
  
  /** @type {Array<string>} All available field paths for autocomplete */
  let availableFields = $state([]);
  
  // ============================================================================
  // STATE: UI Expansion
  // ============================================================================
  
  /** @type {Set<number>} Set of expanded message indices */
  let expandedMessages = $state(new Set());
  
  /** @type {Map<number, Set<string>>} Map of message index to expanded nested paths */
  let expandedNestedPaths = $state(new Map());

  // ============================================================================
  // STATE: Web Worker
  // ============================================================================
  
  /** @type {Worker|null} Storage worker that holds all message data */
  let storageWorker = null;
  
  /** @type {boolean} Whether a worker operation is in progress */
  let isProcessing = $state(false);
  
  // ============================================================================
  // STATE: Real-time Capture
  // ============================================================================
  
  /** @type {Array<Object>} Buffer for batching real-time messages */
  let capturedMessagesBuffer = [];
  
  /** @type {number|null} Timeout ID for batch sync */
  let syncTimeout = null;

  // ============================================================================
  // WORKER INITIALIZATION
  // ============================================================================
  
  /**
   * Initializes the message storage worker and sets up message handlers
   * Creates a Web Worker that will store all messages and handle filtering/slicing.
   * The worker isolates 12MB of message data from the main UI thread.
   * 
   * @returns {void}
   */
  function initStorageWorker() {
    if (!storageWorker) {
      storageWorker = new Worker(new URL('./messageStorage.worker.js', import.meta.url), { type: 'module' });
      
      storageWorker.onmessage = (event) => {
        const { success, action, slice, totalCount, filteredCount, grouped, fields, primitiveFields: primFields, fieldValues: fValues, messages: exportedMessages } = event.data;
        
        if (success) {
          switch (action) {
            case 'setMessages':
              totalMessageCount = totalCount;
              filteredMessageCount = filteredCount;
              isProcessing = false;
              // Request field extraction after setting messages
              storageWorker.postMessage({ action: 'extractFields' });
              // Request first slice
              requestSlice();
              break;
              
            case 'appendMessages':
              // Update counts after appending messages
              totalMessageCount = totalCount;
              filteredMessageCount = filteredCount;
              // Refresh current slice if on last page
              if (currentPage === totalPages - 1) {
                requestSlice();
              }
              break;
              
            case 'filter':
              filteredMessageCount = filteredCount;
              currentPage = 0; // Reset to first page
              isProcessing = false;
              // Request new slice after filtering
              requestSlice();
              break;
              
            case 'getSlice':
              visibleMessages = slice;
              totalMessageCount = totalCount;
              filteredMessageCount = filteredCount;
              isProcessing = false;
              break;
              
            case 'group':
              groupedMessages = new Map(grouped);
              isProcessing = false;
              break;
              
            case 'extractFields':
              availableFields = fields;
              primitiveFields = new Set(primFields);
              fieldValues = new Map(fValues.map(([key, values]) => [key, new Set(values)]));
              break;
              
            case 'export':
              // Handle export - download the messages
              const dataStr = JSON.stringify(exportedMessages, null, 2);
              const dataBlob = new Blob([dataStr], { type: 'application/json' });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `websocket-messages-${Date.now()}.json`;
              link.click();
              URL.revokeObjectURL(url);
              statusMessage = 'Сообщения экспортированы';
              isProcessing = false;
              break;
              
            case 'clear':
              totalMessageCount = 0;
              filteredMessageCount = 0;
              visibleMessages = [];
              currentPage = 0;
              isProcessing = false;
              break;
              
            default:
              console.warn('Unknown action:', action);
          }
        } else {
          console.error('Worker error:', event.data.error);
          isProcessing = false;
        }
      };
      
      storageWorker.onerror = (error) => {
        console.error('Storage worker error:', error);
        isProcessing = false;
      };
    }
  }

  // ============================================================================
  // PAGINATION
  // ============================================================================
  
  /**
   * Requests a slice of messages from the worker for the current page
   * Only transfers 50 messages at a time to minimize main thread memory usage.
   * 
   * @returns {void}
   */
  function requestSlice() {
    if (!storageWorker) return;
    
    const start = currentPage * messagesPerPage;
    const end = start + messagesPerPage;
    
    storageWorker.postMessage({
      action: 'getSlice',
      data: { start, end }
    });
  }

  // ============================================================================
  // REACTIVE EFFECTS
  // ============================================================================
  
  /**
   * Reactively applies filters when filter values change
   * Automatically triggered by Svelte 5's $effect when any filter state changes.
   * Resets to first page and requests new filtered slice from worker.
   * 
   * Note: Uses untrack to prevent infinite loops when worker updates counts
   */
  $effect(() => {
    // Track only the filter inputs, not the counts
    const reqId = filterRequestId;
    const field = customFilterField;
    const value = customFilterValue;
    
    untrack(() => {
      if (storageWorker && totalMessageCount > 0) {
        isProcessing = true;
        
        storageWorker.postMessage({
          action: 'filter',
          data: {
            filterRequestId: reqId,
            customFilterField: field,
            customFilterValue: value
          }
        });
      }
    });
  });

  /**
   * Reactively triggers message grouping by request ID when enabled
   * Groups filtered messages for better visualization of request/response pairs.
   * 
   * Note: Uses untrack to prevent infinite loops when worker updates
   */
  $effect(() => {
    const shouldGroup = groupByRequestId;
    const hasMessages = filteredMessageCount > 0;
    
    untrack(() => {
      if (shouldGroup && storageWorker && hasMessages) {
        isProcessing = true;
        
        storageWorker.postMessage({
          action: 'group',
          data: {}
        });
      } else {
        groupedMessages = null;
      }
    });
  });

  /**
   * Requests new message slice when page changes
   * Automatically triggered when currentPage or messagesPerPage changes.
   * 
   * Note: Uses untrack to prevent infinite loops from filteredMessageCount updates
   */
  $effect(() => {
    // Track only the page navigation, not the message counts
    const page = currentPage;
    const perPage = messagesPerPage;
    
    untrack(() => {
      if (storageWorker && filteredMessageCount > 0) {
        requestSlice();
      }
    });
  });

  /**
   * Cleanup effect - terminates worker on component unmount
   * Ensures proper resource cleanup to prevent memory leaks.
   */
  $effect(() => {
    return () => {
      if (storageWorker) {
        storageWorker.terminate();
        storageWorker = null;
      }
    };
  });

  // ============================================================================
  // DERIVED STATE
  // ============================================================================
  
  /** @type {boolean} Whether the current custom filter field is filterable (primitive type) */
  let fieldIsFilterable = $derived(primitiveFields.has(customFilterField));
  
  /** @type {Array<string>} Sorted array of unique values for the current filter field */
  let availableValues = $derived.by(() => {
    if (!fieldIsFilterable) return [];
    if (!fieldValues.has(customFilterField)) return [];
    return Array.from(fieldValues.get(customFilterField)).sort();
  });

  /** @type {number} Total number of pages based on filtered message count */
  let totalPages = $derived(Math.ceil(filteredMessageCount / messagesPerPage));

  /** @type {number} Start index for current page */
  let startIndex = $derived(currentPage * messagesPerPage);

  // ============================================================================
  // LOCALIZATION (Russian)
  // ============================================================================
  
  /**
   * @typedef {Object} RussianPluralForms
   * @property {string} one - Form for 1, 21, 31, etc.
   * @property {string} few - Form for 2-4, 22-24, etc.
   * @property {string} many - Form for 0, 5-20, 25-30, etc.
   */
  
  /** @type {{messages: RussianPluralForms}} Russian pluralization constants */
  const RUSSIAN_PLURAL_FORMS = {
    messages: {
      one: 'сообщение',    // 1, 21, 31, ...
      few: 'сообщения',    // 2-4, 22-24, 32-34, ...
      many: 'сообщений'    // 0, 5-20, 25-30, ...
    }
  };

  /**
   * Returns the correct Russian plural form based on count.
   * Russian has three plural forms:
   * - one: for numbers ending in 1 (except 11): 1, 21, 31, ...
   * - few: for numbers ending in 2-4 (except 12-14): 2-4, 22-24, 32-34, ...
   * - many: for all other cases: 0, 5-20, 25-30, ...
   *
   * @param {number} count - The number to check
   * @param {string} one - Form for 1, 21, 31, ... (e.g., "сообщение")
   * @param {string} few - Form for 2-4, 22-24, ... (e.g., "сообщения")
   * @param {string} many - Form for 0, 5-20, 25-30, ... (e.g., "сообщений")
   * @returns {string} The correct plural form
   * @example
   * pluralizeRussian(1, 'день', 'дня', 'дней')   // returns 'день'
   * pluralizeRussian(2, 'день', 'дня', 'дней')   // returns 'дня'
   * pluralizeRussian(5, 'день', 'дня', 'дней')   // returns 'дней'
   * pluralizeRussian(21, 'день', 'дня', 'дней')  // returns 'день'
   */
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

  /**
   * Helper function for message pluralization
   * @param {number} count - Number of messages
   * @returns {string} Correctly pluralized message word in Russian
   */
  function getMessageWord(count) {
    return pluralizeRussian(
      count,
      RUSSIAN_PLURAL_FORMS.messages.one,
      RUSSIAN_PLURAL_FORMS.messages.few,
      RUSSIAN_PLURAL_FORMS.messages.many
    );
  }

  // ============================================================================
  // UI INTERACTION HELPERS
  // ============================================================================
  
  /**
   * Toggles message expansion state for detailed view
   * When expanded, shows full message content including nested objects.
   * When collapsed, clears nested path expansions for memory efficiency.
   * 
   * @param {number} index - Index of the message to toggle
   * @returns {void}
   */
  function toggleMessageExpansion(index) {
    if (expandedMessages.has(index)) {
      expandedMessages.delete(index);
      // Clear nested expansions for this message
      expandedNestedPaths.delete(index);
    } else {
      expandedMessages.add(index);
      // Initialize nested paths map for this message
      if (!expandedNestedPaths.has(index)) {
        expandedNestedPaths.set(index, new Set());
      }
    }
    expandedMessages = expandedMessages;
    expandedNestedPaths = expandedNestedPaths;
  }

  /**
   * Toggles expansion of a nested object path within a message
   * Allows drilling down into nested data structures for inspection.
   * 
   * @param {number} messageIndex - Index of the containing message
   * @param {string} path - Dot-notation path to the nested object (e.g., 'user.profile')
   * @returns {void}
   */
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

  /**
   * Checks if a nested path is currently expanded
   * @param {number} messageIndex - Index of the containing message
   * @param {string} path - Dot-notation path to check
   * @returns {boolean} True if the path is expanded
   */
  function isNestedPathExpanded(messageIndex, path) {
    return expandedNestedPaths.get(messageIndex)?.has(path) || false;
  }

  // ============================================================================
  // VALUE FORMATTING HELPERS
  // ============================================================================
  
  /**
   * Formats a value for display handling different types
   * @param {*} value - Value to format
   * @returns {string} Formatted string representation
   */
  function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value, null, 2);
  }

  /**
   * Gets the type of a value for display
   * @param {*} value - Value to check
   * @returns {string} Type string ('null', 'undefined', 'array', 'string', 'number', etc.)
   */
  function getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Gets a preview string for complex values (arrays, objects)
   * Shows count information without expanding full structure.
   * 
   * @param {*} value - Value to preview
   * @returns {string} Preview string (e.g., 'Array(5)', 'Object {3 properties}')
   */
  function getValuePreview(value) {
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      return `Object {${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`;
    }
    return formatValue(value);
  }

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================
  
  /**
   * Establishes WebSocket connection and sets up message handlers
   * Captures incoming messages if autoCapture is enabled, batching them
   * for efficient worker sync (10 messages or 100ms intervals).
   * 
   * GUARDRAILS:
   * - Validates WebSocket URL format (ws:// or wss://)
   * - Prevents multiple connections to same URL
   * - 10-second connection timeout
   * - Validates connection state before operations
   * 
   * @returns {void}
   */
  function connect() {
    // GUARDRAIL: Validate URL format
    if (!wsUrl) {
      statusMessage = 'Ошибка: Введите URL WebSocket';
      return;
    }
    
    try {
      const url = new URL(wsUrl);
      if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
        statusMessage = 'Ошибка: URL должен начинаться с ws:// или wss://';
        return;
      }
    } catch (error) {
      statusMessage = 'Ошибка: Неверный формат URL';
      return;
    }
    
    // GUARDRAIL: Prevent multiple connections
    if (isConnected && ws) {
      statusMessage = `Уже подключено к ${wsUrl}. Отключитесь сначала.`;
      return;
    }
    
    try {
      statusMessage = 'Подключение...';
      ws = new WebSocket(wsUrl);
      
      // GUARDRAIL: Connection timeout (10 seconds)
      connectionTimeout = setTimeout(() => {
        if (!isConnected && ws) {
          ws.close();
          ws = null;
          statusMessage = 'Таймаут подключения (10с). Проверьте URL и сеть.';
        }
      }, CONNECTION_TIMEOUT_MS);

      ws.onopen = () => {
        // Clear timeout on successful connection
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        
        isConnected = true;
        statusMessage = 'Подключено к ' + wsUrl;
        
        // Initialize storage worker for capture if auto-capture is enabled
        if (autoCapture && !storageWorker) {
          initStorageWorker();
        }
      };

      ws.onmessage = (event) => {
        // GUARDRAIL: Only capture if auto-capture enabled and worker ready
        if (!autoCapture) {
          return; // Silently ignore if not capturing
        }
        
        if (!storageWorker) {
          console.warn('Storage worker not initialized. Message not captured.');
          return;
        }
        
        const message = {
          timestamp: new Date().toISOString(),
          type: 'received',
          data: event.data
        };
        
        // Track if user is on last page for auto-scroll
        const wasOnLastPage = currentPage === totalPages - 1 || totalMessageCount === 0;
        
        // Buffer messages for batch sync with worker
        capturedMessagesBuffer.push(message);
        
        // Sync with worker every 10 messages or after 100ms delay
        if (capturedMessagesBuffer.length >= 10) {
          syncCapturedMessages(wasOnLastPage);
        } else if (!syncTimeout) {
          syncTimeout = setTimeout(() => {
            syncCapturedMessages(wasOnLastPage);
          }, 100);
        }
      };

      ws.onerror = (error) => {
        // Clear timeout on error
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        isConnected = false;
        statusMessage = 'Ошибка WebSocket соединения';
      };

      ws.onclose = () => {
        // Clear timeout on close
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        
        isConnected = false;
        statusMessage = 'Отключено';
        // Sync any remaining buffered messages
        if (capturedMessagesBuffer.length > 0) {
          syncCapturedMessages(false);
        }
      };
    } catch (error) {
      // Clear timeout on exception
      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }
      statusMessage = 'Ошибка подключения: ' + error.message;
    }
  }

  /**
   * Syncs captured messages to worker in batches
   * Called either when buffer reaches 10 messages or after 100ms timeout.
   * Prevents blocking main thread during high-frequency message capture.
   * 
   * @param {boolean} wasOnLastPage - Whether user was viewing the last page
   * @returns {void}
   */
  function syncCapturedMessages(wasOnLastPage) {
    if (capturedMessagesBuffer.length === 0 || !storageWorker) return;
    
    const messagesToSync = [...capturedMessagesBuffer];
    capturedMessagesBuffer = [];
    
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    
    // Send to worker
    storageWorker.postMessage({
      action: 'appendMessages',
      data: { messages: messagesToSync }
    });
    
    // Note: Don't calculate page here - wait for worker response with updated count
    // The worker will call appendMessages handler which updates totalMessageCount
  }

  /**
   * Disconnects WebSocket and cleans up resources
   * Ensures any pending message syncs and timeouts are cancelled.
   * 
   * @returns {void}
   */
  function disconnect() {
    if (ws) {
      ws.close();
      ws = null;
      isConnected = false;
    }
    // Clean up any pending sync
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    // Clean up connection timeout
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================
  
  /**
   * Clears all messages from storage
   * Shows confirmation dialog before destructive action.
   * 
   * GUARDRAIL: Requires user confirmation with message count
   * 
   * @returns {void}
   */
  function clearMessages() {
    // GUARDRAIL: Confirm before destructive action
    if (totalMessageCount > 0) {
      const confirmed = confirm(`Удалить все ${totalMessageCount} ${getMessageWord(totalMessageCount)}? Это действие нельзя отменить.`);
      if (!confirmed) {
        return;
      }
    }
    
    if (!storageWorker) {
      initStorageWorker();
    }
    
    storageWorker.postMessage({ action: 'clear' });
    currentPage = 0;
    filterRequestId = '';
    statusMessage = 'Сообщения очищены';
  }

  /**
   * Exports all messages to a JSON file
   * Requests all messages from worker and triggers browser download.
   * 
   * GUARDRAILS:
   * - Warns for large exports (>50K messages)
   * - Shows size estimation
   * - Requires confirmation for large datasets
   * 
   * @returns {void}
   */
  function exportMessages() {
    if (!storageWorker) return;
    
    // GUARDRAIL: Warn for large exports
    if (totalMessageCount > LARGE_EXPORT_WARNING_THRESHOLD) {
      const estimatedSizeMB = Math.round(totalMessageCount / 1000); // ~1KB per message
      const confirmed = confirm(
        `Экспортировать ${totalMessageCount} ${getMessageWord(totalMessageCount)} (~${estimatedSizeMB}MB)? ` +
        `Это может занять время. Рассмотрите фильтрацию для уменьшения размера. Продолжить?`
      );
      if (!confirmed) {
        return;
      }
    }
    
    isProcessing = true;
    storageWorker.postMessage({
      action: 'export',
      data: { filtered: false } // Export all messages
    });
  }

  /**
   * Handles file import for message history
   * Uses jsonParser worker to parse large files without blocking UI.
   * Then stores parsed messages in storage worker.
   * 
   * GUARDRAILS:
   * - Maximum file size: 100MB
   * - Validates JSON structure and required fields
   * - Warns if overwriting existing data
   * - Warns for very large imports (>50K messages)
   * - Validates first N messages for corruption detection
   * 
   * @param {Event} event - File input change event
   * @returns {void}
   */
  function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // GUARDRAIL: File size limit
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      const fileSizeMB = Math.round(file.size / (1024 * 1024));
      const maxSizeMB = Math.round(MAX_IMPORT_FILE_SIZE / (1024 * 1024));
      statusMessage = `Ошибка: Файл слишком большой (${fileSizeMB}MB). Максимум ${maxSizeMB}MB. Попробуйте фильтрацию перед экспортом.`;
      event.target.value = ''; // Reset file input
      return;
    }
    
    // GUARDRAIL: Warn if overwriting existing data
    if (totalMessageCount > 0) {
      const confirmed = confirm(
        `Импорт заменит существующие ${totalMessageCount} ${getMessageWord(totalMessageCount)}. ` +
        `Экспортируйте их сначала при необходимости. Продолжить?`
      );
      if (!confirmed) {
        event.target.value = ''; // Reset file input
        return;
      }
    }
    
    statusMessage = 'Импорт...';
    const startTime = performance.now();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const fileContent = typeof e.target.result === 'string' 
        ? e.target.result 
        : new TextDecoder().decode(e.target.result);
      
      // Create a new Web Worker for parsing JSON
      const worker = new Worker(new URL('./jsonParser.worker.js', import.meta.url), { type: 'module' });
      
      // Handle messages from the worker
      worker.onmessage = (workerEvent) => {
        const { success, data, error } = workerEvent.data;
        
        if (success) {
          // GUARDRAIL: Validate structure
          if (!Array.isArray(data)) {
            statusMessage = 'Ошибка импорта: Файл должен содержать массив сообщений';
            event.target.value = '';
            worker.terminate();
            return;
          }
          
          // GUARDRAIL: Validate message structure (first 100 messages)
          const samplesToValidate = Math.min(data.length, VALIDATION_SAMPLE_SIZE);
          for (let i = 0; i < samplesToValidate; i++) {
            const msg = data[i];
            if (!msg || typeof msg !== 'object') {
              statusMessage = `Ошибка: Сообщение ${i}: не является объектом`;
              event.target.value = '';
              worker.terminate();
              return;
            }
            if (!msg.timestamp || !msg.type || !msg.data) {
              const missing = [];
              if (!msg.timestamp) missing.push('timestamp');
              if (!msg.type) missing.push('type');
              if (!msg.data) missing.push('data');
              statusMessage = `Ошибка: Сообщение ${i}: отсутствуют поля: ${missing.join(', ')}`;
              event.target.value = '';
              worker.terminate();
              return;
            }
            if (msg.type !== 'sent' && msg.type !== 'received') {
              statusMessage = `Ошибка: Сообщение ${i}: type должен быть 'sent' или 'received'`;
              event.target.value = '';
              worker.terminate();
              return;
            }
          }
          
          // GUARDRAIL: Warn for very large imports
          if (data.length > LARGE_IMPORT_WARNING_THRESHOLD) {
            const confirmed = confirm(
              `Импортировать ${data.length} ${getMessageWord(data.length)}? ` +
              `Это может замедлить интерфейс. Продолжить?`
            );
            if (!confirmed) {
              event.target.value = '';
              worker.terminate();
              return;
            }
          }
          
          // Initialize storage worker if needed
          if (!storageWorker) {
            initStorageWorker();
          }
          
          // Send parsed messages to storage worker
          isProcessing = true;
          storageWorker.postMessage({
            action: 'setMessages',
            data: { messages: data }
          });
          
          currentPage = 0;
          const loadTime = ((performance.now() - startTime) / 1000).toFixed(1);
          statusMessage = `Импортировано ${data.length} ${getMessageWord(data.length)} за ${loadTime}с`;
        } else {
          statusMessage = `Ошибка импорта: ${error || 'Некорректный JSON'}`;
        }
        
        // Reset file input and terminate worker
        event.target.value = '';
        worker.terminate();
      };
      
      // Handle worker errors
      worker.onerror = (error) => {
        statusMessage = 'Ошибка импорта: Некорректный JSON';
        event.target.value = '';
        worker.terminate();
      };
      
      // Send the file content to the worker for parsing
      worker.postMessage({ fileContent });
    };
    
    reader.onerror = () => {
      statusMessage = 'Ошибка чтения файла';
      event.target.value = '';
    };
    
    reader.readAsText(file);
  }

  // ============================================================================
  // PAGINATION CONTROLS
  // ============================================================================
  
  /**
   * Navigates to a specific page
   * @param {number} page - Target page index (0-based)
   * @returns {void}
   */
  function goToPage(page) {
    if (page >= 0 && page < totalPages) {
      currentPage = page;
    }
  }

  /**
   * Navigates to the next page
   * @returns {void}
   */
  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
    }
  }

  /**
   * Navigates to the previous page
   * @returns {void}
   */
  function prevPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  /**
   * Navigates to the last page
   * @returns {void}
   */
  function goToLastPage() {
    currentPage = Math.max(0, totalPages - 1);
  }
</script>

{#snippet nestedDataViewer(data, messageIndex, path = '')}
  <div class="nested-data">
    {#if Array.isArray(data)}
      {#each data as item, index}
        {@const itemPath = `${path}[${index}]`}
        {@const itemType = getValueType(item)}
        {@const isComplex = itemType === 'object' || itemType === 'array'}
        {@const isExpanded = isNestedPathExpanded(messageIndex, itemPath)}
        
        <div class="nested-item">
          <div class="nested-key">
            {#if isComplex}
              <button 
                class="nested-toggle" 
                onclick={() => toggleNestedPath(messageIndex, itemPath)}
                title={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            {:else}
              <span class="nested-no-toggle"></span>
            {/if}
            <span class="nested-index">[{index}]:</span>
            {#if !isExpanded && isComplex}
              <span class="nested-preview">{getValuePreview(item)}</span>
            {/if}
          </div>
          {#if isExpanded && isComplex}
            <div class="nested-children">
              {@render nestedDataViewer(item, messageIndex, itemPath)}
            </div>
          {:else if !isComplex}
            <span class="nested-value nested-value-{itemType}">{formatValue(item)}</span>
          {/if}
        </div>
      {/each}
    {:else if typeof data === 'object' && data !== null}
      {#each Object.entries(data) as [key, value]}
        {@const itemPath = path ? `${path}.${key}` : key}
        {@const itemType = getValueType(value)}
        {@const isComplex = itemType === 'object' || itemType === 'array'}
        {@const isExpanded = isNestedPathExpanded(messageIndex, itemPath)}
        
        <div class="nested-item">
          <div class="nested-key">
            {#if isComplex}
              <button 
                class="nested-toggle" 
                onclick={() => toggleNestedPath(messageIndex, itemPath)}
                title={isExpanded ? 'Свернуть' : 'Развернуть'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            {:else}
              <span class="nested-no-toggle"></span>
            {/if}
            <span class="nested-property">{key}:</span>
            {#if !isExpanded && isComplex}
              <span class="nested-preview">{getValuePreview(value)}</span>
            {/if}
          </div>
          {#if isExpanded && isComplex}
            <div class="nested-children">
              {@render nestedDataViewer(value, messageIndex, itemPath)}
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
{/snippet}

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
        <button class="btn btn-danger" onclick={disconnect}>Отключить</button>
      {:else}
        <button class="btn btn-primary" onclick={connect}>Подключить</button>
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
        <div class="input-group">
          <label for="custom-field">Поле:</label>
          <input
            id="custom-field"
            type="text"
            bind:value={customFilterField}
            list="field-suggestions"
            placeholder="напр. data.userId, type, timestamp"
            autocomplete="off"
          />
          <datalist id="field-suggestions">
            {#each availableFields as field}
              <option value={field}></option>
            {/each}
          </datalist>
        </div>
        <div class="input-group">
          <label for="custom-value">Значение:</label>
          <input
            id="custom-value"
            type="text"
            bind:value={customFilterValue}
            list={fieldIsFilterable ? "value-suggestions" : null}
            placeholder="Введите значение для поиска"
            disabled={!fieldIsFilterable}
            title={fieldIsFilterable ? "Выберите значение из списка" : "Выберите поле с примитивными значениями"}
          />
          {#if fieldIsFilterable}
            <datalist id="value-suggestions">
              {#each availableValues as value}
                <option value={value}></option>
              {/each}
            </datalist>
          {/if}
        </div>
      </div>
    </div>

    <label class="checkbox-label">
      <input type="checkbox" bind:checked={groupByRequestId} />
      Группировать по ID запроса
    </label>
  </div>

  <div class="actions-panel">
    <button class="btn btn-success" onclick={exportMessages} disabled={totalMessageCount === 0}>
      Экспортировать сообщения ({totalMessageCount})
    </button>

    <label class="btn btn-info file-label">
      Импортировать сообщения
      <input
        type="file"
        accept=".json"
        onchange={handleImport}
        style="display: none;"
      />
    </label>

    <button class="btn btn-warning" onclick={clearMessages} disabled={totalMessageCount === 0}>
      Очистить сообщения
    </button>
  </div>

  <div class="messages-panel">
    <h2>Захваченные сообщения ({filteredMessageCount}{filterRequestId ? ` из ${totalMessageCount}` : ''})</h2>

    {#if groupByRequestId && groupedMessages}
      <!-- Grouped view by Request ID -->
      <div class="grouped-messages">
        {#each [...groupedMessages.entries()] as [requestId, msgs]}
          <div class="request-group">
            <div class="group-header">
              <strong>ID запроса:</strong> {requestId}
              <span class="group-count">({msgs.length} {getMessageWord(msgs.length)})</span>
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
                      onclick={() => toggleMessageExpansion(globalIndex)}
                      title={isExpanded ? 'Свернуть' : 'Развернуть JSON'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  </div>

                  {#if isExpanded && parsedData}
                    <div class="json-viewer">
                      {@render nestedDataViewer(parsedData, globalIndex)}
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
      {#if !groupByRequestId && filteredMessageCount > messagesPerPage}
        <div class="pagination-controls">
          <button class="btn btn-sm" onclick={prevPage} disabled={currentPage === 0}>
            Предыдущая
          </button>
          <span class="page-info">
            Страница {currentPage + 1} из {totalPages}
            (показано {startIndex + 1}-{Math.min(startIndex + messagesPerPage, filteredMessageCount)} из {filteredMessageCount})
          </span>
          <button class="btn btn-sm" onclick={nextPage} disabled={currentPage === totalPages - 1}>
            Следующая
          </button>
          <button class="btn btn-sm" onclick={goToLastPage}>
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
                onclick={() => toggleMessageExpansion(globalIndex)}
                title={isExpanded ? 'Свернуть' : 'Развернуть JSON'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            </div>

            {#if isExpanded && parsedData}
              <div class="json-viewer">
                {@render nestedDataViewer(parsedData, globalIndex)}
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

  /* Nested Data Viewer Styles */
  .nested-data {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    padding: 8px;
  }

  .nested-item {
    display: flex;
    flex-direction: column;
    margin-left: 0;
  }

  .nested-key {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
  }

  .nested-toggle {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    flex-shrink: 0;
  }

  .nested-toggle:hover {
    color: #333;
    background: #f0f0f0;
    border-radius: 2px;
  }

  .nested-no-toggle {
    width: 16px;
    height: 16px;
    display: inline-block;
    flex-shrink: 0;
  }

  .nested-property {
    color: #881391;
    font-weight: 500;
  }

  .nested-index {
    color: #1976d2;
    font-weight: 500;
  }

  .nested-preview {
    color: #666;
    font-style: italic;
    margin-left: 4px;
  }

  .nested-value {
    margin-left: 4px;
    word-break: break-word;
  }

  .nested-value-string {
    color: #c41a16;
  }

  .nested-value-number {
    color: #1976d2;
  }

  .nested-value-boolean {
    color: #0d47a1;
    font-weight: 500;
  }

  .nested-value-null {
    color: #999;
    font-style: italic;
  }

  .nested-value-undefined {
    color: #999;
    font-style: italic;
  }

  .nested-children {
    margin-left: 20px;
    border-left: 1px solid #e0e0e0;
    padding-left: 8px;
  }
</style>
