import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method === 'POST') {
    await redis.set('vi-pending', req.body, { ex: 60 })
    return res.json({ ok: true })
  }

  // GET — consume and return the pending change (if any)
  const change = await redis.get('vi-pending')
  if (change) await redis.del('vi-pending')
  res.setHeader('Cache-Control', 'no-store')
  return res.json(change ?? null)
}
