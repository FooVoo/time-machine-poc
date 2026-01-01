// Web Worker for filtering messages
// This offloads filtering operations from the main thread to prevent UI blocking

import { parseMessageData } from './messageUtils.js';

// Helper function to get nested value from object
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

// Filter by request ID
function filterByRequestId(messages, filterRequestId) {
  if (!filterRequestId) return messages;

  return messages.filter(msg => {
    const data = parseMessageData(msg);
    return data && data.requestId && data.requestId.includes(filterRequestId);
  });
}

// Filter by custom field
function filterByCustomField(messages, customFilterField, customFilterValue) {
  if (!customFilterField || !customFilterValue) {
    return messages;
  }

  return messages.filter(msg => {
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

// Group messages by request ID
function groupMessagesByRequestId(messages) {
  const groups = new Map();

  for (const msg of messages) {
    const data = parseMessageData(msg);
    const requestId = data?.requestId;

    if (requestId) {
      if (!groups.has(requestId)) {
        groups.set(requestId, []);
      }
      groups.get(requestId).push(msg);
    }
  }

  // Convert Map to array of entries for serialization
  return Array.from(groups.entries());
}

// Extract all field paths from messages
function extractFieldPaths(obj, prefix = '', primFields, valuesMap) {
  const paths = [];

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      paths.push(path);

      // Check if value is primitive
      const isPrimitive = value === null ||
                        typeof value === 'string' ||
                        typeof value === 'number' ||
                        typeof value === 'boolean';

      if (isPrimitive) {
        primFields.add(path);

        // Store unique values for this field
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

// Get all available field paths from messages
function getAllFieldPaths(messages) {
  const fieldsSet = new Set();
  const primFields = new Set();
  const valuesMap = new Map();

  for (const msg of messages) {
    // Add top-level message fields
    fieldsSet.add('type');
    fieldsSet.add('timestamp');

    // Top-level fields are primitives
    primFields.add('type');
    primFields.add('timestamp');

    // Track top-level values
    if (!valuesMap.has('type')) valuesMap.set('type', new Set());
    if (!valuesMap.has('timestamp')) valuesMap.set('timestamp', new Set());
    valuesMap.get('type').add(String(msg.type));
    valuesMap.get('timestamp').add(String(msg.timestamp));

    // Parse and add nested data fields
    const data = parseMessageData(msg);
    if (data) {
      const dataPaths = extractFieldPaths(data, 'data', primFields, valuesMap);
      dataPaths.forEach(path => fieldsSet.add(path));
    }
  }

  // Convert Sets and Maps to arrays for serialization
  return {
    fields: Array.from(fieldsSet).sort(),
    primitiveFields: Array.from(primFields),
    fieldValues: Array.from(valuesMap.entries()).map(([key, values]) => [key, Array.from(values)])
  };
}

// Handle messages from the main thread
self.onmessage = function(e) {
  const { action, messages, filterRequestId, customFilterField, customFilterValue } = e.data;
  
  try {
    let result;
    
    switch (action) {
      case 'filter':
        // Apply filters
        let filtered = messages;
        
        // First filter by request ID
        if (filterRequestId) {
          filtered = filterByRequestId(filtered, filterRequestId);
        }
        
        // Then filter by custom field
        if (customFilterField && customFilterValue) {
          filtered = filterByCustomField(filtered, customFilterField, customFilterValue);
        }
        
        result = { filtered };
        break;
        
      case 'group':
        // Group messages by request ID
        result = { grouped: groupMessagesByRequestId(messages) };
        break;
        
      case 'extractFields':
        // Extract all field paths
        result = getAllFieldPaths(messages);
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
