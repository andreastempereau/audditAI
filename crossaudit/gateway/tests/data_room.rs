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
}
