import { useState, useEffect, createContext, useContext } from 'react'
import type { Voice, FigmaFrame, FigmaTextNode, Analysis, AppliedChange } from './types'
import VoiceConfig from './components/VoiceConfig'
import ReviewTab from './components/ReviewTab'

const DEFAULT_VOICES: Voice[] = [
  { id: 'brand', name: 'Brand Voice', description: '', moreLike: '', lessLike: '' },
  { id: 'cogsee', name: 'Cogsee', description: '', moreLike: '', lessLike: '' },
  { id: 'sage', name: 'Sage', description: '', moreLike: '', lessLike: '' },
  { id: 'vin', name: 'Vin', description: '', moreLike: '', lessLike: '' },
  { id: 'loop', name: 'Loop', description: '', moreLike: '', lessLike: '' },
  { id: 'edge', name: 'Edge', description: '', moreLike: '', lessLike: '' },
  { id: 'kai', name: 'Kai', description: '', moreLike: '', lessLike: '' },
  { id: 'jinx', name: 'Jinx', description: '', moreLike: '', lessLike: '' },
]

type AppCtx = {
  claudeKey: string
  setClaudeKey: (k: string) => void
  voices: Voice[]
  updateVoice: (v: Voice) => void
  selectedVoiceId: string
  setSelectedVoiceId: (id: string) => void
  figmaToken: string
  setFigmaToken: (t: string) => void
  frames: FigmaFrame[]
  setFrames: (f: FigmaFrame[]) => void
  selectedFrameId: string | null
  setSelectedFrameId: (id: string | null) => void
  frameImageUrls: Record<string, string>
  setFrameImageUrl: (frameId: string, url: string) => void
  textNodesByFrame: Record<string, FigmaTextNode[]>
  setTextNodesForFrame: (frameId: string, nodes: FigmaTextNode[]) => void
  analyses: Record<string, Analysis>
  setAnalysis: (key: string, a: Analysis) => void
  appliedChanges: AppliedChange[]
  addAppliedChange: (c: AppliedChange) => void
  currentNodeIndexByFrame: Record<string, number>
  setCurrentNodeIndexForFrame: (frameId: string, index: number) => void
  clearCurrentNodeIndices: () => void
  cardVoices: Record<string, string>
  setCardVoice: (cardKey: string, voiceId: string) => void
  clearCardVoices: () => void
  clearFigmaState: () => void
}

export const AppContext = createContext<AppCtx>(null as any)
export const useApp = () => useContext(AppContext)

function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? '') } catch { return fallback }
}

