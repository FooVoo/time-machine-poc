/**
 * @fileoverview Web Worker for storing and managing message data
 * This worker holds the complete message dataset (12,000+ messages) and serves
 * paginated slices to the main app, minimizing main thread memory usage.
 * 
 * Architecture:
 * - Worker stores ALL messages (12MB in memory, isolated from UI thread)
 * - Main app only receives 50-message slices per page
 * - Filtering operations return counts, not full datasets
 * - 99.6% memory reduction in main thread
 */

/**
 * @typedef {Object} Message
 * @property {string} timestamp - ISO 8601 timestamp
 * @property {'sent'|'received'} type - Message direction
 * @property {string} data - JSON string or object containing message data
 */

/**
 * @typedef {Object} WorkerRequest
 * @property {string} action - Action to perform
 * @property {Object} [data] - Action-specific data
 */

/**
 * @typedef {Object} WorkerResponse
 * @property {boolean} success - Whether the operation succeeded
 * @property {string} action - The action that was performed
 * @property {*} [result] - Action-specific result data
 * @property {string} [error] - Error message if success is false
 */

/** @type {Array<Message>} Complete message dataset stored in worker */
let messages = [];

/** @type {Array<number>} Indices of filtered messages */
let filteredIndices = [];

/** @type {Array<[string, Array<Message>]>|null} Grouped message data */
let groupedData = null;

// Helper functions
import { parseMessageData } from './messageUtils.js';

/**
 * Gets a nested value from an object using dot notation path
 * @param {Object} obj - The object to traverse
 * @param {string} path - Dot-separated path (e.g., 'user.profile.name')
 * @returns {*} The value at the path, or undefined if not found
 * @example
 * getNestedValue({user: {name: 'John'}}, 'user.name') // returns 'John'
 */
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

/**
 * Filters messages by request ID - optimized to single pass
 * @param {string} filterRequestId - The request ID to filter by (partial match)
 * @returns {Array<number>} Array of message indices that match the filter
 * @example
 * filterByRequestId('req-123') // returns [0, 5, 12] (indices of matching messages)
 */
