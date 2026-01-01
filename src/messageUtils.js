/**
 * @fileoverview Shared utility functions for message parsing
 * These utilities are used by both the main component and workers
 * to consistently handle message data parsing.
 */

/**
 * @typedef {Object} Message
 * @property {string} timestamp - ISO 8601 timestamp of when the message was captured
 * @property {'sent'|'received'} type - Direction of the message
 * @property {string|Object} data - Message payload (JSON string or parsed object)
 */

/**
 * Parse message data - handles both string and object data
 * Safely extracts the data field from a message, parsing JSON strings if needed.
 * Returns null if parsing fails to prevent errors in downstream code.
 * 
 * @param {Message} msg - Message object with data field
 * @returns {Object|null} Parsed data object or null if parsing fails
 * @example
 * // String data
 * parseMessageData({data: '{"requestId":"req-1"}'}) // returns {requestId: 'req-1'}
 * 
 * // Object data (already parsed)
 * parseMessageData({data: {requestId: 'req-1'}}) // returns {requestId: 'req-1'}
 * 
 * // Invalid data
 * parseMessageData({data: 'invalid json'}) // returns null
 */
export function parseMessageData(msg) {
  try {
    return typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
  } catch {
    return null;
  }
}
