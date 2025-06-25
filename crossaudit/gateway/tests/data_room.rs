use crossaudit_gateway::policy::PolicyEngine;

#[test]
fn block_applied() {
    let policy = PolicyEngine::load_from_path("../config/rules.yaml").unwrap();
    let (_, action) = policy.apply("what the fuck");
    assert_eq!(action.unwrap(), "block");
}