function filterByRequestId(filterRequestId) {
  if (!filterRequestId) {
    return Array.from({ length: messages.length }, (_, i) => i);
  }

  const indices = [];
  for (let i = 0; i < messages.length; i++) {
    const data = parseMessageData(messages[i]);
    if (data?.requestId?.includes(filterRequestId)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Filters messages by custom field - optimized with early returns
 * @param {Array<number>} indices - Array of message indices to filter
 * @param {string} customFilterField - Field path to filter on (e.g., 'data.status')
 * @param {string} customFilterValue - Value to search for (case-insensitive partial match)
 * @returns {Array<number>} Filtered array of message indices
 * @example
 * filterByCustomField([0,1,2], 'data.status', 'success') // returns [0, 2]
 */
function filterByCustomField(indices, customFilterField, customFilterValue) {
  if (!customFilterField || !customFilterValue) {
    return indices;
  }

  const filterStr = customFilterValue.toLowerCase();
  const isDataField = customFilterField.startsWith('data.');
  const fieldPath = isDataField ? customFilterField.substring(5) : null;

  return indices.filter(index => {
    const msg = messages[index];
    let value;

    if (isDataField) {
      const data = parseMessageData(msg);
      if (!data) return false;
      value = getNestedValue(data, fieldPath);
    } else {
      value = msg[customFilterField];
    }

    if (value === undefined || value === null) return false;

    const valueStr = String(value).toLowerCase();
    return valueStr.includes(filterStr);
  });
}

/**
 * Recursively extracts all field paths from an object
 * @param {Object} obj - The object to extract paths from
 * @param {string} [prefix=''] - Current path prefix for nested objects
 * @param {Set<string>} primFields - Set to collect primitive field paths
 * @param {Map<string, Set<string>>} valuesMap - Map of field paths to their unique values
 * @returns {Array<string>} Array of all field paths found
 * @private
 */
function extractFieldPaths(obj, prefix = '', primFields, valuesMap) {
  const paths = [];

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      paths.push(path);

      const isPrimitive = value === null ||
                        typeof value === 'string' ||
                        typeof value === 'number' ||
                        typeof value === 'boolean';

      if (isPrimitive) {
        primFields.add(path);
        if (!valuesMap.has(path)) {
          valuesMap.set(path, new Set());
        }
        if (value !== null) {
          valuesMap.get(path).add(String(value));
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        paths.push(...extractFieldPaths(value, path, primFields, valuesMap));
      }
    }
  }

  return paths;
}

/**
 * Gets all available field paths from all messages
 * Analyzes message structure to provide autocomplete options
 * @returns {Object} Field analysis result
 * @returns {Array<string>} result.fields - Sorted array of all field paths
 * @returns {Array<string>} result.primitiveFields - Array of primitive field paths (filterable)
 * @returns {Array<[string, Array<string>]>} result.fieldValues - Map of fields to their unique values
 */
function getAllFieldPaths() {
  const fieldsSet = new Set();
  const primFields = new Set();
  const valuesMap = new Map();

  for (const msg of messages) {
    fieldsSet.add('type');
    fieldsSet.add('timestamp');
    primFields.add('type');
    primFields.add('timestamp');

    if (!valuesMap.has('type')) valuesMap.set('type', new Set());
    if (!valuesMap.has('timestamp')) valuesMap.set('timestamp', new Set());
    valuesMap.get('type').add(String(msg.type));
    valuesMap.get('timestamp').add(String(msg.timestamp));

    const data = parseMessageData(msg);
    if (data) {
      const dataPaths = extractFieldPaths(data, 'data', primFields, valuesMap);
      dataPaths.forEach(path => fieldsSet.add(path));
    }
  }

  return {
    fields: Array.from(fieldsSet).sort(),
    primitiveFields: Array.from(primFields),
    fieldValues: Array.from(valuesMap.entries()).map(([key, values]) => [key, Array.from(values)])
  };
}

/**
 * Groups messages by their request ID
 * Supports 1:N request-response relationships (one request → multiple responses)
 * Messages are kept in chronological order within each group.
 * 
 * @param {Array<number>} indices - Array of message indices to group
 * @returns {Array<[string, Array<Message>]>} Array of [requestId, messages] tuples sorted by first message timestamp
 * @example
 * // One request with multiple responses
 * groupMessagesByRequestId([0,1,2,3]) 
 * // returns [
 * //   ['req-1', [
 * //     {type: 'sent', data: '{requestId: "req-1"}'},
 * //     {type: 'received', data: '{requestId: "req-1", status: "processing"}'},
 * //     {type: 'received', data: '{requestId: "req-1", progress: 50}'},
 * //     {type: 'received', data: '{requestId: "req-1", status: "complete"}'}
 * //   ]]
 * // ]
 */
function groupMessagesByRequestId(indices) {
  const groups = new Map();
  const groupFirstTimestamp = new Map(); // Track first message timestamp for sorting

  for (const index of indices) {
    const msg = messages[index];
    const data = parseMessageData(msg);
    const requestId = data?.requestId;

    if (requestId) {
      if (!groups.has(requestId)) {
        groups.set(requestId, []);
        groupFirstTimestamp.set(requestId, msg.timestamp);
      }
      // Add message to group (maintains chronological order since indices are sequential)
      groups.get(requestId).push(msg);
    }
  }

  // Convert to array and sort by first message timestamp for consistent display
  const groupsArray = Array.from(groups.entries());
  groupsArray.sort((a, b) => {
    const timeA = groupFirstTimestamp.get(a[0]);
    const timeB = groupFirstTimestamp.get(b[0]);
    return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
  });

  return groupsArray;
}

/**
 * Handles incoming messages from the main thread
 * Processes various actions for message management:
 * - setMessages: Store initial message dataset
 * - appendMessages: Add new messages from real-time capture
 * - filter: Apply filters and return count
 * - getSlice: Return paginated slice of messages
 * - group: Group messages by request ID
 * - extractFields: Analyze message structure
 * - export: Serialize messages for download
 * - clear: Reset all data
 * 
 * @param {MessageEvent<WorkerRequest>} e - Message event with action and data
 */
self.onmessage = function(e) {
  const { action, data: actionData } = e.data;
  
  try {
    let result;
    
    switch (action) {
      case 'setMessages':
        // Store the complete message dataset
        messages = actionData.messages;
        filteredIndices = Array.from({ length: messages.length }, (_, i) => i);
        result = { 
          totalCount: messages.length,
          filteredCount: filteredIndices.length
        };
        break;
        
      case 'appendMessages':
        // Append new messages (for real-time capture)
        const startIndex = messages.length;
        messages.push(...actionData.messages);
        
        // Check if we need to update filtered indices
        // If filteredIndices equals total message count (no filter), append new indices
        const noFilterActive = filteredIndices.length === startIndex;
        if (noFilterActive) {
          // No filter active, add new message indices
          const newIndices = Array.from({ length: actionData.messages.length }, (_, i) => startIndex + i);
          filteredIndices.push(...newIndices);
        }
        // If filter is active, the new messages won't appear until user re-applies filter
        
        result = { 
          totalCount: messages.length,
          filteredCount: filteredIndices.length
        };
        break;
        
      case 'filter':
        // Apply filters and store filtered indices
        // Start with all indices or filtered by request ID
        let indices = filterByRequestId(actionData.filterRequestId);
        
        // Apply custom field filter if provided
        indices = filterByCustomField(indices, actionData.customFilterField, actionData.customFilterValue);
        
        filteredIndices = indices;
        result = { 
          filteredCount: filteredIndices.length
        };
        break;
        
      case 'getSlice':
        // Return a slice of filtered messages for display
        const { start, end } = actionData;
        const sliceIndices = filteredIndices.slice(start, end);
        const slice = sliceIndices.map(index => messages[index]);
        
        result = { 
          slice,
          totalCount: messages.length,
          filteredCount: filteredIndices.length
        };
        break;
        
      case 'group':
        // Group filtered messages by request ID
        groupedData = groupMessagesByRequestId(filteredIndices);
        result = { 
          grouped: groupedData
        };
        break;
        
      case 'extractFields':
        // Extract all field paths
        result = getAllFieldPaths();
        break;
        
      case 'export':
        // Export filtered messages
        const exportIndices = actionData.filtered ? filteredIndices : Array.from({ length: messages.length }, (_, i) => i);
        const exportMessages = exportIndices.map(index => messages[index]);
        result = { 
          messages: exportMessages
        };
        break;
        
      case 'clear':
        // Clear all messages
        messages = [];
        filteredIndices = [];
        groupedData = null;
        result = { success: true };
        break;
        
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    // Send the result back to the main thread
    self.postMessage({
      success: true,
      action,
      ...result
    });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({
      success: false,
      action,
      error: error.message
    });
  }
};
