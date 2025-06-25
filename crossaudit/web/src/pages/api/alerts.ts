import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const interval = setInterval(() => {
    res.write(`data: heartbeat\n\n`);
  }, 5000);
  req.on('close', () => clearInterval(interval));
}
