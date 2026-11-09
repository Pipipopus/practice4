'use strict';

const { normalizeTitle, validateTicketInput, canChangeStatus, filterAndSort } = require('./core');

function initialTickets() {
  return [
    {
      id: 1, title: 'VPN недоступен', description: 'Не удается подключиться к учебной сети',
      category: 'network', priority: 'high', status: 'new', createdAt: '2026-10-01T09:00:00.000Z'
    },
    {
      id: 2, title: 'Ошибка в офисном пакете', description: 'При сохранении файла появляется ошибка',
      category: 'software', priority: 'medium', status: 'in_progress', createdAt: '2026-10-02T12:00:00.000Z'
    },
    {
      id: 3, title: 'Мышь не работает', description: 'Не реагирует кнопка мыши в кабинете',
      category: 'hardware', priority: 'low', status: 'new', createdAt: '2026-10-03T11:00:00.000Z'
    },
    {
      id: 4, title: 'Wi-Fi на этаже', description: 'Нет доступа к сети на третьем этаже',
      category: 'network', priority: 'high', status: 'resolved', createdAt: '2026-10-04T15:00:00.000Z'
    }
  ];
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function createTicketStore(seed = initialTickets()) {
  let items = [];
  let nextId = 1;

  function reset(newSeed = seed) {
    items = clone(newSeed);
    nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
  }
  reset();

  return {
    list(filters = {}) {
      return clone(filterAndSort([...items], filters));
    },
    create(input) {
      const errors = validateTicketInput(input);
      if (Object.keys(errors).length > 0) return { errors };
      const ticket = {
        id: nextId++,
        title: normalizeTitle(input.title),
        description: input.description.trim(),
        category: input.category,
        priority: input.priority,
        status: 'new',
        createdAt: new Date().toISOString()
      };
      items.push(ticket);
      return { ticket: clone(ticket) };
    },
    changeStatus(id, to) {
      const ticket = items.find((item) => item.id === id);
      if (!ticket) return { notFound: true };
      if (!canChangeStatus(ticket.status, to)) return { conflict: true };
      ticket.status = to;
      return { ticket: clone(ticket) };
    },
    reset
  };
}

module.exports = { initialTickets, createTicketStore };
