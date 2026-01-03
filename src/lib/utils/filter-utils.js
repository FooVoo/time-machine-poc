/**
 * Filtering and field extraction utilities
 */

/**
 * Get value from nested path (e.g., "user.profile.name")
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-separated path
 * @returns {*} Value at path or undefined
 */
export function getNestedValue(obj, path) {
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
 * Extract all field paths from an object (including nested) and track primitives
 * 
 * NOTE: This function mutates the primFields and valuesMap parameters.
 * It populates them with discovered field paths and their values.
 * 
 * @param {Object} obj - Object to extract from
 * @param {string} prefix - Path prefix
 * @param {Set} primFields - Set to populate with primitive field paths (mutated)
 * @param {Map} valuesMap - Map to populate with field values (mutated)
 * @returns {Array<string>} Array of field paths
 */
export function extractFieldPaths(obj, prefix = '', primFields, valuesMap) {
  const paths = [];

  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      paths.push(path);

      // Check if value is primitive (string, number, boolean, null)
      const isPrimitive =
        value === null ||
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
