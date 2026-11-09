import { TicketsPage } from '../pages/TicketsPage';

const page = new TicketsPage();

describe('HelpDesk — базовые E2E-проверки', () => {
  beforeEach(() => {
    // Сброс доступен только при запуске npm run start:test.
    cy.request('POST', '/api/__reset');
  });

  it('показывает исходные заявки', () => {
    page.open();
    cy.get('[data-testid="page-title"]').should('contain', 'HelpDesk');
    page.items().should('have.length', 4);
    page.count().should('have.text', '4');
  });

  // Добавьте сценарии: создание, поиск + фильтр, изменение статуса,
  // безопасное отображение введенного пользователем текста.
});
