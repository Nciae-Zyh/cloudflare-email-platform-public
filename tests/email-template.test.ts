import { describe, expect, it } from 'vitest'
import {
  compileEmailTemplate,
  createSafePreviewDocument,
  extractVariableNames,
  htmlToPlainText,
  normalizeEscapedNewlines,
  templateSourceToHtml
} from '../shared/email-template'

describe('email template compiler', () => {
  it('escapes variables before inserting them into HTML', () => {
    const result = compileEmailTemplate({
      subjectTemplate: 'Hello {{name}}',
      contentMode: 'html',
      htmlTemplate: '<h1>Hello {{name}}</h1>',
      variables: { name: '<script>alert(1)</script>' }
    })

    expect(result.subject).toBe('Hello <script>alert(1)</script>')
    expect(result.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(result.html).not.toContain('<script>')
  })

  it('renders Markdown and creates a plain-text fallback', () => {
    const result = compileEmailTemplate({
      subjectTemplate: 'Order {{order.id}}',
      contentMode: 'markdown',
      htmlTemplate: '# Done\n\nOrder **{{order.id}}** is ready.',
      variables: { order: { id: 'A-100' } }
    })

    expect(result.html).toContain('<h1>Done</h1>')
    expect(result.html).toContain('<strong>A-100</strong>')
    expect(result.text).toContain('Order A-100 is ready.')
  })

  it('repairs escaped newlines in legacy Markdown before rendering', () => {
    const result = compileEmailTemplate({
      subjectTemplate: 'Welcome {{user.name}}',
      contentMode: 'markdown',
      htmlTemplate: '# Welcome, {{user.name}}\\n\\nRequest **{{request.id}}** is done.',
      variables: {
        user: { name: 'Example' },
        request: { id: 'REQ-1' }
      }
    })

    expect(result.html).toContain('<h1>Welcome, Example</h1>')
    expect(result.html).toContain('<p>Request <strong>REQ-1</strong> is done.</p>')
    expect(result.html).not.toContain('\\n')
  })

  it('converts a legacy Markdown source to editable HTML without removing variables', () => {
    const html = templateSourceToHtml(
      'markdown',
      '# Welcome {{user.name}}\\n\\nUse **{{request.id}}**.'
    )

    expect(html).toContain('<h1>Welcome {{user.name}}</h1>')
    expect(html).toContain('<strong>{{request.id}}</strong>')
  })

  it('leaves real multiline HTML intact while repairing legacy escaped text', () => {
    expect(normalizeEscapedNewlines('<p>One</p>\\n<p>Two</p>'))
      .toBe('<p>One</p>\n<p>Two</p>')
    expect(normalizeEscapedNewlines('<p>One</p>\n<p>Two</p>'))
      .toBe('<p>One</p>\n<p>Two</p>')
  })

  it('extracts sorted unique variable paths', () => {
    expect(extractVariableNames(
      'Hi {{user.name}}',
      '{{order.id}} / {{user.name}}'
    )).toEqual(['order.id', 'user.name'])
  })

  it('creates a sandbox preview document that blocks network resources', () => {
    const preview = createSafePreviewDocument('<p>Hello</p>')
    expect(preview).toContain('default-src \'none\'')
    expect(preview).toContain('form-action \'none\'')
    expect(preview).toContain('<p>Hello</p>')
  })

  it('previews a complete HTML document without nesting a second document', () => {
    const preview = createSafePreviewDocument(
      '<!doctype html><html><head><style>p{color:red}</style><meta http-equiv="refresh" content="0;url=https://example.com"><script>alert(1)</script></head><body><p>Hello</p></body></html>'
    )

    expect(preview.match(/<!doctype html>/gi)).toHaveLength(1)
    expect(preview).toContain('<style>p{color:red}</style>')
    expect(preview).toContain('<body><p>Hello</p></body>')
    expect(preview).not.toContain('http-equiv="refresh"')
    expect(preview).not.toContain('<script>')
  })

  it('converts common HTML blocks to readable text', () => {
    expect(htmlToPlainText('<h1>Hello</h1><p>One<br>Two</p>')).toBe('Hello\nOne\nTwo')
  })
})
