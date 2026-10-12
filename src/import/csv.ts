export type ParsedCsv = {
  headers: string[]
  rows: Record<string, string>[]
}

const DELIMITERS = [',', ';', '\t'] as const

function headerDelimiterCount(text: string, delimiter: string): number {
  let count = 0
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') index += 1
      else quoted = !quoted
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break
    } else if (!quoted && char === delimiter) {
      count += 1
    }
  }
  return count
}

function detectDelimiter(text: string): string {
  return DELIMITERS.reduce((best, delimiter) => (
    headerDelimiterCount(text, delimiter) > headerDelimiterCount(text, best) ? delimiter : best
  ), ',')
}

function recordsFromCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      quoted = true
    } else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      record.push(field)
      if (record.some((value) => value.length > 0)) records.push(record)
      record = []
      field = ''
      if (char === '\r' && text[index + 1] === '\n') index += 1
    } else {
      field += char
    }
  }

  record.push(field)
  if (record.some((value) => value.length > 0)) records.push(record)
  return records
}

export function parseCsv(text: string): ParsedCsv {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  if (!source) return { headers: [], rows: [] }
  const records = recordsFromCsv(source, detectDelimiter(source))
  const headers = (records.shift() ?? []).map((header) => header.trim())
  const rows = records
    .filter((record) => record.some((value) => value.trim().length > 0))
    .map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])))
  return { headers, rows }
}
