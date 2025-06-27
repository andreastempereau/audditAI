import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    const buf = Buffer.concat(chunks);
    await fetch('http://localhost:8000/upload', { method: 'POST', body: buf });
    res.status(201).end();
  });
}
