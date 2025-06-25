import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const data = await fetch('http://localhost:8000/audit').then(r => r.json());
  res.status(200).json(data);
}
