use crossaudit_gateway::policy::PolicyEngine;

#[test]
fn rewrite_applied() {
    let policy = PolicyEngine::load_from_path("../config/rules.yaml").unwrap();
    let (out, action) = policy.apply("my ssn is 123-45-6789");
    assert_eq!(out, "my ssn is ***-**-****");
    assert_eq!(action.unwrap(), "rewrite");
}
