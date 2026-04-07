/**
 * Security Gate — input sanitizer and output validator.
 *
 * Lightweight guardrail layer for any AI call that processes
 * external/untrusted content. Strips known prompt injection patterns
 * and validates LLM output before returning to users.
 *
 * Usage:
 *   import { sanitize, validateOutput } from '@/lib/security-gate'
 *
 *   // Before sending untrusted content to an LLM:
 *   const { sanitized, flagged, detections } = sanitize(userInput)
 *   if (flagged) console.warn('Injection attempt detected:', detections)
 *
 *   // After receiving LLM output:
 *   const { valid, warnings } = validateOutput(llmResponse)
 */

// ── Input Sanitizer ─────────────────────────────────────────────────

interface Detection {
  pattern: string
  severity: 'low' | 'medium' | 'high'
  match: string
}

interface SanitizeResult {
  sanitized: string
  flagged: boolean
  detections: Detection[]
}

const PATTERNS: Array<{ regex: RegExp; name: string; severity: 'low' | 'medium' | 'high'; strip: boolean }> = [
  // High: direct instruction hijacking
  { regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/gi, name: 'instruction_override', severity: 'high', strip: true },
  { regex: /you\s+are\s+now\s+(a|an|the|in)\s+/gi, name: 'role_hijack', severity: 'high', strip: true },
  { regex: /\b(system\s*prompt|system\s*message)\s*[:=]/gi, name: 'system_prompt_injection', severity: 'high', strip: true },
  { regex: /\[SYSTEM\]|\[INST\]|\[\/INST\]|<\|system\|>|<\|user\|>|<\|assistant\|>/gi, name: 'chat_template_injection', severity: 'high', strip: true },
  { regex: /\bDAN\b.*\bmode\b|\bDo\s+Anything\s+Now\b/gi, name: 'dan_jailbreak', severity: 'high', strip: true },
  { regex: /\bjailbreak\b|\benable\s+developer\s+mode\b/gi, name: 'explicit_jailbreak', severity: 'high', strip: true },
  // Medium: encoding/obfuscation
  { regex: /&#x?[0-9a-fA-F]+;(?:&#x?[0-9a-fA-F]+;){5,}/g, name: 'html_entity_obfuscation', severity: 'medium', strip: true },
  { regex: /\b(call|invoke|execute|run|use)\s+(the\s+)?(tool|function|api)\b/gi, name: 'tool_invocation', severity: 'medium', strip: true },
  // Low: suspicious framing
  { regex: /\b(pretend|imagine|roleplay)\b/gi, name: 'roleplay_framing', severity: 'low', strip: false },
  { regex: /\bfor\s+(educational|research|testing)\s+purposes?\b/gi, name: 'purpose_framing', severity: 'low', strip: false },
]

/**
 * Sanitize untrusted input before sending to any LLM.
 */
export function sanitize(input: string): SanitizeResult {
  const detections: Detection[] = []
  let sanitized = input

  for (const p of PATTERNS) {
    p.regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = p.regex.exec(input)) !== null) {
      detections.push({ pattern: p.name, severity: p.severity, match: match[0].slice(0, 80) })
      if (p.strip) sanitized = sanitized.replace(match[0], '[REDACTED]')
    }
  }

  return { sanitized, flagged: detections.some(d => d.severity === 'high'), detections }
}

// ── Output Validator ────────────────────────────────────────────────

interface OutputValidation {
  valid: boolean
  warnings: Array<{ type: string; severity: 'low' | 'medium' | 'high'; message: string }>
}

/**
 * Validate LLM output before returning to users.
 */
export function validateOutput(output: string): OutputValidation {
  const warnings: OutputValidation['warnings'] = []

  if (/\{"(name|function|tool_call)":\s*"/.test(output)) {
    warnings.push({ type: 'embedded_tool_call', severity: 'high', message: 'Output contains embedded tool call JSON' })
  }
  if (/(system\s*prompt|your\s+instructions\s+are)/i.test(output)) {
    warnings.push({ type: 'instruction_leak', severity: 'high', message: 'Output may contain leaked system instructions' })
  }
  if (/!\[.*\]\(https?:\/\//.test(output) && /\?.*=/.test(output)) {
    warnings.push({ type: 'markdown_exfil', severity: 'medium', message: 'Markdown image with query params (possible tracking pixel)' })
  }

  return { valid: !warnings.some(w => w.severity === 'high'), warnings }
}
