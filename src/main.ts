/* eslint-disable key-spacing */
/* eslint-disable no-case-declarations */
/* eslint-disable no-multi-spaces */

import path from 'node:path'
import fs from 'fs-extra'
import knex from 'knex'
import type { Options as camelCaseOptions } from 'camelcase'
import camelCase from 'camelcase'

function getType(descType: Desc['Type'], descNull: Desc['Null'], config: Config) {
  const isNullish = config.nullish && config.nullish === true
  const isRequiredString = config.requiredString && config.requiredString === true
  const type = descType.split('(')[0].split(' ')[0]
  const isNull = descNull === 'YES'
  const string = ['z.string()']
  const number = ['z.number()']
  const date = ['z']
  const nullable = isNullish ? 'nullish()' : 'nullable()'
  const nonnegative = 'nonnegative()'
  const min1 = 'min(1)'
  let useDate = (config.datetime?.useDate && config.datetime.useDate) || false
  let useIso = (config.datetime?.useIso && config.datetime.useIso) || false
  if (useDate && useIso) {
    useDate = false
    useIso = false
  }
  const dateCoerce = useDate && (config.datetime?.coerce || false)
  const minDate = (useDate && config.datetime?.minDate) || undefined
  const maxDate = (useDate && config.datetime?.maxDate) || undefined
  const dateIsoOffset = useIso && (config.datetime?.offset || false)
  const dateIsoPrecision = useIso && config.datetime?.precision &&
    config.datetime.precision >= 0 && config.datetime.precision <= 6 ? config.datetime.precision : undefined



  const dateAsZodDate = (type: string): string => {
    if (!useDate)
      return ''
    if (dateCoerce) {
      date.push('coerce')
    }
    date.push('date()')

    if (minDate !== undefined) {
      date.push(`min(new Date('${minDate}'))`)
    }
    if (maxDate !== undefined) {
      date.push(`max(new Date('${maxDate}'))`)
    }
    return date.join('.')
  }

  const generateDate = (type: string): string => {
    
    if (dateCoerce) {
      date.push('coerce')
    }
    if (useDate)
      return dateAsZodDate(type)

    return string.join('.') // default string with no date params
  }

  const generateDateTime = (type: string): string => {
    const dateIsoOptions: string[] = []
    // return value might be z.coerce.date(), z.date() or z.string().datetime()

    if (useDate)
      return generateDate(type)

    if (useIso) {
      let optionsString = ''
      if (dateIsoOffset)
        dateIsoOptions.push(`offset: ${dateIsoOffset}`)
      if (dateIsoPrecision !== undefined)
        dateIsoOptions.push(`precision: ${dateIsoPrecision}`)
      if (dateIsoOptions.length > 0)
        optionsString = `{${dateIsoOptions.join(',')}}`

      string.push(`datetime(${optionsString})`)
      return string.join('.')
    }

    return string.join('.') // default string with no date params
  }

  const generateYear = (type: string): string => {
    const dateIsoOptions: string[] = []
    // return value might be z.coerce.date(), z.date() or z.string().datetime()

    if (useDate)
      return generateDate(type)

    if (useIso) {
      let optionsString = ''
      if (dateIsoOffset)
        dateIsoOptions.push(`offset: ${dateIsoOffset}`)
      if (dateIsoPrecision !== undefined)
        dateIsoOptions.push(`precision: ${dateIsoPrecision}`)
      if (dateIsoOptions.length > 0)
        optionsString = `{${dateIsoOptions.join(',')}}`

      string.push(`datetime(${optionsString})`)
      return string.join('.')
    }

    return string.join('.') // default string with no date params
  }

  switch (type) {
    case 'date':
      return generateDate(type)
    case 'datetime':
      return generateDateTime(type)
    case 'timestamp':
      return generateDateTime(type)
    case 'time':
      return generateDateTime(type)
    case 'year':
      return generateYear(type)
    case 'char':
    case 'varchar':
    case 'tinytext':
    case 'text':
    case 'mediumtext':
    case 'longtext':
    case 'json':
    case 'decimal':
      if (isNull)
        string.push(nullable)
      else if (isRequiredString)
        string.push(min1)
      return string.join('.')
    case 'tinyint':
    case 'smallint':
    case 'mediumint':
    case 'int':
    case 'bigint':
    case 'float':
    case 'double':
      const unsigned = descType.endsWith(' unsigned')
      if (unsigned)
        number.push(nonnegative)
      if (isNull)
        number.push(nullable)
      return number.join('.')
    case 'enum':
      const value = descType.replace('enum(', '').replace(')', '').replace(/,/g, ', ')
      return `z.enum([${value}])`
  }
}

