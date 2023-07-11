/* eslint-disable no-case-declarations */

import path from 'node:path'
import fs from 'fs-extra'
import knex from 'knex'
import camelCase from 'camelcase'

function getType(descType: Desc['Type'], descNull: Desc['Null'], config: Config) {
  const isNullish = config.nullish && config.nullish === true
  const isRequiredString = config.requiredString && config.requiredString === true
  const type = descType.split('(')[0].split(' ')[0]
  const isNull = descNull === 'YES'
  const string = ['z.string()']
  const number = ['z.number()']
  const nullable = isNullish ? 'nullish()' : 'nullable()'
  const nonnegative = 'nonnegative()'
  const min1 = 'min(1)'
  switch (type) {
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'time':
    case 'year':
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

  const isCamelCase = config.camelCase && config.camelCase === true

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

    if (isCamelCase)
      typeName = camelCase(typeName)
    let content = `import z from 'zod'

export const ${typeName} = z.object({`
    for (const desc of describes) {
      const field = isCamelCase ? camelCase(desc.Field) : desc.Field
      const type = getType(desc.Type, desc.Null, config)
      content = `${content}
  ${field}: ${type},`
    }
    content = `${content}
})

export type ${camelCase(`${typeName}Type`)} = z.infer<typeof ${typeName}>
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
  camelCase?: boolean
  nullish?: boolean
  requiredString?: boolean
  modify?: string[][]
}
