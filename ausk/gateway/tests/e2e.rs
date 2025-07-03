use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;

use crossaudit_gateway::{build_router, config::Settings, init_state};

#[tokio::test]
async fn upload_and_list_docs() {
    let dir = tempfile::tempdir().unwrap();
    let settings = Settings {
        server_addr: "127.0.0.1:0".into(),
        database_url: "postgres://user:pass@localhost/db".into(),
        openai_api_key: String::new(),
        storage_path: dir.path().to_str().unwrap().into(),
    };
    let state = init_state(settings.clone()).await.unwrap();
    let app = build_router(state);

    // upload a document
    let resp = app
        .clone()
        .oneshot(Request::builder().method("POST").uri("/upload").body(Body::from("data")).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::CREATED);

    // list documents
    let resp = app
        .oneshot(Request::builder().method("GET").uri("/docs").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = hyper::body::to_bytes(resp.into_body()).await.unwrap();
    let list: Vec<String> = serde_json::from_slice(&body).unwrap();
    assert_eq!(list.len(), 1);
}
