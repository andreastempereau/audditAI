use anyhow::Result;

/// Naive PDF parser that extracts text appearing in parentheses
/// before the `Tj` operator. It does not aim to be a full PDF
/// implementation but is sufficient for simple, text based PDFs.
pub fn parse(bytes: &[u8]) -> Result<String> {
    let content = String::from_utf8_lossy(bytes);
    let mut out = String::new();
    for part in content.split("Tj") {
        if let Some(start) = part.rfind('(') {
            if let Some(end) = part[start + 1..].find(')') {
                let text = &part[start + 1..start + 1 + end];
                if !text.trim().is_empty() {
                    if !out.is_empty() {
                        out.push(' ');
                    }
                    out.push_str(text.trim());
                }
            }
        }
    }
    Ok(out)
}
