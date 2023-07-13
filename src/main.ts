/* eslint-disable key-spacing */
/* eslint-disable no-case-declarations */
/* eslint-disable no-multi-spaces */

import path from 'node:path'
import fs from 'fs-extra'
import knex, { Knex } from 'knex'
import type { Options as camelCaseOptions } from 'camelcase'
import camelCase from 'camelcase'

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
  modify?: string[][]
}

type schemaContextType = {
  config: Config,
  db: Knex<any, unknown[]>,
  tables: Tables
}

let context = {} as schemaContextType

export async function generate(config: Config) {
  try {
    context.config = config
    await getDbConnection()
    await identifyTables()
    await processAllTables()
    generateExternalSchema()
  } catch (error) {
    console.dir({ "MySQL-Zod Error": error })
  } finally {
    if (context.db)
      await context.db.destroy()
  }
}

async function getDbConnection() {
  const config = context.config
  context.db = knex({
    client: 'mysql2',
    connection: {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    },
  })
}

async function identifyTables() {
  const tableList = await context.db.raw('SELECT table_name as table_name FROM information_schema.tables WHERE table_schema = ?', [context.config.database])
  context.tables = tableList[0].map((row: any) => row.table_name).filter((table: string) => !table.startsWith('knex_')).sort() as Tables
  getWantedTables()
  avoidUnwantedTables()
}

async function processAllTables() {
  for (const table of context.tables) {
    const d = await context.db.raw(`DESC ${table}`)
    const describes = d[0] as Desc[]
    processTable(table, describes)
  }
}

const processTable = (table: string, describes: Desc[]) => {
  const typeName = camelCaseText(modifyTypeName(table))
  let content = `import z from 'zod'

export const ${typeName} = z.object({${getSchemaForFields(describes)}
})

export type ${camelCaseText(`${typeName}Type`)} = z.infer<typeof ${typeName}>
`

  writeFile(typeName, content)
}

