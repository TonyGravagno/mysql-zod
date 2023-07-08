import W from"node:path";import T from"fs-extra";import z from"knex";import y from"camelcase";function P(t,p,i){const x=i.nullish&&i.nullish===!0,a=i.requiredString&&i.requiredString===!0,g=t.split("(")[0].split(" ")[0],o=p==="YES",c=["z.string()"],m=["z.number()"],u=x?"nullish()":"nullable()",f="nonnegative()",b="min(1)";switch(g){case"date":case"datetime":case"timestamp":case"time":case"year":case"char":case"varchar":case"tinytext":case"text":case"mediumtext":case"longtext":case"json":case"decimal":return o?c.push(u):a&&c.push(b),c.join(".");case"tinyint":case"smallint":case"mediumint":case"int":case"bigint":case"float":case"double":return t.endsWith(" unsigned")&&m.push(f),o&&m.push(u),m.join(".");case"enum":return`z.enum([${t.replace("enum(","").replace(")","").replace(/,/g,", ")}])`}}async function q(t){const p=z({client:"mysql2",connection:{host:t.host,port:t.port,user:t.user,password:t.password,database:t.database}}),i=t.camelCase&&t.camelCase===!0;let a=(await p.raw("SELECT table_name as table_name FROM information_schema.tables WHERE table_schema = ?",[t.database]))[0].map(e=>e.table_name).filter(e=>!e.startsWith("knex_")).sort();const g=t.tables,o=g?.filter(e=>e.startsWith("/")&&e.endsWith("/")),c=g?.filter(e=>o?.includes(e));c&&c.length&&(a=a.filter(e=>{if(c.includes(e))return!0;if(o&&o.length){let l=!1;return o.forEach(d=>{const s=d.substring(1,d.length-1);e.match(s)!==null&&(l=!0)}),l}}));const m=t.ignore,u=m?.filter(e=>e.startsWith("/")&&e.endsWith("/")),f=m?.filter(e=>!u?.includes(e));f&&f.length&&(a=a.filter(e=>!f.includes(e))),u&&u.length&&(a=a.filter(e=>{let l=!0;return u.forEach(d=>{const s=d.substring(1,d.length-1);e.match(s)!==null&&(l=!1)}),l}));const b=t.modify;for(let e of a){const d=(await p.raw(`DESC ${e}`))[0];let s=e;b&&b.length&&(s=b.reduce((n,r)=>{if(r[0].startsWith("/")&&r[0].endsWith("/")){const w=r[0].substring(1,r[0].length-1);n.match(w)!==null&&(n=n.replace(new RegExp(w),r[1]))}else n=n.replace(r[0],r[1]);return n},s)),i&&(s=y(s));let h=`import z from 'zod'

export const ${s} = z.object({`;for(const n of d){const r=i?y(n.Field):n.Field,C=P(n.Type,n.Null,t);h=`${h}
  ${r}: ${C},`}h=`${h}
})

export type ${y(`${s}Type`)} = z.infer<typeof ${s}>
`;const E=t.folder&&t.folder!==""?t.folder:".",N=t.suffix&&t.suffix!==""?`${s}.${t.suffix}.ts`:`${s}.ts`,$=W.join(E,N);console.log("Created:",$),T.outputFileSync($,h)}await p.destroy()}export{q as generate};
