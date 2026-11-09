'use strict';
const { createApp } = require('../../src/app');

let server;
let base;

// Каждый тест получает свой сервер на порту 0 и собственное состояние.
async function startServer(seed = []) {
  server = createApp({ seed });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  server = undefined;
});

// --- вспомогательные функции HTTP ---
async function getTickets(query = {}) {
  const qs = new URLSearchParams(query).toString();
  const response = await fetch(`${base}/api/tickets${qs ? `?${qs}` : ''}`);
  return { status: response.status, body: await response.json() };
}

async function postTicket(data) {
  const response = await fetch(`${base}/api/tickets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });
  return { status: response.status, body: await response.json() };
}

async function patchStatus(id, status) {
  const response = await fetch(`${base}/api/tickets/${id}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status })
  });
  return { status: response.status, body: await response.json() };
}

function seedTicket(id, overrides = {}) {
  return {
    id,
    title: `Заявка номер ${id}`,
    description: 'Описание тестовой заявки',
    category: 'software',
    priority: 'medium',
    status: 'new',
    createdAt: `2026-10-0${id}T10:00:00.000Z`,
    ...overrides
  };
}

const validTicket = {
  title: 'Сбой принтера',
  description: 'Принтер в аудитории не отвечает',
  category: 'hardware',
  priority: 'medium'
};

describe('Исходные примеры', () => {
  beforeEach(() => startServer());

  test('GET /api/health отвечает HTTP 200', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('POST /api/tickets создает корректную заявку', async () => {
    const { status, body } = await postTicket(validTicket);
    expect(status).toBe(201);
    expect(body.ticket.id).toBe(1);
    expect(body.ticket.status).toBe('new');
  });
});

describe('API: собственные проверки', () => {
  test('I-01. Созданная заявка возвращается тем же GET-запросом', async () => {
    // Arrange
    await startServer();
    // Act
    const created = await postTicket({ ...validTicket, title: '  Сбой   VPN в корпусе  ', priority: 'high' });
    const list = await getTickets();
    // Assert
    expect(created.status).toBe(201);
    expect(created.body.ticket).toMatchObject({
      title: 'Сбой VPN в корпусе', // нормализованная тема
      status: 'new',
      priority: 'high'
    });
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toEqual(created.body.ticket);
  });

  test('I-02. HTTP 400 при ошибке данных; количество заявок не меняется', async () => {
    await startServer([seedTicket(1)]);
    const before = await getTickets();

    const response = await postTicket({ ...validTicket, title: 'abc', category: 'printer' });
    const after = await getTickets();

    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveProperty('title');
    expect(response.body.errors).toHaveProperty('category');
    expect(after.body.total).toBe(before.body.total);
  });

  test('I-03. Тема из 3 символов, «раздутая» пробелами, отклоняется (400)', async () => {
    await startServer();
    const response = await postTicket({ ...validTicket, title: '   abc   ' });
    const after = await getTickets();
    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveProperty('title');
    expect(after.body.total).toBe(0);
  });

  test('I-04. search + status + category работают как AND', async () => {
    await startServer([
      seedTicket(1, { title: 'VPN недоступен', category: 'network', status: 'new' }),
      seedTicket(2, { title: 'VPN медленный', category: 'network', status: 'resolved' }),
      seedTicket(3, { title: 'VPN клиент не ставится', category: 'software', status: 'new' }),
      seedTicket(4, { title: 'Нет сети', category: 'network', status: 'new' })
    ]);

    const { status, body } = await getTickets({ search: 'vpn', status: 'new', category: 'network' });

    expect(status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items.map((t) => t.id)).toEqual([1]);
  });

  test('I-05. Запрещённый переход new → resolved: HTTP 409, статус не изменился', async () => {
    await startServer([seedTicket(1, { status: 'new' })]);

    const response = await patchStatus(1, 'resolved');
    const after = await getTickets();

    expect(response.status).toBe(409);
    expect(after.body.items[0].status).toBe('new');
  });

  test('I-06. PATCH: 200 для допустимого перехода, 400 для неизвестного статуса, 404 для чужого ID', async () => {
    await startServer([seedTicket(1, { status: 'new' })]);

    const ok = await patchStatus(1, 'in_progress');
    const unknown = await patchStatus(1, 'closed');
    const missing = await patchStatus(999, 'in_progress');

    expect(ok.status).toBe(200);
    expect(ok.body.ticket.status).toBe('in_progress');
    expect(unknown.status).toBe(400);
    expect(missing.status).toBe(404);
    expect((await getTickets()).body.items[0].status).toBe('in_progress');
  });

  test('I-07. Порядок в ответе: high → medium → low, внутри приоритета новее выше', async () => {
    await startServer([
      seedTicket(1, { priority: 'low', createdAt: '2026-10-09T10:00:00.000Z' }),
      seedTicket(2, { priority: 'high', createdAt: '2026-10-01T10:00:00.000Z' }),
      seedTicket(3, { priority: 'medium', createdAt: '2026-10-02T10:00:00.000Z' }),
      seedTicket(4, { priority: 'high', createdAt: '2026-10-05T10:00:00.000Z' })
    ]);

    const { body } = await getTickets();

    expect(body.items.map((t) => t.id)).toEqual([4, 2, 3, 1]);
  });
});

describe('TDD: фильтр по приоритету', () => {
  beforeEach(() => startServer([
    seedTicket(1, { title: 'VPN недоступен', priority: 'high', category: 'network', status: 'new' }),
    seedTicket(2, { title: 'Сбой почты', priority: 'medium', category: 'software', status: 'new' }),
    seedTicket(3, { title: 'Нет сети в 305', priority: 'high', category: 'network', status: 'resolved' }),
    seedTicket(4, { title: 'Мышь не работает', priority: 'low', category: 'hardware', status: 'new' })
  ]));

  test('T-01. GET /api/tickets?priority=high возвращает только high', async () => {
    const { status, body } = await getTickets({ priority: 'high' });
    expect(status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.items.every((t) => t.priority === 'high')).toBe(true);
  });

  test('T-02. priority сочетается с остальными фильтрами (AND)', async () => {
    const { body } = await getTickets({ priority: 'high', status: 'new', category: 'network', search: 'vpn' });
    expect(body.items.map((t) => t.id)).toEqual([1]);
  });

  test('T-03. пустой priority не ограничивает выборку', async () => {
    const { body } = await getTickets({ priority: '' });
    expect(body.total).toBe(4);
  });
});
