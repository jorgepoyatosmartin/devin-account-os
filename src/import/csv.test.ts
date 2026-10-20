import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'
import { CsvImportProvider, getImportPreset, mapCsvRow } from './providers'

describe('parseCsv', () => {
  it('parses quoted commas, escaped quotes and newlines', () => {
    const parsed = parseCsv('Name,Notes\n"Lee, Sam","He said ""hello""\nand left"')
    expect(parsed.headers).toEqual(['Name', 'Notes'])
    expect(parsed.rows).toEqual([{ Name: 'Lee, Sam', Notes: 'He said "hello"\nand left' }])
  })

  it('detects semicolons and trims headers', () => {
    expect(parseCsv(' First Name ; Company Name \n Ana ; Acme ').rows).toEqual([
      { 'First Name': ' Ana ', 'Company Name': ' Acme ' },
    ])
  })

  it('removes a UTF-8 BOM and detects tab-delimited files', () => {
    const parsed = parseCsv('\uFEFFFirst Name\tLast Name\nAlex\tMorgan')
    expect(parsed.headers).toEqual(['First Name', 'Last Name'])
    expect(parsed.rows[0]).toEqual({ 'First Name': 'Alex', 'Last Name': 'Morgan' })
  })

  it('provides an enrichment provider over CSV people', () => {
    const provider = new CsvImportProvider(
      'First Name,Last Name,Job Title,Email\nAlex,Morgan,Director,alex@example.test',
      getImportPreset('lusha', 'stakeholders'),
      'mapfre',
    )
    const [person] = provider.findPeople('mapfre', 'morgan')
    expect(person).toMatchObject({ name: 'Alex Morgan', title: 'Director', email: 'alex@example.test' })
    expect(provider.enrich(person)).toEqual(person)
    expect(provider.findPeople('other-account', '').length).toBe(0)
  })

  it('resolves aliases without case or accent sensitivity', () => {
    expect(mapCsvRow({ 'JOB Títle': 'Director', 'Work EMAIL': 'a@example.test' }, getImportPreset('lusha', 'stakeholders')))
      .toMatchObject({ title: 'Director', email: 'a@example.test' })
  })
})
