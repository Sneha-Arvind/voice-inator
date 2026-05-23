import { useState, useEffect, useRef } from 'react'
import type { FigmaFrame } from '../types'
import { useApp } from '../App'
import { connectFile, connectSingleFrame, getFrameTextNodes, getFrameImage, parseFileUrl, clearAllCache } from '../lib/figma'
import { analyzeText } from '../lib/claude'
import TextCard from './TextCard'
import ChangesDrawer from './ChangesDrawer'
import ZoomableImage from './ZoomableImage'

export default function ReviewTab() {
  const {
    claudeKey, voices, selectedVoiceId,
    figmaToken, setFigmaToken,
    frames, setFrames,
    selectedFrameId, setSelectedFrameId,
    frameImageUrls, setFrameImageUrl,
    textNodesByFrame, setTextNodesForFrame,
    analyses, setAnalysis,
    currentNodeIndexByFrame, setCurrentNodeIndexForFrame,
    cardVoices, setCardVoice,
    clearFigmaState,
  } = useApp()

  const frameImageUrl = selectedFrameId ? (frameImageUrls[selectedFrameId] ?? null) : null

  const [figmaUrl, setFigmaUrl] = useState(() => localStorage.getItem('vi-last-url') ?? '')
  const [fileKey, setFileKey] = useState(() => localStorage.getItem('vi-last-key') ?? '')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [loadingImage, setLoadingImage] = useState(false)
  const [imageError, setImageError] = useState('')
  const prefetchAbortRef = useRef<AbortController | null>(null)
  // tracks the URL that was last successfully connected, so we can detect real changes
  const lastConnectedUrlRef = useRef<string>(localStorage.getItem('vi-last-url') ?? '')

  const selectedVoice = voices.find(v => v.id === selectedVoiceId)!
  const currentTextNodes = selectedFrameId ? (textNodesByFrame[selectedFrameId] ?? []) : []
  const currentFrame = frames.find(f => f.id === selectedFrameId)
  const frameIndex = frames.findIndex(f => f.id === selectedFrameId)
  const currentIndex = currentNodeIndexByFrame[selectedFrameId ?? ''] ?? 0
  const currentNode = currentTextNodes[currentIndex] ?? null
  const cardKey = selectedFrameId && currentNode ? `${selectedFrameId}:${currentNode.id}` : ''
  const effectiveVoiceId = cardVoices[cardKey] ?? selectedVoiceId

  // No auto-fetch on mount. frameImageUrls is in-memory only and loads when the
  // user presses Connect/Reconnect or clicks a frame. Auto-fetching here fires
  // on every tab switch and burns Figma API quota before the user does anything.

  // Eagerly analyze all text nodes in the current frame+voice sequentially.
  // By the time the user finishes reviewing card N, card N+1 is already done.
  useEffect(() => {
    if (!selectedFrameId || !claudeKey || currentTextNodes.length === 0) return
    const effectiveVoice = voices.find(v => v.id === effectiveVoiceId)
    if (!effectiveVoice?.description) return
    const voice = effectiveVoice

    prefetchAbortRef.current?.abort()
    const controller = new AbortController()
    prefetchAbortRef.current = controller

    const startedKeys = new Set<string>()

    async function analyzeAll() {
      for (let i = 0; i < currentTextNodes.length; i++) {
        if (controller.signal.aborted) break
        const node = currentTextNodes[i]
        const key = `${selectedFrameId}:${effectiveVoiceId}:${node.id}`
        const existing = analyses[key]
        // Invalidate if the cached analysis was for different text (Figma content changed between sessions)
        const stale = existing && existing.originalText !== node.characters
        if ((existing && !stale && existing.status !== 'error') || startedKeys.has(key)) continue

        startedKeys.add(key)
        setAnalysis(key, { nodeId: node.id, originalText: node.characters, status: 'loading', matches: true, expanded: false })

        try {
          const result = await analyzeText(node.characters, voice, claudeKey, currentFrame?.name ?? '', controller.signal)
          if (!controller.signal.aborted) {
            setAnalysis(key, {
              nodeId: node.id, originalText: node.characters, status: 'done',
              matches: result.matches, expanded: false,
              reason: result.reason, issue: result.issue,
              rewrites: result.rewrites as [string, string, string] | undefined,
            })
          }
        } catch (e: any) {
          if (e?.name !== 'AbortError' && !controller.signal.aborted) {
            const isTimeout = e?.name === 'TimeoutError'
            setAnalysis(key, { nodeId: node.id, originalText: node.characters, status: 'error', matches: true, expanded: false, errorMessage: isTimeout ? 'Timed out — click Retry' : e?.message })
          }
        }
      }
    }

    analyzeAll()
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrameId, effectiveVoiceId, textNodesByFrame[selectedFrameId ?? '']])

  async function handleConnect(forceRefresh = false) {
    if (!figmaUrl.trim() || !figmaToken.trim()) return
    setConnecting(true)
    setConnectError('')

    // If the URL changed since the last successful connect, wipe everything so
    // stale data from the previous link never bleeds through.
    const urlChanged = figmaUrl.trim() !== lastConnectedUrlRef.current
    if (urlChanged || forceRefresh) {
      clearFigmaState()
      clearAllCache()
    }

    try {
      const { fileKey: key, nodeId } = parseFileUrl(figmaUrl)
      setFileKey(key)
      localStorage.setItem('vi-last-url', figmaUrl)
      localStorage.setItem('vi-last-key', key)

      let result: { frames: FigmaFrame[]; fromCache: boolean }

      if (nodeId && !forceRefresh && !urlChanged) {
        // Fast path — use cache if URL hasn't changed
        try {
          result = await connectSingleFrame(key, nodeId, figmaToken)
        } catch (err: any) {
          // Don't fall back on rate-limit — connectFile hits the same limit and wastes another call
          if (err.message?.includes('rate limit')) throw err
          result = await connectFile(key, figmaToken, false)
        }
      } else if (nodeId) {
        // Fast path — always fetch fresh (URL changed or force-refresh)
        try {
          result = await connectSingleFrame(key, nodeId, figmaToken)
        } catch (err: any) {
          if (err.message?.includes('rate limit')) throw err
          result = await connectFile(key, figmaToken, true)
        }
      } else {
        result = await connectFile(key, figmaToken, urlChanged || forceRefresh)
      }

      if (result.frames.length === 0) throw new Error('No frames found. Try opening a specific frame in Figma and copying that URL.')
      setFromCache(result.fromCache)
      setFrames(result.frames)
      // When a node-id URL was given, navigate to that specific frame.
      // connectFile returns all frames so frames[0] would be wrong without this.
      const targetFrame = nodeId
        ? (result.frames.find(f => f.id === nodeId) ?? result.frames[0])
        : result.frames[0]
      await selectFrame(targetFrame, key, urlChanged || forceRefresh)
      lastConnectedUrlRef.current = figmaUrl.trim()
    } catch (e: any) {
      setConnectError(e.message ?? 'Could not connect to Figma')
    } finally {
      setConnecting(false)
    }
  }

  async function selectFrame(frame: FigmaFrame, fKey?: string, forceRefresh = false) {
    const key = fKey ?? fileKey
    setSelectedFrameId(frame.id)
    setImageError('')

    // Fetch text nodes: always on forceRefresh, otherwise only if not cached
    if (forceRefresh || !textNodesByFrame[frame.id]) {
      try {
        // Always pass forceRefresh=false here: on a fresh connect, connectSingleFrame already
        // fetched + cached text nodes from the same /nodes response, so we read from that cache
        // instead of making a redundant second API call. On a force-refresh, clearAllCache() was
        // called first, so the cache is empty and getFrameTextNodes will fetch fresh anyway.
        const freshNodes = await getFrameTextNodes(key, frame.id, figmaToken, false)

        if (forceRefresh) {
          // Invalidate analyses for nodes whose text has changed in Figma
          const oldNodes = textNodesByFrame[frame.id] ?? []
          const oldTextById: Record<string, string> = Object.fromEntries(oldNodes.map(n => [n.id, n.characters]))
          for (const node of freshNodes) {
            if (oldTextById[node.id] !== undefined && oldTextById[node.id] !== node.characters) {
              for (const voice of voices) {
                const k = `${frame.id}:${voice.id}:${node.id}`
                if (analyses[k]) {
                  setAnalysis(k, { nodeId: node.id, originalText: node.characters, status: 'error', matches: true, expanded: false })
                }
              }
            }
          }
        }

        setTextNodesForFrame(frame.id, freshNodes)
      } catch {
        // On forceRefresh failure keep existing cached nodes; on first load set empty
        if (!textNodesByFrame[frame.id]) setTextNodesForFrame(frame.id, [])
      }
    }

    // Fetch frame image — always refresh on forceRefresh, otherwise use in-memory cache
    if (forceRefresh || !frameImageUrls[frame.id]) {
      setLoadingImage(true)
      try {
        const url = await getFrameImage(key, frame.id, figmaToken)
        if (url) setFrameImageUrl(frame.id, url)
        else setImageError('Figma returned no image for this frame.')
      } catch (e: any) {
        setImageError(e.message ?? 'Could not load frame image.')
      } finally {
        setLoadingImage(false)
      }
    }
  }

  async function refreshFrameImage() {
    if (!selectedFrameId || !fileKey) return
    // Brief delay so Figma has time to process the plugin change before we hit the render API
    await new Promise(resolve => setTimeout(resolve, 500))
    setLoadingImage(true)
    setImageError('')
    try {
      const url = await getFrameImage(fileKey, selectedFrameId, figmaToken, true)
      if (url) setFrameImageUrl(selectedFrameId, url)
      else setImageError('Figma returned no image for this frame.')
    } catch (e: any) {
      setImageError(e.message ?? 'Could not load frame image.')
    } finally {
      setLoadingImage(false)
    }
  }

  function onNext() {
    if (selectedFrameId) setCurrentNodeIndexForFrame(selectedFrameId, currentIndex + 1)
  }

  function onPrev() {
    if (selectedFrameId && currentIndex > 0) setCurrentNodeIndexForFrame(selectedFrameId, currentIndex - 1)
  }

  function navigate(dir: 1 | -1) {
    const next = frames[frameIndex + dir]
    if (next) selectFrame(next)
  }

  const isConnected = frames.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 bg-white border-b border-n-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <input
          value={figmaUrl}
          onChange={e => setFigmaUrl(e.target.value)}
          placeholder="Figma file URL or key"
          className="flex-1 min-w-[200px] text-sm px-3 py-2 rounded-lg border border-n-200 focus:outline-none focus:border-n-400"
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
        <input
          value={figmaToken}
          onChange={e => setFigmaToken(e.target.value)}
          type="password"
          placeholder="Personal access token"
          className="w-52 text-sm px-3 py-2 rounded-lg border border-n-200 focus:outline-none focus:border-n-400"
        />
        <button
          onClick={() => handleConnect(false)}
          disabled={connecting || !figmaUrl.trim() || !figmaToken.trim()}
          className="px-4 py-2 rounded-lg bg-n-800 text-white text-sm font-semibold hover:bg-n-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {connecting ? 'Connecting…' : isConnected ? 'Reconnect' : 'Connect'}
        </button>
        {isConnected && fromCache && (
          <button
            onClick={() => handleConnect(true)}
            className="text-xs text-n-400 hover:text-n-700 underline underline-offset-2 shrink-0"
            title="Force-fetch fresh data from Figma API"
          >
            Using cached data · Refresh
          </button>
        )}
      </div>

      {!claudeKey && (
        <div className="shrink-0 mx-5 mt-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          No Claude API key — go to <strong>Voice Config</strong> and paste your key at the top.
        </div>
      )}
      {claudeKey && selectedVoice && !selectedVoice.description && (
        <div className="shrink-0 mx-5 mt-3 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <strong>{selectedVoice.name}</strong> has no description — go to <strong>Voice Config</strong> and fill in the description, examples, and save. Analysis won't run without it.
        </div>
      )}
      {connectError && (
        <div className="shrink-0 mx-5 mt-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm space-y-1">
          <p>{connectError}</p>
          {connectError.includes('rate limit') && (
            <p className="text-red-600">
              Tip: In Figma, click on a specific frame, copy the URL (it will contain <code className="bg-red-100 px-1 rounded">node-id=…</code>), and paste that — it uses a lighter API endpoint that may not be rate-limited.
            </p>
          )}
        </div>
      )}

      {!isConnected ? (
        <div className="flex-1 flex items-center justify-center text-n-400 text-sm">
          Connect a Figma file to get started
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Frame sidebar */}
          <aside className="w-52 shrink-0 bg-white border-r border-n-200 flex flex-col">
            <div className="p-3 border-b border-n-200">
              <p className="text-xs font-semibold text-n-500 uppercase tracking-wide">
                {frames.length} frames
              </p>
            </div>
            <nav className="flex-1 overflow-y-auto py-1">
              {frames.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectFrame(f)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors truncate ${
                    selectedFrameId === f.id ? 'bg-n-100 text-n-800' : 'text-n-600 hover:bg-n-50'
                  }`}
                  title={f.name}
                >
                  {f.name}
                </button>
              ))}
            </nav>
            <div className="shrink-0 border-t border-n-200 p-3 flex gap-2">
              <button
                onClick={() => navigate(-1)}
                disabled={frameIndex <= 0}
                className="flex-1 py-1.5 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 disabled:opacity-40 transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => navigate(1)}
                disabled={frameIndex >= frames.length - 1}
                className="flex-1 py-1.5 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 disabled:opacity-40 transition-colors"
              >
                Next →
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Frame preview */}
              <div className="relative w-[45%] shrink-0 border-r border-n-200 bg-n-100 overflow-hidden">
                {frameImageUrl ? (
                  <ZoomableImage src={frameImageUrl} alt={currentFrame?.name} />
                ) : imageError && currentFrame ? (
                  // Figma embed fallback — no API calls, no rate limits
                  // Works when the file has "Anyone with link can view" sharing
                  <div className="w-full h-full flex flex-col">
                    <div className="shrink-0 px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-700">Image API rate-limited — showing Figma embed (requires public link access)</span>
                      <button
                        onClick={() => { setImageError(''); currentFrame && selectFrame(currentFrame) }}
                        className="text-xs text-amber-700 underline shrink-0"
                      >
                        Retry image
                      </button>
                    </div>
                    <iframe
                      src={`https://www.figma.com/embed?embed_host=voice-inator&url=https://www.figma.com/design/${fileKey}/file?node-id=${currentFrame.id.replace(/:/g, '-')}`}
                      className="flex-1 border-0 w-full"
                      allowFullScreen
                    />
                  </div>
                ) : loadingImage ? (
                  <div className="w-full h-full flex items-center justify-center gap-2 text-n-400 text-sm">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Rendering…
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-n-400 text-sm">
                    Select a frame
                  </div>
                )}
              </div>

              {/* Single text card */}
              <div className="flex-1 overflow-y-auto p-4">
                {currentTextNodes.length === 0 && !loadingImage ? (
                  <p className="text-sm text-n-400 text-center pt-8">No text nodes in this frame.</p>
                ) : currentIndex >= currentTextNodes.length && currentTextNodes.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <span className="text-2xl">✓</span>
                    <p className="text-sm font-medium text-n-700">All {currentTextNodes.length} text nodes reviewed</p>
                    <button onClick={() => selectedFrameId && setCurrentNodeIndexForFrame(selectedFrameId, 0)} className="mt-2 text-xs text-n-500 underline underline-offset-2 hover:text-n-800">Start over</button>
                  </div>
                ) : currentNode ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-n-500 font-medium">{currentIndex + 1} of {currentTextNodes.length}</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={onPrev}
                          disabled={currentIndex === 0}
                          className="px-2.5 py-1 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 disabled:opacity-40 transition-colors"
                        >
                          ← Prev
                        </button>
                        <button
                          onClick={onNext}
                          disabled={currentIndex >= currentTextNodes.length - 1}
                          className="px-2.5 py-1 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 disabled:opacity-40 transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                    {(() => {
                      const key = `${selectedFrameId}:${effectiveVoiceId}:${currentNode.id}`
                      const analysis = analyses[key]
                      if (!analysis) return (
                        <div className="px-4 py-4 rounded-xl bg-white border border-n-200 animate-pulse">
                          <div className="h-3 bg-n-100 rounded w-2/3 mb-2" />
                          <div className="h-3 bg-n-100 rounded w-1/2" />
                        </div>
                      )
                      return (
                        <TextCard
                          key={key}
                          analysis={analysis}
                          analysisKey={key}
                          frame={currentFrame!}
                          onNext={onNext}
                          onPrev={onPrev}
                          onApplied={refreshFrameImage}
                          effectiveVoiceId={effectiveVoiceId}
                          onVoiceChange={voiceId => setCardVoice(cardKey, voiceId)}
                        />
                      )
                    })()}
                  </>
                ) : null}
              </div>
            </div>

            <ChangesDrawer />
          </div>
        </div>
      )}
    </div>
  )
}
