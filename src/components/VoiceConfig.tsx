import { useState } from 'react'
import { useApp } from '../App'
import type { Voice } from '../types'

export default function VoiceConfig() {
  const { claudeKey, setClaudeKey, voices, updateVoice } = useApp()
  const [selectedId, setSelectedId] = useState(voices[0]?.id ?? '')
  const [draft, setDraft] = useState<Voice>(voices[0])
  const [saved, setSaved] = useState(false)

  function selectVoice(v: Voice) {
    setSelectedId(v.id)
    setDraft(v)
    setSaved(false)
  }

  function handleSave() {
    updateVoice(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex h-full">
      {/* Left panel */}
      <aside className="w-56 shrink-0 bg-white border-r border-n-200 flex flex-col">
        <div className="p-4 border-b border-n-200">
          <label className="block text-xs font-semibold text-n-500 uppercase tracking-wide mb-1.5">
            Claude API Key
          </label>
          <input
            type="password"
            value={claudeKey}
            onChange={e => setClaudeKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-n-200 bg-n-50 focus:outline-none focus:border-n-400 font-mono placeholder:text-n-400"
          />
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {voices.map(v => (
            <button
              key={v.id}
              onClick={() => selectVoice(v)}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                selectedId === v.id
                  ? 'bg-n-100 text-n-800'
                  : 'text-n-600 hover:bg-n-50 hover:text-n-800'
              }`}
            >
              {v.name}
              {v.description && (
                <span className="block text-xs text-n-400 font-normal truncate mt-0.5">
                  {v.description.slice(0, 40)}…
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Right: edit form */}
      <main className="flex-1 min-h-0 flex flex-col p-8 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">{draft?.name}</h2>
        <div className="mb-5">
          <Field label="Voice Name">
            <input
              value={draft?.name ?? ''}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              disabled={draft?.id === 'brand'}
              className="input"
            />
          </Field>
        </div>

        {/* Two-column layout: Description left, More/Less like right */}
        <div className="flex gap-5 flex-1 min-h-[400px]">
          {/* Left: Description fills full height */}
          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-semibold text-n-700 mb-1">Description</label>
            <p className="text-xs text-n-500 mb-2">Describe the personality, tone, and style of this voice.</p>
            <textarea
              value={draft?.description ?? ''}
              onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
              placeholder="e.g. Confident, direct, never corporate. Speaks like a smart friend, not a brand."
              className="input resize-none flex-1"
            />
          </div>

          {/* Right: More like (top) + Less like (bottom) */}
          <div className="flex-1 flex flex-col gap-5">
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-n-700 mb-1">More like…</label>
              <p className="text-xs text-n-500 mb-2">Paste examples of on-voice copy.</p>
              <textarea
                value={draft?.moreLike ?? ''}
                onChange={e => setDraft(d => ({ ...d, moreLike: e.target.value }))}
                placeholder={'e.g.\nJump in. Your story starts here.\nWe built this for you, not for us.'}
                className="input resize-none font-mono text-sm flex-1"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-semibold text-n-700 mb-1">Less like…</label>
              <p className="text-xs text-n-500 mb-2">Paste examples of off-voice copy to avoid.</p>
              <textarea
                value={draft?.lessLike ?? ''}
                onChange={e => setDraft(d => ({ ...d, lessLike: e.target.value }))}
                placeholder={'e.g.\nGet started with our platform today!\nLeveraging synergies to drive outcomes.'}
                className="input resize-none font-mono text-sm flex-1"
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-n-800 text-white text-sm font-semibold hover:bg-n-700 transition-colors"
          >
            {saved ? '✓ Saved' : 'Save Voice'}
          </button>
        </div>
      </main>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-n-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-n-500 mb-2">{hint}</p>}
      <style>{`.input { width: 100%; padding: 8px 12px; border-radius: 10px; border: 1px solid #E3E1DE; background: white; font-size: 14px; color: #2A2928; outline: none; font-family: inherit; box-sizing: border-box; } .input:focus { border-color: #A39F99; } .input:disabled { background: #F1F0EE; color: #7F7C76; } textarea.input { height: 100%; }`}</style>
      {children}
    </div>
  )
}
