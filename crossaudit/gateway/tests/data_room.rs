<<<<<<< codex/replace-dummy-unit-tests-and-update-docs
use crossaudit_gateway::storage::Storage;

#[tokio::test]
async fn save_and_list_documents() {
    let dir = tempfile::tempdir().unwrap();
    let storage = Storage::new(dir.path().to_str().unwrap()).await.unwrap();

    let id1 = storage.save(b"one").await.unwrap();
    let id2 = storage.save(b"two").await.unwrap();

    let mut list = storage.list().await.unwrap();
    list.sort();

    assert_eq!(list.len(), 2);
    assert!(list.contains(&id1));
    assert!(list.contains(&id2));
=======
use crossaudit_gateway::{config::Settings, init_state};
use crossaudit_gateway::data_room::{save_doc, search};
use axum::body::Bytes;

#[tokio::test]
async fn upload_and_search() {
    let db_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgresql://localhost/postgres".into());
    let settings = Settings {
        server_addr: "127.0.0.1:0".into(),
        database_url: db_url,
        openai_api_key: String::new(),
        storage_path: "./tmp-test-storage".into(),
    };
    let state = init_state(settings.clone()).await.unwrap();

    let bytes = include_bytes!("fixtures/hello.pdf");
    save_doc(&state, Bytes::from_static(bytes)).await.unwrap();

    let res = search(&state, "Hello", 5).await.unwrap();
    assert!(!res.is_empty());
>>>>>>> main
}
