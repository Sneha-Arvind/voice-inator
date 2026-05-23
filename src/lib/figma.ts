import type { FigmaFrame, FigmaTextNode } from '../types'

const BASE = 'https://api.figma.com/v1'
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null }
    return data as T
  } catch { return null }
}

function lsWrite(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

function framesKey(fileKey: string) { return `vi-frames-${fileKey}` }
function nodesKey(fileKey: string, frameId: string) {
  return `vi-nodes-${fileKey}-${frameId.replace(/:/g, '_')}`
}
function imageKey(fileKey: string, frameId: string) {
  return `vi-img-${fileKey}-${frameId.replace(/:/g, '_')}`
}

// ── Cache management ─────────────────────────────────────────────────────────

export function clearAllCache(): void {
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (k.startsWith('vi-frames-') || k.startsWith('vi-nodes-') || k.startsWith('vi-img-'))) {
      toRemove.push(k)
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k))
}

// ── API ───────────────────────────────────────────────────────────────────────

export function parseFileUrl(input: string): { fileKey: string; nodeId: string | null } {
  const keyMatch = input.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/)
  const fileKey = keyMatch ? keyMatch[1] : input.trim()
  const nodeMatch = input.match(/node-id=([A-Za-z0-9_-]+)/)
  // Figma URL uses "143-28" but API uses "143:28"
  const nodeId = nodeMatch ? nodeMatch[1].replace(/-/g, ':') : null
  return { fileKey, nodeId }
}

// Keep for backwards compat
export function parseFileKey(input: string): string {
  return parseFileUrl(input).fileKey
}

async function figmaFetch(path: string, token: string, signal?: AbortSignal) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Figma-Token': token },
    signal,
  })
  if (!res.ok) {
    if (res.status === 429) throw new Error('Figma rate limit hit (IP-based). Use cached data or wait a few minutes.')
    if (res.status === 403) throw new Error('Figma access denied — check your personal access token.')
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Figma error ${res.status}`)
  }
  return res.json()
}

// Light path: load a single frame directly by node ID via /nodes.
// Avoids the heavy /files endpoint entirely.
export async function connectSingleFrame(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<{ frames: FigmaFrame[]; fromCache: boolean }> {
  const cacheKey = framesKey(fileKey)
  const cached = lsRead<FigmaFrame[]>(cacheKey)
  if (cached) return { frames: cached, fromCache: true }

  const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${nodeId}`, token)
  const node = data.nodes?.[nodeId]?.document
  if (!node) throw new Error('Could not load that frame — check the node ID in your URL.')

  // We only have this one frame; user can paste other frame URLs to add more
  const frames: FigmaFrame[] = [{ id: nodeId, name: node.name ?? 'Frame' }]
  lsWrite(cacheKey, frames)

  // We already have the full node document — extract and cache text nodes now so
  // getFrameTextNodes doesn't need to make a second identical /nodes API call.
  const textNodes = extractTextNodes(node)
  lsWrite(nodesKey(fileKey, nodeId), textNodes)

  return { frames, fromCache: false }
}

// Full path: load all frames via /files?depth=2. Cached in localStorage.
export async function connectFile(
  fileKey: string,
  token: string,
  forceRefresh = false
): Promise<{ frames: FigmaFrame[]; fromCache: boolean }> {
  if (!forceRefresh) {
    const cached = lsRead<FigmaFrame[]>(framesKey(fileKey))
    if (cached) return { frames: cached, fromCache: true }
  }

  // depth=2: document → pages → frame names/IDs only. No node content.
  const data = await figmaFetch(`/files/${fileKey}?depth=2`, token)
  const frames: FigmaFrame[] = []
  for (const page of data.document.children ?? []) {
    for (const node of page.children ?? []) {
      if (['FRAME', 'COMPONENT', 'SECTION'].includes(node.type)) {
        frames.push({ id: node.id, name: `${page.name} / ${node.name}` })
      }
    }
  }

  lsWrite(framesKey(fileKey), frames)
  return { frames, fromCache: false }
}

// Returns text nodes for one frame. Reads from localStorage cache first unless forceRefresh.
export async function getFrameTextNodes(
  fileKey: string,
  frameId: string,
  token: string,
  forceRefresh = false
): Promise<FigmaTextNode[]> {
  if (!forceRefresh) {
    const cached = lsRead<FigmaTextNode[]>(nodesKey(fileKey, frameId))
    if (cached) return cached
  }

  const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${frameId}`, token)
  const frameNode = data.nodes?.[frameId]?.document
  const nodes = frameNode ? extractTextNodes(frameNode) : []
  lsWrite(nodesKey(fileKey, frameId), nodes)
  return nodes
}

export function extractTextNodes(node: any, results: FigmaTextNode[] = []): FigmaTextNode[] {
  if (node.type === 'TEXT' && node.characters?.trim()) {
    results.push({ id: node.id, characters: node.characters.trim() })
  }
  for (const child of node.children ?? []) extractTextNodes(child, results)
  return results
}

export async function getFrameImage(
  fileKey: string,
  frameId: string,
  token: string,
  forceRefresh = false
): Promise<string | null> {
  // Figma CDN image URLs are long-lived — cache them to avoid repeated API hits
  if (!forceRefresh) {
    const cached = lsRead<string>(imageKey(fileKey, frameId))
    if (cached) return cached
  }

  const data = await figmaFetch(
    `/images/${fileKey}?ids=${frameId}&format=png&scale=2`,
    token
  )
  const url = data.images?.[frameId] ?? null
  if (url) lsWrite(imageKey(fileKey, frameId), url)
  return url
}