const getType = (descType: Desc['Type'], descNull: Desc['Null']) => {
  const isNullish = context.config.nullish && context.config.nullish === true
  const isRequiredString = context.config.requiredString && context.config.requiredString === true
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
const writeFile = (typeName: string, content: string) => {
  const dir = (context.config.folder && context.config.folder !== '') ? context.config.folder : '.'
  const file = (context.config.suffix && context.config.suffix !== '') ? `${typeName}.${context.config.suffix}.ts` : `${typeName}.ts`
  const dest = path.join(dir, file)
  console.log('Created:', dest)
  fs.outputFileSync(dest, content)
}

const generateExternalSchema = () => {

  const imports = `import z from 'zod'`

  const schemaDate = `
    export const schemaDate = z.string()
    .refine(value => {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return false; // value is not a valid date
      }
      const [year, month, day] = value.split('-').map(Number);
      return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
    }, { message: "Invalid DATE value." })
    .transform(z.date(), value => new Date(value));
  `

  const schemaDateTime = `
  export const schemaDateTime = z.string()
  .refine(value => {
    // Test datetime string format
    if (!/^(\\d{4})-(\\d{2})-(\\d{2})(?: (\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,6}))?)?$/.test(value)) {
      return false;
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return false; // value is not a valid datetime
    }
    const [year, month, day] = value.split(' ')[0].split('-').map(Number);
    return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }, { message: "Invalid DATETIME value." })
  .transform(z.date(), value => new Date(value));
`

  const schemaTimeStamp = `
  const schemaTimeStamp = z.string()
    .refine(value => {
      // Test datetime string format
      if (!/^(\\d{4})-(\\d{2})-(\\d{2})(?: (\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,6}))?)?$/.test(value)) {
        return false;
      }
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return false; // value is not a valid datetime
      }
      const timestamp = date.getTime();
      // '1970-01-01 00:00:01' UTC to '2038-01-19 03:14:07' UTC in milliseconds
      return timestamp >= 1000 && timestamp <= 2147483647000;
    }, { message: "Invalid TIMESTAMP value." })
    .transform(z.date(), value => new Date(value));
`

  const schemaYear = `
  const schemaYear = z.string()
    .refine(value => {
      if (value === '0000') return true;
      const num = Number(value);
      return num >= 1901 && num <= 2155;
    }, { message: "Invalid YEAR value." })
    .transform(z.number(), value => value === '0000' ? 0 : Number(value));
`

  const schemaTests = `
const schemaTests = () => {
  schemaTest(schemaDate,
    ['1000-01-01', '9999-12-31', '0000-01-01', '10000-01-01', '2023-02-30', 'abc']
  );
  schemaTest(schemaDateTime,
    ['1000-01-01', '9999-12-31', '0000-01-01', '10000-01-01', '2023-02-30', 'abc', '2023-07-01 12:00:00', '2023-07-01 24:00:00', '2023-07-01 12:60:00', '2023-07-01 12:00:60', '2023-07-01 12:00:00.123456', '2023-07-01 12:00:00.1234567']
  );
  schemaTest(schemaTimeStamp,
    ['1970-01-01 00:00:01', '2038-01-19 03:14:07', '1969-12-31 23:59:59', '2038-01-19 03:14:08', '2023-02-30', 'abc', '2023-07-01 12:00:00', '2023-07-01 24:00:00', '2023-07-01 12:60:00', '2023-07-01 12:00:60', '2023-07-01 12:00:00.123456', '2023-07-01 12:00:00.1234567']
   );
  schemaTest(schemaYear,
    ['0000', '1901', '2155', '2156', '1899', 'abc']
  );
}

const schemaTest = (testData,schema) => {
  testData.forEach(test => {
    const { success, data, error } = schema.safeParse(test);
    if (success) {
      console.log(\`Validation passed for \${test}! Parsed value: \${data}\`);
    } else {
      console.log(\`Validation failed for \${test}!\`, error);
    }
  });
}
`

  const content = [imports, schemaDate, schemaDateTime, schemaTimeStamp, schemaYear, schemaTests]


  writeFile('zodSchema', content.join("\n"))

}

const getSchemaForFields = (describes: Desc[]) => {
  let schema = ''
  for (const desc of describes) {
    const field = camelCaseText(desc.Field, false)
    const type = getType(desc.Type, desc.Null)
    schema = `${schema}
  ${field}: ${type},`
  }
  return schema
}

const camelCaseText = (text: string, isPascal = true) => {
  const isCamelCase = context.config.camelCase !== undefined && context.config.camelCase !== false // object or true = true
  if (!isCamelCase)
    return text
  return camelCase(text,
    isPascal && typeof context.config.camelCase !== 'boolean' ? context.config.camelCase : undefined
  )
}

const modifyTypeName = (table: string) => {
  let typeName = table
  if (context.config.modify && context.config.modify.length) {
    typeName = context.config.modify.reduce(
      (modified, currentFromTo) => {
        const isPatternFrom = currentFromTo[0].startsWith('/')
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
      typeName
    )
  }
  return typeName
}

const getWantedTables = () => {

  const allIncludedTables = context.tables
  const includedTablesRegex = getIncludedTablesRegex(allIncludedTables)
  const includedTableNames = allIncludedTables?.filter(
    table => includedTablesRegex?.includes(table)
  )

  if (!(includedTableNames && includedTableNames.length))
    return
  context.tables = context.tables.filter((table) => {
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

const avoidUnwantedTables = () => {
  const allIgnoredTables = context.config.ignore
  const ignoredTablesRegex = getIgnoredTablesRegex(allIgnoredTables)
  const ignoredTableNames = allIgnoredTables?.filter(
    table => !ignoredTablesRegex?.includes(table)
  )

  if (ignoredTableNames && ignoredTableNames.length)
    context.tables = context.tables.filter(table => !ignoredTableNames.includes(table))

  if (!(ignoredTablesRegex && ignoredTablesRegex.length))
    return


  context.tables = context.tables.filter((table) => {
    let useTable = true
    ignoredTablesRegex.forEach((text) => {
      const pattern = text.substring(1, text.length - 1)
      if (table.match(pattern) !== null)
        useTable = false
    })
    return useTable
  })
}

const getIncludedTablesRegex = (allIncludedTables: string[] | undefined) => {
  return allIncludedTables?.filter((includeString) => {
    const isPattern = includeString.startsWith('/') && includeString.endsWith('/')
    return isPattern
  })
}

const getIgnoredTablesRegex = (allIgnoredTables: string[] | undefined) => {
  return allIgnoredTables?.filter((ignoreString) => {
    const isPattern = ignoreString.startsWith('/') && ignoreString.endsWith('/')
    return isPattern
  })
}

