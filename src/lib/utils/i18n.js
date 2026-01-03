/**
 * Internationalization (i18n) strings
 * All UI text in Russian (primary language)
 */

export const i18n = {
  // Header
  title: 'Машина Времени WebSocket',
  subtitle: 'Экспорт и Импорт WebSocket сообщений',

  // Connection
  wsUrlLabel: 'URL WebSocket:',
  wsUrlPlaceholder: 'ws://localhost:8080',
  connect: 'Подключить',
  disconnect: 'Отключить',
  connected: 'Подключено',
  disconnected: 'Отключено',
  connectedTo: (url) => `Подключено к ${url}`,
  connectionError: 'Ошибка WebSocket соединения',
  disconnectedStatus: 'Отключено',

  // Capture
  autoCapture: 'Автоматически захватывать сообщения',

  // Filters
  filterByRequestId: 'Фильтр по ID запроса',
  requestIdLabel: 'ID запроса:',
  requestIdPlaceholder: 'Введите ID запроса для фильтрации',
  filterByCustomField: 'Фильтр по пользовательскому полю',
  fieldLabel: 'Поле:',
  fieldPlaceholder: 'напр. data.userId, type, timestamp',
  valueLabel: 'Значение:',
  valuePlaceholder: 'Введите значение для поиска',
  groupByRequestId: 'Группировать по ID запроса',
  selectPrimitiveField: 'Выберите поле с примитивными значениями',
  selectValueFromList: 'Выберите значение из списка',

  // Actions
  exportMessages: (count) => `Экспортировать сообщения (${count})`,
  importMessages: 'Импортировать сообщения',
  clearMessages: 'Очистить сообщения',
  messagesExported: 'Сообщения экспортированы',
  messagesCleared: 'Сообщения очищены',
  importing: 'Импорт...',
  importError: 'Ошибка импорта: Неверный формат',
  importErrorInvalidJson: 'Ошибка импорта: Некорректный JSON',
  imported: (count, word) => `Импортировано ${count} ${word}`,
  connectionErrorWithMsg: (msg) => `Ошибка подключения: ${msg}`,

  // Messages
  capturedMessages: (filtered, total) =>
    `Захваченные сообщения (${filtered}${total ? ` из ${total}` : ''})`,
  requestIdHeader: 'ID запроса:',
  messagesCount: (count, word) => `(${count} ${word})`,
  noMessagesWithRequestId: 'Не найдено сообщений с ID запроса',
  noMessagesCaptured: 'Сообщения ещё не захвачены',
  primitiveValue: 'Примитивное значение:',

  // Pagination
  previous: 'Предыдущая',
  next: 'Следующая',
  last: 'Последняя',
  pageOf: (current, total) => `Страница ${current} из ${total}`,
  showing: (start, end, total) => `(показано ${start}-${end} из ${total})`,

  // JSON Viewer
  expand: 'Развернуть',
  collapse: 'Свернуть',
  expandJson: 'Развернуть JSON',
  collapseJson: 'Свернуть JSON',

  // Message types
  sent: 'sent',
  received: 'received',

  // Pluralization
  pluralForms: {
    messages: {
      one: 'сообщение', // 1, 21, 31, ...
      few: 'сообщения', // 2-4, 22-24, 32-34, ...
      many: 'сообщений', // 0, 5-20, 25-30, ...
    },
  },
};

/**
 * Returns the correct Russian plural form based on count.
 * Russian has three plural forms:
 * - one: for numbers ending in 1 (except 11): 1, 21, 31, ...
 * - few: for numbers ending in 2-4 (except 12-14): 2-4, 22-24, 32-34, ...
 * - many: for all other cases: 0, 5-20, 25-30, ...
 *
 * @param {number} count - The number to check
 * @param {string} one - Form for 1, 21, 31, ... (e.g., "сообщение")
 * @param {string} few - Form for 2-4, 22-24, ... (e.g., "сообщения")
 * @param {string} many - Form for 0, 5-20, 25-30, ... (e.g., "сообщений")
 * @returns {string} The correct plural form
 */
export function pluralizeRussian(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }
  return many;
}

/**
 * Helper function for message pluralization
 * @param {number} count - Number of messages
 * @returns {string} Correct plural form
 */
export function getMessageWord(count) {
  return pluralizeRussian(
    count,
    i18n.pluralForms.messages.one,
    i18n.pluralForms.messages.few,
    i18n.pluralForms.messages.many
  );
}
