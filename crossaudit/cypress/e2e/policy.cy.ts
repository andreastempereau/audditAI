describe('policy page', () => {
  it('loads admin policy page', () => {
    cy.visit('/app/admin/policy');
    cy.contains('Policy');
  });
});
