export type Voice = {
  id: string
  name: string
  description: string
  moreLike: string
  lessLike: string
}

export type FigmaFrame = {
  id: string
  name: string
}

export type FigmaTextNode = {
  id: string
  characters: string
}

export type Analysis = {
  nodeId: string
  originalText: string     // always the original Figma text, never mutated
  editBase?: string        // set when re-editing an applied card; becomes the "original" shown in the UI
  status: 'loading' | 'done' | 'error'
  matches: boolean
  expanded: boolean        // true if "Change anyway" was clicked on a matching card
  reason?: string
  issue?: string
  errorMessage?: string      // actual API error, shown in error state
  rewrites?: [string, string, string]
  selected?: 'r0' | 'r1' | 'r2' | 'original' | 'custom' | 'keep-original'
  customText?: string
  applied?: boolean
}

export type AppliedChange = {
  id: string               // nodeId
  frameId: string
  frameName: string
  originalText: string
  newText: string
}
