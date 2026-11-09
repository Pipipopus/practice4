import { TicketsPage } from '../pages/TicketsPage';
import { TicketForm } from '../pages/TicketForm';

const page = new TicketsPage();
const form = new TicketForm();

describe('HelpDesk — E2E-сценарии', () => {
  beforeEach(() => {
    // Независимое начальное состояние: 4 демонстрационные заявки.
    // Сброс доступен только при запуске npm run start:test.
    cy.request('POST', '/api/__reset');
    cy.intercept('GET', '/api/tickets*').as('list');
    page.open();
    cy.wait('@list');
  });

  it('показывает исходные заявки', () => {
    cy.get('[data-testid="page-title"]').should('contain', 'HelpDesk');
    page.items().should('have.length', 4);
    page.count().should('have.text', '4');
  });

  it('E-01. создаёт заявку через форму: сообщение, запись в списке, порядок', () => {
    cy.intercept('POST', '/api/tickets').as('create');

    form.fill({
      title: 'Не включается проектор',
      description: 'Проектор в аудитории 305 не реагирует на пульт',
      category: 'hardware',
      priority: 'high'
    });
    form.submit();

    cy.wait('@create').its('response.statusCode').should('eq', 201);
    form.message().should('have.text', 'Заявка №5 создана');
    page.count().should('have.text', '5');
    page.metaOf('Не включается проектор')
      .should('contain', 'Оборудование')
      .and('contain', 'Высокий')
      .and('contain', 'Новая');
    // Новая заявка high — самая свежая среди high, значит должна быть первой.
    page.items().first().should('contain', 'Не включается проектор');
  });

  it('E-02. поиск без учёта регистра + фильтры статуса и категории (AND)', () => {
    page.searchFor('СЕТИ');
    page.setStatus('new');
    page.setCategory('network');

    page.items().should('have.length', 1);
    page.count().should('have.text', '1');
    page.items().first()
      .should('contain', 'VPN недоступен')
      .and('contain', 'Сеть')
      .and('contain', 'Новая');
  });

  it('E-03. перевод заявки в работу и завершение через интерфейс', () => {
    cy.intercept('PATCH', '/api/tickets/*/status').as('patch');

    page.clickAction('VPN недоступен', 'В работу');
    cy.wait('@patch').its('response.statusCode').should('eq', 200);
    page.metaOf('VPN недоступен').should('contain', 'В работе');

    page.clickAction('VPN недоступен', 'Завершить');
    cy.wait('@patch').its('response.statusCode').should('eq', 200);
    page.metaOf('VPN недоступен').should('contain', 'Завершена');
    page.itemByTitle('VPN недоступен').find('button').should('not.exist');
  });

  it('E-04. текст с HTML-разметкой отображается как обычный текст', () => {
    const title = '<b>Жирный</b> заголовок';
    const description = 'Описание <i>с курсивом</i> внутри';
    cy.intercept('POST', '/api/tickets').as('create');

    form.fill({ title, description });
    form.submit();
    cy.wait('@create');

    page.itemByTitle(title).within(() => {
      cy.get('.ticket-title').should('have.text', title);
      cy.get('.ticket-description').should('have.text', description);
      cy.get('b, i').should('not.exist');
    });
  });
});
