describe('upload page', () => {
  it('lists uploaded docs', () => {
    cy.intercept('GET', '/api/docs', ['doc1']).as('docs');
    cy.visit('/app/data-room');
    cy.wait('@docs');
    cy.contains('Data Room');
  });
});
