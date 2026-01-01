/**
 * @fileoverview Web Worker for parsing JSON files
 * This offloads JSON parsing from the main thread to prevent UI blocking
 * when importing large message datasets (12MB+)
 */

/**
 * @typedef {Object} ParseRequest
 * @property {string} fileContent - The JSON file content as a string
 */

/**
 * @typedef {Object} ParseSuccessResponse
 * @property {boolean} success - Always true for successful parsing
 * @property {Array<Object>} data - The parsed JSON data
 */

/**
 * @typedef {Object} ParseErrorResponse
 * @property {boolean} success - Always false for failed parsing
 * @property {string} error - Error message describing what went wrong
 */

/**
 * Handles incoming messages from the main thread to parse JSON content
 * @param {MessageEvent<ParseRequest>} e - Message event containing file content
 */
self.onmessage = function(e) {
  const { fileContent } = e.data;
  
  try {
    // Parse the JSON content
    const parsed = JSON.parse(fileContent);
    
    // Send the parsed result back to the main thread
    self.postMessage({
      success: true,
      data: parsed
    });
  } catch (error) {
    // Send error back to the main thread
    self.postMessage({
      success: false,
      error: error.message
    });
  }
};
