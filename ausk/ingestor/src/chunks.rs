/// Split text into roughly equal sized word chunks.
/// `size` determines the number of words per chunk.
pub fn chunk_text(text: &str, size: usize) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut idx = 0;
    while idx < words.len() {
        let end = usize::min(idx + size, words.len());
        out.push(words[idx..end].join(" "));
        idx = end;
    }
    out
}
