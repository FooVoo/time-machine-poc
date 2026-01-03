import { writable } from 'svelte/store';

// WebSocket connection store
export const wsConnection = writable({
  url: '',
  ws: null,
  isConnected: false,
  statusMessage: '',
});

// Auto-capture state
export const autoCapture = writable(false);

// Store actions
export function connectWebSocket(url) {
  try {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      wsConnection.update((state) => ({
        ...state,
        ws,
        isConnected: true,
        statusMessage: `Подключено к ${url}`,
      }));
    };

    ws.onerror = () => {
      wsConnection.update((state) => ({
        ...state,
        statusMessage: 'Ошибка WebSocket соединения',
      }));
    };

    ws.onclose = () => {
      wsConnection.update((state) => ({
        ...state,
        ws: null,
        isConnected: false,
        statusMessage: 'Отключено',
      }));
    };

    return ws;
  } catch (error) {
    wsConnection.update((state) => ({
      ...state,
      statusMessage: `Ошибка подключения: ${error.message}`,
    }));
    return null;
  }
}

export function disconnectWebSocket() {
  wsConnection.update((state) => {
    if (state.ws) {
      state.ws.close();
    }
    return {
      ...state,
      ws: null,
      isConnected: false,
    };
  });
}
