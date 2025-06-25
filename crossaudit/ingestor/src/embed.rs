use anyhow::Result;

/// Dimension of generated embeddings.
pub const DIM: usize = 1536;

/// Very small deterministic embedding generator used for tests.
/// It converts bytes of the input into a vector of length `DIM` by
/// summing byte values modulo the dimension.
pub fn embed_chunks(chunks: &[String]) -> Result<Vec<Vec<f32>>> {
    let mut out = Vec::new();
    for chunk in chunks {
        let mut vec = vec![0f32; DIM];
        for (i, b) in chunk.as_bytes().iter().enumerate() {
            vec[i % DIM] += *b as f32;
        }
        out.push(vec);
    }
    Ok(out)
}
