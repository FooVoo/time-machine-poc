import { writable, derived } from 'svelte/store';

// Messages store
export const messages = writable([]);

// Pagination store
export const pagination = writable({
  currentPage: 0,
  messagesPerPage: 50,
});

// Actions
export function addMessage(message) {
  messages.update((msgs) => {
    msgs.push(message);
    return msgs;
  });
}

export function clearMessages() {
  messages.set([]);
  pagination.update((p) => ({ ...p, currentPage: 0 }));
}

export function importMessages(importedMessages) {
  messages.set(importedMessages.slice());
  pagination.update((p) => ({ ...p, currentPage: 0 }));
}

// Derived stores
export const messageCount = derived(messages, ($messages) => $messages.length);
