import { useState } from 'react'
import type { Analysis, AppliedChange, FigmaFrame, Voice } from '../types'
import { useApp } from '../App'
import { analyzeText } from '../lib/claude'

type Props = {
  analysis: Analysis
  analysisKey: string
  frame: FigmaFrame
  onNext: () => void
  onPrev: () => void
  onApplied?: () => void
  effectiveVoiceId: string
  onVoiceChange: (voiceId: string) => void
}

type VoicePickerProps = {
  voices: Voice[]
  effectiveVoiceId: string
  onVoiceChange: (voiceId: string) => void
}

function VoicePicker({ voices, effectiveVoiceId, onVoiceChange }: VoicePickerProps) {
  return (
    <select
      value={effectiveVoiceId}
      onChange={e => onVoiceChange(e.target.value)}
      className="text-xs px-2 py-1 rounded-lg border border-n-200 bg-white focus:outline-none focus:border-n-400 text-n-700"
      title="Voice for this card"
    >
      {voices.map(v => (
        <option key={v.id} value={v.id}>{v.name}</option>
      ))}
    </select>
  )
}

export default function TextCard({ analysis, analysisKey, frame, onNext, onPrev, onApplied, effectiveVoiceId, onVoiceChange }: Props) {
  const { claudeKey, voices, setAnalysis, addAppliedChange } = useApp()
  const voice = voices.find(v => v.id === effectiveVoiceId)!
  const [loadingChangeAnyway, setLoadingChangeAnyway] = useState(false)

  const isExpanded = !analysis.matches || analysis.expanded

  // The text currently being shown as "original" — Figma text on first pass, last applied on re-edit
  const baseText = analysis.editBase ?? analysis.originalText

  // Applied state
  if (analysis.applied) {
    return (
      <div className="rounded-xl bg-white border border-n-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-n-100 flex items-center justify-between">
          <VoicePicker voices={voices} effectiveVoiceId={effectiveVoiceId} onVoiceChange={onVoiceChange} />
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-emerald-500 text-lg shrink-0">✓</span>
          <span className="text-sm text-n-600 line-through truncate">{analysis.originalText}</span>
          <span className="text-sm text-n-800 truncate">→ {getAppliedText(analysis)}</span>
          <button onClick={handleEdit} className="ml-auto shrink-0 text-xs text-n-500 hover:text-n-800 underline underline-offset-2">
            Edit
          </button>
          <button onClick={onPrev} className="shrink-0 text-xs text-n-500 hover:text-n-800 underline underline-offset-2">
            ← Prev
          </button>
          <button onClick={onNext} className="shrink-0 text-xs text-n-500 hover:text-n-800 underline underline-offset-2">
            Next →
          </button>
        </div>
      </div>
    )
  }

  // Loading skeleton
  if (analysis.status === 'loading') {
    return (
      <div className="rounded-xl bg-white border border-n-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-n-100 flex items-center justify-between">
          <VoicePicker voices={voices} effectiveVoiceId={effectiveVoiceId} onVoiceChange={onVoiceChange} />
        </div>
        <div className="px-4 py-4 animate-pulse">
          <div className="h-3 bg-n-100 rounded w-2/3 mb-2" />
          <div className="h-3 bg-n-100 rounded w-1/2" />
        </div>
      </div>
    )
  }

  // Error state
  if (analysis.status === 'error') {
    return (
      <div className="rounded-xl bg-white border border-red-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-n-100 flex items-center justify-between">
          <VoicePicker voices={voices} effectiveVoiceId={effectiveVoiceId} onVoiceChange={onVoiceChange} />
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="text-red-400 text-base shrink-0 mt-0.5">!</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-n-700 block truncate">{baseText}</span>
            <span className="text-xs text-red-400 block">
              {analysis.errorMessage ?? 'Claude API error — check your API key in Voice Config'}
            </span>
          </div>
          <button onClick={handleRetry} className="text-xs text-n-500 hover:text-n-800 underline underline-offset-2 shrink-0 mt-0.5">
            Retry
          </button>
          <button onClick={onPrev} className="text-xs text-n-500 hover:text-n-800 underline underline-offset-2 shrink-0 mt-0.5">
            ← Prev
          </button>
          <button onClick={onNext} className="text-xs text-n-500 hover:text-n-800 underline underline-offset-2 shrink-0 mt-0.5">
            Skip →
          </button>
        </div>
      </div>
    )
  }

  // Matching — voice already sounds right
  if (!isExpanded) {
    return (
      <div className="rounded-xl bg-white border border-emerald-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-n-100 flex items-center justify-between">
          <VoicePicker voices={voices} effectiveVoiceId={effectiveVoiceId} onVoiceChange={onVoiceChange} />
        </div>
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-500 font-semibold text-sm">Looks good!</span>
            {analysis.reason && (
              <span className="text-xs text-n-400 italic">{analysis.reason}</span>
            )}
          </div>
          <p className="text-sm text-n-700 mb-3">{baseText}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleChangeAnyway()}
              disabled={loadingChangeAnyway}
              className="text-xs text-n-500 hover:text-n-800 underline underline-offset-2 disabled:opacity-50"
            >
              {loadingChangeAnyway ? 'Loading…' : 'Edit'}
            </button>
            <div className="ml-auto flex gap-1.5">
              <button onClick={onPrev} className="px-2.5 py-1 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 transition-colors">
                ← Prev
              </button>
              <button onClick={onNext} className="px-2.5 py-1 rounded-lg border border-n-200 text-xs font-medium text-n-600 hover:bg-n-50 transition-colors">
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Expanded (non-matching, change-anyway, or re-edit)
  const selected = analysis.selected
  const custom = analysis.customText ?? ''

  function pick(val: typeof analysis.selected) {
    setAnalysis(analysisKey, { ...analysis, selected: val })
  }

  function handleApply() {
    const newText =
      selected === 'keep-original' ? null
      : selected === 'r0' ? analysis.rewrites![0]
      : selected === 'r1' ? analysis.rewrites![1]
      : selected === 'r2' ? analysis.rewrites![2]
      : selected === 'custom' ? custom
      // 'original' in re-edit mode means keep the last applied text (editBase), not the Figma text
      : selected === 'original' ? (analysis.editBase ?? null)
      : null

    setAnalysis(analysisKey, { ...analysis, applied: true })

    if (newText && newText !== analysis.originalText) {
      const change: AppliedChange = {
        id: analysis.nodeId,
        frameId: frame.id,
        frameName: frame.name,
        originalText: analysis.originalText,
        newText,
      }
      addAppliedChange(change)

      fetch('/api/vi-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: analysis.nodeId, newText, originalText: analysis.originalText }),
      }).catch(() => {})

      onApplied?.()
    }

    onNext()
  }

  async function handleEdit() {
    const lastAppliedText = getAppliedText(analysis)
    setAnalysis(analysisKey, {
      ...analysis,
      applied: false,
      editBase: lastAppliedText,
      status: 'loading',
      expanded: true,
      rewrites: undefined,
      selected: undefined,
      customText: undefined,
      issue: undefined,
      reason: undefined,
    })
    try {
      const result = await analyzeText(lastAppliedText, voice, claudeKey, frame.name)
      setAnalysis(analysisKey, {
        ...analysis,
        applied: false,
        editBase: lastAppliedText,
        status: 'done',
        matches: result.matches,
        expanded: true,
        reason: result.reason,
        issue: result.issue,
        rewrites: result.rewrites as [string, string, string] | undefined,
        selected: undefined,
        customText: undefined,
      })
    } catch (e: any) {
      setAnalysis(analysisKey, {
        ...analysis,
        applied: false,
        editBase: lastAppliedText,
        status: 'error',
        expanded: true,
        errorMessage: e?.message,
      })
    }
  }

  async function handleRetry() {
    setAnalysis(analysisKey, { ...analysis, status: 'loading' })
    try {
      const result = await analyzeText(baseText, voice, claudeKey, frame.name)
      setAnalysis(analysisKey, {
        ...analysis,
        status: 'done',
        matches: result.matches,
        expanded: false,
        reason: result.reason,
        issue: result.issue,
        rewrites: result.rewrites as [string, string, string] | undefined,
      })
    } catch {
      setAnalysis(analysisKey, { ...analysis, status: 'error' })
    }
  }

  async function handleChangeAnyway() {
    setLoadingChangeAnyway(true)
    try {
      const result = await analyzeText(baseText, voice, claudeKey, frame.name)
      setAnalysis(analysisKey, {
        ...analysis,
        expanded: true,
        matches: result.matches,
        reason: result.reason,
        issue: result.issue ?? 'Voice mismatch',
        rewrites: result.rewrites ?? ['', '', ''] as any,
      })
    } catch {
      setAnalysis(analysisKey, {
        ...analysis,
        expanded: true,
        issue: 'Could not load suggestions',
        rewrites: ['', '', ''] as any,
      })
    } finally {
      setLoadingChangeAnyway(false)
    }
  }

  const canApply = selected === 'r0' || selected === 'r1' || selected === 'r2'
    || selected === 'keep-original'
    || (selected === 'original' && !!analysis.editBase)
    || (selected === 'custom' && custom.trim().length > 0)

  return (
    <div className="rounded-xl bg-white border border-n-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-n-100 flex items-center justify-between">
        <VoicePicker voices={voices} effectiveVoiceId={effectiveVoiceId} onVoiceChange={onVoiceChange} />
      </div>
      <div className="px-4 pt-4 pb-2">
        {analysis.issue && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold mb-1.5">
            <span>⚠</span> {analysis.issue}
          </div>
        )}
        {analysis.reason && (
          <p className="text-xs text-n-500 italic mb-3">{analysis.reason}</p>
        )}
        <p className="text-xs font-semibold text-n-500 uppercase tracking-wide mb-1">
          {analysis.editBase ? 'Editing from' : 'Original'}
        </p>
        <p className="text-sm text-n-700 mb-4 leading-relaxed">{baseText}</p>

        <div className="space-y-2">
          {(analysis.rewrites ?? []).map((r, i) => {
            if (!r) return null
            const key = `r${i}` as 'r0' | 'r1' | 'r2'
            return (
              <label
                key={i}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selected === key ? 'border-n-800 bg-n-50' : 'border-n-200 hover:border-n-300'
                }`}
              >
                <input
                  type="radio"
                  name={analysisKey}
                  className="mt-0.5 shrink-0 accent-n-800"
                  checked={selected === key}
                  onChange={() => pick(key)}
                />
                <span className="text-sm text-n-800 leading-relaxed">{r}</span>
              </label>
            )
          })}

          <label className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
            selected === 'keep-original' ? 'border-n-800 bg-n-50' : 'border-n-200 hover:border-n-300'
          }`}>
            <input
              type="radio"
              name={analysisKey}
              className="mt-0.5 shrink-0 accent-n-800"
              checked={selected === 'keep-original'}
              onChange={() => pick('keep-original')}
            />
            <span className="text-sm text-n-500 italic">Keep original</span>
          </label>

          {analysis.editBase && (
            <label className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
              selected === 'original' ? 'border-n-800 bg-n-50' : 'border-n-200 hover:border-n-300'
            }`}>
              <input
                type="radio"
                name={analysisKey}
                className="mt-0.5 shrink-0 accent-n-800"
                checked={selected === 'original'}
                onChange={() => pick('original')}
              />
              <span className="text-sm text-n-500 italic">Keep current</span>
            </label>
          )}

          <div className={`px-3 py-2.5 rounded-lg border transition-colors ${
            selected === 'custom' ? 'border-n-800 bg-n-50' : 'border-n-200'
          }`}>
            <label className="flex items-center gap-3 cursor-pointer mb-2">
              <input
                type="radio"
                name={analysisKey}
                className="shrink-0 accent-n-800"
                checked={selected === 'custom'}
                onChange={() => pick('custom')}
              />
              <span className="text-xs font-semibold text-n-500 uppercase tracking-wide">Write your own</span>
            </label>
            <textarea
              rows={2}
              value={custom}
              onFocus={() => pick('custom')}
              onChange={e => setAnalysis(analysisKey, { ...analysis, selected: 'custom', customText: e.target.value })}
              placeholder="Type your rewrite…"
              className="w-full text-sm px-2 py-1.5 rounded border border-n-200 bg-white resize-none focus:outline-none focus:border-n-400 placeholder:text-n-400"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-n-100 flex justify-end">
        <button
          onClick={handleApply}
          disabled={!canApply}
          className="px-4 py-2 rounded-lg bg-n-800 text-white text-sm font-semibold disabled:opacity-40 hover:bg-n-700 transition-colors"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function getAppliedText(analysis: Analysis): string {
  const s = analysis.selected
  if (s === 'r0') return analysis.rewrites?.[0] ?? ''
  if (s === 'r1') return analysis.rewrites?.[1] ?? ''
  if (s === 'r2') return analysis.rewrites?.[2] ?? ''
  if (s === 'custom') return analysis.customText ?? ''
  // 'original' in re-edit mode means keep the last applied text (editBase)
  return analysis.editBase ?? analysis.originalText
}
