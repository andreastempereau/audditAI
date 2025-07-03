import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Disable this endpoint to prevent heartbeat popups
  res.status(404).json({ message: 'Endpoint disabled' });
}