export async function generate(config: Config) {
  const db = knex({
    client: 'mysql2',
    connection: {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    },
  })

  const isCamelCase = config.camelCase !== undefined && config.camelCase !== false // object or true = true

  const camelCaseText = (text: string) => {
    if (!isCamelCase)
      return text
    return camelCase(text, typeof config.camelCase !== 'boolean' ? config.camelCase : undefined)
  }

  const t = await db.raw('SELECT table_name as table_name FROM information_schema.tables WHERE table_schema = ?', [config.database])
  let tables = t[0].map((row: any) => row.table_name).filter((table: string) => !table.startsWith('knex_')).sort() as Tables

  const allIncludedTables = config.tables
  const includedTablesRegex = allIncludedTables?.filter((includeString) => {
    const isPattern
      = includeString.startsWith('/') && includeString.endsWith('/')
    return isPattern
  })
  const includedTableNames = allIncludedTables?.filter(
    table => includedTablesRegex?.includes(table),
  )

  if (includedTableNames && includedTableNames.length) {
    tables = tables.filter((table) => {
      if (includedTableNames.includes(table))
        return true
      let useTable = false
      if (includedTablesRegex && includedTablesRegex.length) {
        includedTablesRegex.forEach((text) => {
          const pattern = text.substring(1, text.length - 1)
          if (table.match(pattern) !== null)
            useTable = true
        })
      }
      return useTable
    })
  }

  const allIgnoredTables = config.ignore
  const ignoredTablesRegex = allIgnoredTables?.filter((ignoreString) => {
    const isPattern
      = ignoreString.startsWith('/') && ignoreString.endsWith('/')
    return isPattern
  })
  const ignoredTableNames = allIgnoredTables?.filter(
    table => !ignoredTablesRegex?.includes(table),
  )

  if (ignoredTableNames && ignoredTableNames.length)
    tables = tables.filter(table => !ignoredTableNames.includes(table))

  if (ignoredTablesRegex && ignoredTablesRegex.length) {
    tables = tables.filter((table) => {
      let useTable = true
      ignoredTablesRegex.forEach((text) => {
        const pattern = text.substring(1, text.length - 1)
        if (table.match(pattern) !== null)
          useTable = false
      })
      return useTable
    })
  }

  const tableNameModifications = config.modify
  for (const table of tables) {
    const d = await db.raw(`DESC ${table}`)
    const describes = d[0] as Desc[]

    let typeName = table
    if (tableNameModifications && tableNameModifications.length) {
      typeName = tableNameModifications.reduce(
        (modified, currentFromTo) => {
          const isPatternFrom
            = currentFromTo[0].startsWith('/')
            && currentFromTo[0].endsWith('/')
          if (isPatternFrom) {
            const fromPattern = currentFromTo[0].substring(1, currentFromTo[0].length - 1)
            if (modified.match(fromPattern) !== null)
              modified = modified.replace(new RegExp(fromPattern), currentFromTo[1])
          }
          else {
            modified = modified.replace(currentFromTo[0], currentFromTo[1])
          }
          return modified
        },
        typeName,
      )
    }

    typeName = camelCaseText(typeName)
    let content = `import z from 'zod'

export const ${typeName} = z.object({`
    for (const desc of describes) {
      const field = isCamelCase ? camelCase(desc.Field) : desc.Field // still camelCased, not PascalCased
      const type = getType(desc.Type, desc.Null, config)
      content = `${content}
  ${field}: ${type},`
    }
    content = `${content}
})

export type ${camelCaseText(`${typeName}Type`)} = z.infer<typeof ${typeName}>
`
    const dir = (config.folder && config.folder !== '') ? config.folder : '.'
    const file = (config.suffix && config.suffix !== '') ? `${typeName}.${config.suffix}.ts` : `${typeName}.ts`
    const dest = path.join(dir, file)
    console.log('Created:', dest)
    fs.outputFileSync(dest, content)
  }
  await db.destroy()
}

type Tables = string[]
interface Desc {
  Field: string
  Type: string
  Null: 'YES' | 'NO'
}
export interface Config {
  host: string
  port: number
  user: string
  password: string
  database: string
  tables?: string[]
  ignore?: string[]
  folder?: string
  suffix?: string
  camelCase?: boolean | camelCaseOptions
  nullish?: boolean
  requiredString?: boolean
  modify?: string[][],
  datetime?: {
    useDate?: boolean,
    useIso?: boolean,
    coerce?: boolean,
    offset?: boolean,
    precision?: number,
    minDate?: string,
    maxDate?: string,
    year?: string
  }
}
