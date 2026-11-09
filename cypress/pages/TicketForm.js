export class TicketForm {
  fill({ title, description, category = 'software', priority = 'medium' }) {
    cy.get('[data-testid="title"]').type(title);
    cy.get('[data-testid="description"]').type(description);
    cy.get('[data-testid="category"]').select(category);
    cy.get('[data-testid="priority"]').select(priority);
  }
  submit() { cy.get('[data-testid="submit-ticket"]').click(); }
  message() { return cy.get('[data-testid="form-message"]'); }
}
