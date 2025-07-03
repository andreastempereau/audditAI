describe('blocked chat', () => {
  it('shows alert when blocked', () => {
    cy.intercept('POST', '/api/chat', {
      statusCode: 403,
      body: { error: 'blocked' }
    }).as('chat');
    cy.visit('/app');
    cy.get('textarea').type('bad');
    cy.contains('button', 'Send').click();
    cy.wait('@chat');
    cy.contains('blocked');
  });
});
