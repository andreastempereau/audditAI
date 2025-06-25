use crossaudit_gateway::policy::PolicyEngine;

#[test]
fn rewrites_ssn() {
    let path = format!("{}/../config/rules.yaml", env!("CARGO_MANIFEST_DIR"));
    let engine = PolicyEngine::load_from_path(&path).unwrap();
    let (out, action) = engine.apply("my ssn is 123-45-6789");
    assert_eq!(action.unwrap(), "rewrite");
    assert_eq!(out, "my ssn is ***-**-****");
}
