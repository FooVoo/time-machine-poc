import { writable } from 'svelte/store';

// Filter stores
export const filterRequestId = writable('');
export const customFilterField = writable('');
export const customFilterValue = writable('');
export const groupByRequestId = writable(false);

// Actions
export function resetFilters() {
  filterRequestId.set('');
  customFilterField.set('');
  customFilterValue.set('');
  groupByRequestId.set(false);
}
