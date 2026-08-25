import { marked } from 'marked'
import type { TemplateContentMode } from './types'

export const EMAIL_LIMITS = {
  maxRecipients: 50,
  maxTemplateChars: 500_000,
  maxVariables: 100,
  maxVariableValueChars: 50_000
} as const

type TemplateVariables = Record<string, unknown>

export type CompiledEmail = {
  subject: string
  html: string
  text: string
  variableNames: string[]
}

export function normalizeEscapedNewlines(value: string): string {
  return value
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\n')
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#039;')
}

function getVariable(variables: TemplateVariables, path: string): string {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    return Object.prototype.hasOwnProperty.call(current, key)
      ? (current as Record<string, unknown>)[key]
      : undefined
  }, variables)

  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

function interpolate(
  template: string,
  variables: TemplateVariables,
  options: { escape: boolean, singleLine?: boolean }
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    let value = getVariable(variables, key)
    if (options.singleLine) value = value.replace(/[\r\n]+/g, ' ').trim()
    return options.escape ? escapeHtml(value) : value
  })
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', '\'')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractVariableNames(...templates: Array<string | null | undefined>): string[] {
  const names = new Set<string>()
  for (const template of templates) {
    if (!template) continue
    for (const match of template.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
      if (match[1]) names.add(match[1])
    }
  }
  return [...names].sort()
}

export function templateSourceToHtml(
  contentMode: TemplateContentMode,
  source: string
): string {
  const normalizedSource = normalizeEscapedNewlines(source)
  return contentMode === 'markdown'
    ? marked.parse(normalizedSource, { async: false, gfm: true, breaks: true })
    : normalizedSource
}

export function compileEmailTemplate(input: {
  subjectTemplate: string
  contentMode: TemplateContentMode
  htmlTemplate: string
  textTemplate?: string | null
  variables?: TemplateVariables
}): CompiledEmail {
  const variables = input.variables ?? {}
  const subject = interpolate(normalizeEscapedNewlines(input.subjectTemplate), variables, {
    escape: false,
    singleLine: true
  })
  const htmlSource = templateSourceToHtml(input.contentMode, input.htmlTemplate)
  const html = interpolate(htmlSource, variables, { escape: true })
  const text = input.textTemplate
    ? interpolate(normalizeEscapedNewlines(input.textTemplate), variables, { escape: false })
    : htmlToPlainText(html)

  return {
    subject,
    html,
    text,
    variableNames: extractVariableNames(
      input.subjectTemplate,
      input.htmlTemplate,
      input.textTemplate
    )
  }
}

export function createSafePreviewDocument(html: string): string {
  const csp = [
    'default-src \'none\'',
    'img-src data: cid:',
    'style-src \'unsafe-inline\'',
    'font-src data:',
    'form-action \'none\'',
    'base-uri \'none\'',
    'frame-ancestors \'none\''
  ].join('; ')

  const head = html.match(/<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i)?.[1]
    ?.replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, '')
    .replace(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '') ?? ''
  const body = html.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body>/i)?.[1]
    ?? html
      .replace(/<!doctype[^>]*>/gi, '')
      .replace(/<head(?:\s[^>]*)?>[\s\S]*?<\/head>/gi, '')
      .replace(/<\/?html(?:\s[^>]*)?>/gi, '')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root { color-scheme: light; }
    html { background: #f8fafc; }
    body {
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
      font-size: 16px;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }
    img { max-width: 100%; height: auto; }
    table { max-width: 100%; }
  </style>
  ${head}
</head>
<body>${body}</body>
</html>`
}
