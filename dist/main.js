import g from"node:path";import h from"fs-extra";import p from"knex";import b from"camelcase";let s={};async function q(e){try{s.config=e,await T(),await y(),await v(),C()}catch(t){console.dir({"MySQL-Zod Error":t})}finally{s.db&&await s.db.destroy()}}async function T(){const e=s.config;s.db=p({client:"mysql2",connection:{host:e.host,port:e.port,user:e.user,password:e.password,database:e.database}})}async function y(){const e=await s.db.raw("SELECT table_name as table_name FROM information_schema.tables WHERE table_schema = ?",[s.config.database]);s.tables=e[0].map(t=>t.table_name).filter(t=>!t.startsWith("knex_")).sort(),$(),z()}async function v(){for(const e of s.tables){const a=(await s.db.raw(`DESC ${e}`))[0];D(e,a)}}const D=(e,t)=>{const a=l(N(e));let n=`import z from 'zod'

export const ${a} = z.object({${w(t)}
})

export type ${l(`${a}Type`)} = z.infer<typeof ${a}>
`;u(a,n)},u=(e,t)=>{const a=s.config.folder&&s.config.folder!==""?s.config.folder:".",n=s.config.suffix&&s.config.suffix!==""?`${e}.${s.config.suffix}.ts`:`${e}.ts`,i=g.join(a,n);console.log("Created:",i),h.outputFileSync(i,t)},x=(e,t)=>{const a=s.config.nullish&&s.config.nullish===!0,n=s.config.requiredString&&s.config.requiredString===!0,i=e.split("(")[0].split(" ")[0],r=t==="YES",o=["z.string()"],c=["z.number()"],m=a?"nullish()":"nullable()",f="nonnegative()",d="min(1)";switch(i){case"date":case"datetime":case"timestamp":case"time":case"year":case"char":case"varchar":case"tinytext":case"text":case"mediumtext":case"longtext":case"json":case"decimal":return r?o.push(m):n&&o.push(d),o.join(".");case"tinyint":case"smallint":case"mediumint":case"int":case"bigint":case"float":case"double":return e.endsWith(" unsigned")&&c.push(f),r&&c.push(m),c.join(".");case"enum":return`z.enum([${e.replace("enum(","").replace(")","").replace(/,/g,", ")}])`}},C=()=>{u("zodSchema",["import z from 'zod'",`
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
  `,`
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
`,`
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
`,`
  const schemaYear = z.string()
    .refine(value => {
      if (value === '0000') return true;
      const num = Number(value);
      return num >= 1901 && num <= 2155;
    }, { message: "Invalid YEAR value." })
    .transform(z.number(), value => value === '0000' ? 0 : Number(value));
`,`
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
`].join(`
`))},w=e=>{let t="";for(const a of e){const n=l(a.Field,!1),i=x(a.Type,a.Null);t=`${t}
  ${n}: ${i},`}return t},l=(e,t=!0)=>s.config.camelCase!==void 0&&s.config.camelCase!==!1?b(e,t&&typeof s.config.camelCase!="boolean"?s.config.camelCase:void 0):e,N=e=>{let t=e;return s.config.modify&&s.config.modify.length&&(t=s.config.modify.reduce((a,n)=>{if(n[0].startsWith("/")&&n[0].endsWith("/")){const r=n[0].substring(1,n[0].length-1);a.match(r)!==null&&(a=a.replace(new RegExp(r),n[1]))}else a=a.replace(n[0],n[1]);return a},t)),t},z=()=>{const e=s.config.ignore,t=E(e),a=e?.filter(n=>!t?.includes(n));a&&a.length&&(s.tables=s.tables.filter(n=>!a.includes(n))),t&&t.length&&(s.tables=s.tables.filter(n=>{let i=!0;return t.forEach(r=>{const o=r.substring(1,r.length-1);n.match(o)!==null&&(i=!1)}),i}))},E=e=>e?.filter(t=>t.startsWith("/")&&t.endsWith("/")),$=()=>{const e=s.tables,t=S(e),a=e?.filter(n=>t?.includes(n));a&&a.length&&(s.tables=s.tables.filter(n=>{if(a.includes(n))return!0;let i=!1;return t&&t.length&&t.forEach(r=>{const o=r.substring(1,r.length-1);n.match(o)!==null&&(i=!0)}),i}))},S=e=>e?.filter(t=>t.startsWith("/")&&t.endsWith("/"));export{q as generate};
