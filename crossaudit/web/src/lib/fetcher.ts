export async function fetcher(url: string) { const res = await fetch(url); return res.json(); }
