import type { Voice } from '../types'

const API = 'https://api.anthropic.com/v1/messages'

function systemPrompt(voice: Voice): string {
  const parts: string[] = [
    `You are a brand voice specialist. Evaluate UI copy against a specific brand voice, then rewrite it when it fails.`,
    ``,
  ]

  // Examples lead — they are the primary reference, not supplementary
  if (voice.moreLike) {
    parts.push(
      `═══════════════════════════════`,
      `ON-VOICE EXAMPLES  (primary reference)`,
      `═══════════════════════════════`,
      `These ARE the ${voice.name} voice. Before evaluating anything, extract the patterns here:`,
      `characteristic vocabulary, sentence rhythm, energy level, what they lean into, what they never say.`,
      ``,
      voice.moreLike,
      ``,
    )
  }

  if (voice.lessLike) {
    parts.push(
      `═══════════════════════════════`,
      `OFF-VOICE EXAMPLES  (forbidden territory)`,
      `═══════════════════════════════`,
      `These define what ${voice.name} is NOT.`,
      `This vocabulary, structure, and energy must never appear in rewrites — not even loosely.`,
      ``,
      voice.lessLike,
      ``,
    )
  }

  // Description is supporting context, not the primary signal
  parts.push(
    `═══════════════════════════════`,
    `VOICE DESCRIPTION  (supporting context)`,
    `═══════════════════════════════`,
    `Voice: ${voice.name}`,
  )
  if (voice.description) {
    parts.push(
      voice.description,
      ``,
      `The description provides background. The examples above are the authoritative reference.`,
      `When they conflict, trust the examples over the description.`,
    )
  }
  parts.push(``)

  parts.push(
    `═══════════════════════════════`,
    `EVALUATION RULES`,
    `═══════════════════════════════`,
    `FAIL the text if it:`,
    `  • Is generic, safe, or neutral enough to belong to any brand`,
    `  • Uses vocabulary, rhythm, or structure from the off-voice examples`,
    `  • Doesn't actively carry the energy and word choice of the on-voice examples`,
    `PASS only if the text would feel natural sitting next to the on-voice examples.`,
    ``,
    `═══════════════════════════════`,
    `REWRITE RULES  (when text fails)`,
    `═══════════════════════════════`,
    `  • Root each rewrite in a concrete pattern from the on-voice examples:`,
    `    a rhythm, a vocabulary move, a structural choice, a specific energy level`,
    `  • Three rewrites — three structurally different angles:`,
    `    e.g. one reframes the concept, one borrows a phrase rhythm, one maximises the voice's characteristic energy`,
    `  • Vocabulary and patterns from the off-voice examples are banned from rewrites`,
    `  • Match the element type: buttons are short and active, headings punch, body copy can breathe`,
    `  • Don't describe the voice — embody it`,
    ``,
    `Return ONLY valid JSON — no explanation, no markdown, no code fences.`,
  )

  return parts.join('\n')
}

function userMessage(text: string, frameName: string, voiceName: string): string {
  return [
    `Screen: "${frameName}"`,
    `UI text to evaluate: "${text}"`,
    ``,
    `Compare this text against the on-voice examples for ${voiceName} — those are your primary reference, not the description.`,
    `Infer the UI element type from context (button, heading, body copy, label, error, etc.) and keep rewrites length-appropriate.`,
    ``,
    `Return exactly one of:`,
    `{"matches":true,"reason":"≤8 words naming the specific voice quality present"}`,
    `{"matches":false,"issue":"3–5 word diagnosis of what's off","reason":"one sentence — which voice quality is absent or wrong","rewrites":["rewrite rooted in on-voice pattern","rewrite rooted in on-voice pattern","rewrite rooted in on-voice pattern"]}`,
    ``,
    `Each rewrite must sound unmistakably like the on-voice examples and take a structurally different angle than the other two.`,
  ].join('\n')
}

export async function analyzeText(
  text: string,
  voice: Voice,
  apiKey: string,
  frameName: string,
  signal?: AbortSignal
): Promise<{ matches: boolean; reason?: string; issue?: string; rewrites?: [string, string, string] }> {
  // 30-second timeout so stuck requests surface as retryable errors instead of hanging forever
  const timeoutSignal = AbortSignal.timeout(30_000)
  const effectiveSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [{ type: 'text', text: systemPrompt(voice), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage(text, frameName, voice.name) }],
    }),
    signal: effectiveSignal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude error ${res.status}`)
  }

  const data = await res.json()
  const raw = data.content?.[0]?.text ?? ''
  console.log('[claude] raw response:', raw)
  try {
    // Extract the first {...} block in case Claude wraps the JSON in extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON object found')
    return JSON.parse(jsonMatch[0])
  } catch {
    console.warn('[claude] parse failed, raw was:', raw)
    return { matches: false, issue: 'Could not parse response', reason: 'Analysis failed — try again' }
  }
}
