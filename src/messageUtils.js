// Shared utility functions for message parsing

/**
 * Parse message data - handles both string and object data
 * @param {Object} msg - Message object with data field
 * @returns {Object|null} Parsed data or null if parsing fails
 */
export function parseMessageData(msg) {
  try {
    return typeof msg.data === 'string' ? JSON.parse(msg.data) : msg.data;
  } catch {
    return null;
  }
}
