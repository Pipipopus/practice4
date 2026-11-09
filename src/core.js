'use strict';

const CATEGORIES = ['hardware', 'software', 'network'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['new', 'in_progress', 'resolved'];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };

/**
 * Нормализует тему заявки: внешние и повторяющиеся пробелы незначимы.
 * Продукт передан студентам в исходном состоянии; корректность НЕ гарантируется.
 */
function normalizeTitle(title) {
  return typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : '';
}

function validateTicketInput(input) {
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { input: 'Ожидается объект с данными заявки' };
  }

  const title = normalizeTitle(input.title);
  if (typeof input.title !== 'string' || title.length < 5 || title.length > 80) {
    errors.title = 'Тема должна содержать от 5 до 80 символов';
  }

  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 10 || description.length > 500) {
    errors.description = 'Описание должно содержать от 10 до 500 символов';
  }
  if (!CATEGORIES.includes(input.category)) {
    errors.category = 'Неизвестная категория';
  }
  if (!PRIORITIES.includes(input.priority)) {
    errors.priority = 'Неизвестный приоритет';
  }
  return errors;
}

function canChangeStatus(from, to) {
  if (!STATUSES.includes(from) || !STATUSES.includes(to)) return false;
  if (from === 'new') return to === 'in_progress';
  if (from === 'in_progress') return to === 'resolved';
  return false;
}

/** Поля, по которым фильтр работает как точное совпадение. */
const EXACT_FILTERS = ['status', 'category', 'priority'];

function matchesSearch(ticket, search) {
  if (!search) return true;
  return [ticket.title, ticket.description].some((text) => text.toLowerCase().includes(search));
}

function compareTickets(a, b) {
  const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  return byPriority !== 0 ? byPriority : b.createdAt.localeCompare(a.createdAt);
}

/**
 * Условия поиска объединяются оператором AND.
 * В результирующем списке первыми идут важные и новые заявки.
 */
function filterAndSort(tickets, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  const exact = EXACT_FILTERS
    .map((field) => [field, String(filters[field] || '').trim()])
    .filter(([, value]) => value);
  return tickets
    .filter((ticket) => exact.every(([field, value]) => ticket[field] === value))
    .filter((ticket) => matchesSearch(ticket, search))
    .sort(compareTickets);
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  FILTER_KEYS: ['search', ...EXACT_FILTERS],
  normalizeTitle,
  validateTicketInput,
  canChangeStatus,
  filterAndSort
};
