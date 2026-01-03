/**
 * Message parsing and formatting utilities
 */

/**
 * Parse message data - handles both string and object formats
 * @param {Object} msg - Message object with data property
 * @returns {Object|null} Parsed JSON object or null if parsing fails
 */
export function parseMessageData(msg) {
  try {
    return typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
  } catch {
    return null;
  }
}

/**
 * Format value for display (handle different types)
 * @param {*} value - Value to format
 * @returns {string} Formatted string representation
 */
export function formatValue(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

/**
 * Get type of value for display
 * @param {*} value - Value to check
 * @returns {string} Type name
 */
export function getValueType(value) {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

/**
 * Get display preview for complex values
 * @param {*} value - Value to preview
 * @returns {string} Preview string
 */
export function getValuePreview(value) {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value);
    return `Object {${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`;
  }
  return formatValue(value);
}
