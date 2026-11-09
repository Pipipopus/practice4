'use strict';
const {
  normalizeTitle,
  validateTicketInput,
  canChangeStatus,
  filterAndSort
} = require('../../src/core');

// Корректные данные заявки; в отдельных тестах меняем только одно поле.
function validInput(overrides = {}) {
  return {
    title: 'Ошибка печати',
    description: 'Принтер не печатает документ',
    category: 'hardware',
    priority: 'low',
    ...overrides
  };
}

// Тестовая заявка для проверок фильтрации и сортировки.
function ticket(id, overrides = {}) {
  return {
    id,
    title: `Заявка ${id}`,
    description: 'Описание тестовой заявки',
    category: 'software',
    priority: 'medium',
    status: 'new',
    createdAt: `2026-10-0${id}T10:00:00.000Z`,
    ...overrides
  };
}

describe('Базовые unit-тесты (исходные примеры)', () => {
  test('удаляет пробелы в начале и конце темы', () => {
    expect(normalizeTitle('  Ошибка принтера  ')).toBe('Ошибка принтера');
  });

  test('отклоняет неизвестную категорию', () => {
    const errors = validateTicketInput(validInput({ category: 'unknown' }));
    expect(errors).toHaveProperty('category');
  });

  test('запрещает возвращение из закрытого статуса', () => {
    expect(canChangeStatus('resolved', 'new')).toBe(false);
  });
});

describe('U-01. Нормализация темы', () => {
  // Три класса входов: пробелы по краям, повтор пробелов внутри,
  // «любые пробельные символы» (табуляция, перевод строки).
  test.each([
    ['  Сбой принтера  ', 'Сбой принтера'],
    ['Сбой    принтера', 'Сбой принтера'],
    ['\tСбой\n\n принтера \t', 'Сбой принтера']
  ])('normalizeTitle(%j) → %j', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  test('не-строка превращается в пустую строку', () => {
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle(42)).toBe('');
  });
});

describe('U-02. Границы длины темы (после нормализации)', () => {
  // Граничные значения: 4/5 — нижняя граница (невалидно/валидно),
  // 80/81 — верхняя граница. Отдельно — строки, у которых «сырая» длина
  // отличается от длины после нормализации: длину надо считать ПОСЛЕ неё.
  test.each([
    { name: '4 символа', title: 'a'.repeat(4), valid: false },
    { name: '5 символов', title: 'a'.repeat(5), valid: true },
    { name: '80 символов', title: 'a'.repeat(80), valid: true },
    { name: '81 символ', title: 'a'.repeat(81), valid: false },
    { name: '3 символа + пробелы по краям (сырая длина 7)', title: '  abc  ', valid: false },
    { name: '80 символов + пробелы по краям (сырая длина 84)', title: `  ${'a'.repeat(80)}  `, valid: true },
    { name: 'слова через 5 пробелов: 84 «сырых», 80 после нормализации', title: `${'a'.repeat(40)}     ${'b'.repeat(39)}`, valid: true }
  ])('$name → валидно: $valid', ({ title, valid }) => {
    const errors = validateTicketInput(validInput({ title }));
    expect('title' in errors).toBe(!valid);
  });
});

describe('U-03. Границы длины описания (после trim)', () => {
  test.each([
    [9, false],
    [10, true],
    [500, true],
    [501, false]
  ])('описание из %i символов → валидно: %s', (length, isValid) => {
    const errors = validateTicketInput(validInput({ description: 'd'.repeat(length) }));
    expect('description' in errors).toBe(!isValid);
  });

  test('пробелы по краям описания не учитываются в длине', () => {
    const errors = validateTicketInput(validInput({ description: `   ${'d'.repeat(9)}   ` }));
    expect(errors).toHaveProperty('description');
  });
});

describe('U-04. Правила смены статуса', () => {
  test.each([
    ['new', 'in_progress', true],
    ['in_progress', 'resolved', true],
    ['new', 'resolved', false], // пропуск этапа
    ['in_progress', 'new', false], // возврат
    ['resolved', 'in_progress', false], // возврат из конечного статуса
    ['new', 'new', false],
    ['new', 'closed', false] // неизвестный статус
  ])('%s → %s: разрешено = %s', (from, to, allowed) => {
    expect(canChangeStatus(from, to)).toBe(allowed);
  });
});

describe('U-05. Сортировка реестра', () => {
  test('сначала high, затем medium, затем low', () => {
    const tickets = [
      ticket(1, { priority: 'low' }),
      ticket(2, { priority: 'high' }),
      ticket(3, { priority: 'medium' })
    ];
    const result = filterAndSort(tickets);
    expect(result.map((t) => t.priority)).toEqual(['high', 'medium', 'low']);
  });

  test('при одинаковом приоритете более новая заявка выше', () => {
    const tickets = [
      ticket(1, { priority: 'high', createdAt: '2026-10-01T10:00:00.000Z' }),
      ticket(2, { priority: 'low', createdAt: '2026-10-09T10:00:00.000Z' }),
      ticket(3, { priority: 'high', createdAt: '2026-10-05T10:00:00.000Z' })
    ];
    const result = filterAndSort(tickets);
    expect(result.map((t) => t.id)).toEqual([3, 1, 2]);
  });

  test('сортировка не изменяет исходный массив по составу', () => {
    const tickets = [ticket(1), ticket(2)];
    expect(filterAndSort(tickets)).toHaveLength(2);
  });
});

describe('U-06. Поиск', () => {
  const tickets = [
    ticket(1, { title: 'VPN недоступен', description: 'Не удается подключиться к учебной сети' }),
    ticket(2, { title: 'Мышь не работает', description: 'Не реагирует кнопка мыши' })
  ];

  test.each([
    ['vpn', [1]], // регистр в теме
    ['  VPN  ', [1]], // пробелы по краям поискового запроса
    ['УЧЕБНОЙ СЕТИ', [1]], // регистр в описании
    ['кнопка', [2]] // совпадение только в описании
  ])('поиск %j находит заявки %j', (search, ids) => {
    expect(filterAndSort(tickets, { search }).map((t) => t.id)).toEqual(ids);
  });
});

describe('U-07. Совместные фильтры (AND)', () => {
  test('поиск + статус + категория выполняются одновременно', () => {
    const tickets = [
      ticket(1, { title: 'Сеть в 101', category: 'network', status: 'new' }),
      ticket(2, { title: 'Сеть в 102', category: 'network', status: 'resolved' }),
      ticket(3, { title: 'Сеть в 103', category: 'hardware', status: 'new' }),
      ticket(4, { title: 'Принтер', category: 'network', status: 'new' })
    ];
    const result = filterAndSort(tickets, { search: 'сеть', status: 'new', category: 'network' });
    expect(result.map((t) => t.id)).toEqual([1]);
  });
});
