// Web Worker for storing and managing message data
// This worker holds the complete message dataset and serves slices to the main app

let messages = []; // Complete message dataset stored in worker
let filteredIndices = []; // Indices of filtered messages
let groupedData = null; // Grouped message data

// Helper functions
import { parseMessageData } from './messageUtils.js';

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

// Filter by request ID - optimized to single pass
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

// Filter by custom field - optimized with early returns
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

// Extract all field paths from an object
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

// Get all available field paths
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

// Group messages by request ID
function groupMessagesByRequestId(indices) {
  const groups = new Map();

  for (const index of indices) {
    const msg = messages[index];
    const data = parseMessageData(msg);
    const requestId = data?.requestId;

    if (requestId) {
      if (!groups.has(requestId)) {
        groups.set(requestId, []);
      }
      groups.get(requestId).push(msg);
    }
  }

  return Array.from(groups.entries());
}

// Handle messages from the main thread
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
