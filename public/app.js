'use strict';

const form = document.querySelector('#ticket-form');
const formMessage = document.querySelector('#form-message');
const list = document.querySelector('#ticket-list');
const count = document.querySelector('#count');
const listMessage = document.querySelector('#list-message');
const search = document.querySelector('#search');
const statusFilter = document.querySelector('#filter-status');
const categoryFilter = document.querySelector('#filter-category');

const statusLabels = { new: 'Новая', in_progress: 'В работе', resolved: 'Завершена' };
const priorityLabels = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const categoryLabels = { hardware: 'Оборудование', software: 'ПО', network: 'Сеть' };
let lastRequest = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderTicket(ticket) {
  const item = element('li', 'ticket');
  item.dataset.testid = 'ticket-item';
  item.dataset.id = String(ticket.id);
  const meta = element('div', 'ticket-meta');
  meta.append(
    element('span', '', categoryLabels[ticket.category]),
    element('span', '', priorityLabels[ticket.priority]),
    element('span', '', statusLabels[ticket.status])
  );
  item.append(
    element('h3', 'ticket-title', ticket.title),
    element('p', 'ticket-description', ticket.description),
    meta
  );
  if (ticket.status !== 'resolved') {
    const button = element('button', '', ticket.status === 'new' ? 'В работу' : 'Завершить');
    button.dataset.id = String(ticket.id);
    button.dataset.next = ticket.status === 'new' ? 'in_progress' : 'resolved';
    item.append(button);
  }
  return item;
}

async function loadTickets() {
  const requestId = ++lastRequest;
  try {
    const query = new URLSearchParams({
      search: search.value,
      status: statusFilter.value,
      category: categoryFilter.value
    });
    const response = await fetch(`/api/tickets?${query.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestId !== lastRequest) return; // Не отображать устаревший ответ фильтрации.
    listMessage.textContent = '';
    count.textContent = String(data.total);

    // Пользовательский текст выводится через textContent — HTML не интерпретируется.
    list.replaceChildren(...data.items.map(renderTicket));
    if (data.total === 0) list.textContent = 'Заявок по заданным условиям нет.';
  } catch (_) {
    if (requestId !== lastRequest) return;
    listMessage.textContent = 'Не удалось загрузить заявки.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  formMessage.textContent = '';
  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) {
      const issues = Object.values(data.errors || {});
      formMessage.textContent = issues.join(' / ') || data.error || 'Ошибка при сохранении';
      return;
    }
    formMessage.textContent = `Заявка №${data.ticket.id} создана`;
    form.reset();
    await loadTickets();
  } catch (_) {
    formMessage.textContent = 'Нет связи с сервером';
  }
});

list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  const response = await fetch(`/api/tickets/${button.dataset.id}/status`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: button.dataset.next })
  });
  if (!response.ok) {
    listMessage.textContent = 'Не удалось обновить статус';
    return;
  }
  await loadTickets();
});

[search, statusFilter, categoryFilter].forEach((element) => element.addEventListener('input', loadTickets));
loadTickets();
