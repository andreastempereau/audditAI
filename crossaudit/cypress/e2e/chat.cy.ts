describe('chat flow', () => {
  it('sends a prompt and displays the response', () => {
    cy.intercept('POST', '/api/chat', { response: 'hi' }).as('chat');
    cy.visit('/app');
    cy.get('textarea').type('hello');
    cy.contains('button', 'Send').click();
    cy.wait('@chat');
    cy.contains('pre', 'hi').should('be.visible');
  });
});
