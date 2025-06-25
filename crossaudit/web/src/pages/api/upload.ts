import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buf = await req.arrayBuffer();
  await fetch('http://localhost:8000/upload', { method: 'POST', body: buf });
  res.status(201).end();
}
