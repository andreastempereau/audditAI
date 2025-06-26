import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const resp = await fetch(`http://localhost:8000/docs/${id}`);
  if (!resp.ok) {
    res.status(resp.status).end();
    return;
  }
  const buf = await resp.arrayBuffer();
  res.status(200).send(Buffer.from(buf));
}
