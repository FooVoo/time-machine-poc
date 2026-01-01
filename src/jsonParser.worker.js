// Web Worker for parsing JSON files
// This offloads JSON parsing from the main thread to prevent UI blocking

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
