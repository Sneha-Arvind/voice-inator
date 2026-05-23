import { useState } from 'react'
import { useApp } from '../App'

export default function ChangesDrawer() {
  const { appliedChanges } = useApp()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const realChanges = appliedChanges.filter(c => c.newText !== c.originalText)

  if (realChanges.length === 0) return null

  function copyText(id: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function copyAll() {
    const content = realChanges
      .map(c => `[${c.frameName}]\nOriginal: ${c.originalText}\nNew: ${c.newText}`)
      .join('\n\n')
    navigator.clipboard.writeText(content)
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="shrink-0 border-t border-n-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-n-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-n-800">Changes Applied</span>
          <span className="px-2 py-0.5 rounded-full bg-n-800 text-white text-xs font-bold">
            {realChanges.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={e => { e.stopPropagation(); copyAll() }}
            className="text-xs text-n-500 hover:text-n-800 font-medium"
          >
            {copied === 'all' ? '✓ Copied all' : 'Copy all'}
          </button>
          <span className="text-n-400 text-sm">{open ? '▼' : '▲'}</span>
        </div>
      </button>

      {/* List */}
      {open && (
        <div className="max-h-48 overflow-y-auto divide-y divide-n-100">
          {realChanges.map(c => (
            <div key={c.id} className="flex items-start gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-n-500 font-medium mb-1">{c.frameName}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-n-500 truncate max-w-[180px]">"{c.originalText}"</span>
                  <span className="text-n-400 shrink-0">→</span>
                  <span className="text-n-800 font-medium truncate max-w-[180px]">"{c.newText}"</span>
                </div>
              </div>
              <button
                onClick={() => copyText(c.id, c.newText)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-n-200 text-n-600 hover:border-n-400 hover:text-n-800 transition-colors"
              >
                {copied === c.id ? '✓' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