export default function App() {
  const [tab, setTab] = useState<'config' | 'review'>('review')
  const [claudeKey, setClaudeKeyState] = useState<string>(() => load('vi-claude-key', ''))
  const [voices, setVoices] = useState<Voice[]>(() => load('vi-voices', DEFAULT_VOICES))
  const [selectedVoiceId, setSelectedVoiceId] = useState('brand')
  const [figmaToken, setFigmaTokenState] = useState<string>(() => load('vi-figma-token', ''))
  const [frames, setFrames] = useState<FigmaFrame[]>(() => load('vi-frames', []))
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(() => load('vi-selected-frame', null))
  const [frameImageUrls, setFrameImageUrls] = useState<Record<string, string>>({})
  const [textNodesByFrame, setTextNodesByFrame] = useState<Record<string, FigmaTextNode[]>>(() => load('vi-text-nodes', {}))
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>(() => {
    const saved: Record<string, Analysis> = load('vi-analyses', {})
    // Convert any interrupted 'loading' entries to 'error' so they get re-analyzed
    for (const key of Object.keys(saved)) {
      if (saved[key].status === 'loading') saved[key] = { ...saved[key], status: 'error' }
    }
    return saved
  })
  const [appliedChanges, setAppliedChanges] = useState<AppliedChange[]>(() => load('vi-applied', []))
  const [currentNodeIndexByFrame, setCurrentNodeIndexByFrame] = useState<Record<string, number>>(() => load('vi-node-index', {}))
  const [cardVoices, setCardVoicesState] = useState<Record<string, string>>(() => load('vi-card-voices', {}))

  useEffect(() => { localStorage.setItem('vi-claude-key', JSON.stringify(claudeKey)) }, [claudeKey])
  useEffect(() => { localStorage.setItem('vi-voices', JSON.stringify(voices)) }, [voices])
  useEffect(() => { localStorage.setItem('vi-figma-token', JSON.stringify(figmaToken)) }, [figmaToken])
  useEffect(() => { localStorage.setItem('vi-frames', JSON.stringify(frames)) }, [frames])
  useEffect(() => { localStorage.setItem('vi-selected-frame', JSON.stringify(selectedFrameId)) }, [selectedFrameId])
  useEffect(() => { localStorage.setItem('vi-text-nodes', JSON.stringify(textNodesByFrame)) }, [textNodesByFrame])
  useEffect(() => { localStorage.setItem('vi-analyses', JSON.stringify(analyses)) }, [analyses])
  useEffect(() => { localStorage.setItem('vi-applied', JSON.stringify(appliedChanges)) }, [appliedChanges])
  useEffect(() => { localStorage.setItem('vi-node-index', JSON.stringify(currentNodeIndexByFrame)) }, [currentNodeIndexByFrame])
  useEffect(() => { localStorage.setItem('vi-card-voices', JSON.stringify(cardVoices)) }, [cardVoices])

  const ctx: AppCtx = {
    claudeKey, setClaudeKey: setClaudeKeyState,
    voices,
    updateVoice: (v) => setVoices(prev => prev.map(x => x.id === v.id ? v : x)),
    selectedVoiceId, setSelectedVoiceId,
    figmaToken, setFigmaToken: setFigmaTokenState,
    frames, setFrames,
    selectedFrameId, setSelectedFrameId,
    frameImageUrls,
    setFrameImageUrl: (frameId, url) =>
      setFrameImageUrls(prev => ({ ...prev, [frameId]: url })),
    textNodesByFrame,
    setTextNodesForFrame: (frameId, nodes) =>
      setTextNodesByFrame(prev => ({ ...prev, [frameId]: nodes })),
    analyses,
    setAnalysis: (key, a) => setAnalyses(prev => ({ ...prev, [key]: a })),
    appliedChanges,
    addAppliedChange: (c) => setAppliedChanges(prev => [...prev.filter(x => x.id !== c.id), c]),
    currentNodeIndexByFrame,
    setCurrentNodeIndexForFrame: (frameId, index) =>
      setCurrentNodeIndexByFrame(prev => ({ ...prev, [frameId]: index })),
    clearCurrentNodeIndices: () => setCurrentNodeIndexByFrame({}),
    cardVoices,
    setCardVoice: (cardKey, voiceId) =>
      setCardVoicesState(prev => ({ ...prev, [cardKey]: voiceId })),
    clearCardVoices: () => setCardVoicesState({}),
    clearFigmaState: () => {
      setFrames([])
      setSelectedFrameId(null)
      setFrameImageUrls({})
      setTextNodesByFrame({})
      setAnalyses({})
      setAppliedChanges([])
      setCurrentNodeIndexByFrame({})
      setCardVoicesState({})
    },
  }

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex flex-col h-screen bg-n-50 text-n-800">
        <header className="shrink-0 bg-white border-b border-n-200 px-6 flex items-center h-14">
          <span className="font-bold text-[17px] tracking-tight mr-8">voice‑inator</span>
          <button
            onClick={() => setTab('review')}
            className={`px-4 h-full text-sm font-medium border-b-2 transition-colors ${
              tab === 'review' ? 'border-n-800 text-n-800' : 'border-transparent text-n-500 hover:text-n-700'
            }`}
          >
            Review
          </button>
          <button
            onClick={() => setTab('config')}
            className={`ml-auto px-4 h-full text-sm font-medium border-b-2 transition-colors ${
              tab === 'config' ? 'border-n-800 text-n-800' : 'border-transparent text-n-500 hover:text-n-700'
            }`}
          >
            Voice Config
          </button>
        </header>
        <div className="flex-1 min-h-0">
          {tab === 'config' ? <VoiceConfig /> : <ReviewTab />}
        </div>
      </div>
    </AppContext.Provider>
  )
}
