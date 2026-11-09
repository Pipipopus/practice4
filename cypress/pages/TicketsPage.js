export class TicketsPage {
  open() { cy.visit('/'); }
  items() { return cy.get('[data-testid="ticket-item"]'); }
  count() { return cy.get('[data-testid="ticket-count"]'); }
  searchFor(text) { cy.get('[data-testid="search"]').clear().type(text); }
  setStatus(status) { cy.get('[data-testid="status-filter"]').select(status); }
  setCategory(category) { cy.get('[data-testid="category-filter"]').select(category); }
  setPriority(priority) { cy.get('[data-testid="priority-filter"]').select(priority); }

  /** Карточка заявки по точному тексту темы. */
  itemByTitle(title) {
    return cy.contains('[data-testid="ticket-item"] .ticket-title', title).parents('[data-testid="ticket-item"]');
  }
  /** Блок с категорией / приоритетом / статусом карточки. */
  metaOf(title) { return this.itemByTitle(title).find('.ticket-meta'); }
  /** Нажать кнопку действия («В работу» / «Завершить») в карточке. */
  clickAction(title, label) { this.itemByTitle(title).contains('button', label).click(); }
}
