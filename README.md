# Branch tg-datetime-01

This branch has some good code and README notes below, but I'm going to leave this for now and take a different approach in another branch, maybe copying some of the assets from here before deleting this.

<hr> 

# mysql-zod

Generate Zod interfaces from MySQL database

## Installation

Install `mysql-zod` with npm

```bash
npm install mysql-zod --save-dev
```

## Usage/Examples

Create a file named `mysql-zod.json` and fill it as follows (adjust to your needs):

```json
{
  "host": "127.0.0.1",
  "port": 3306,
  "user": "root",
  "password": "secret",
  "database": "myapp"
}
```

Create user table:

```sql
CREATE TABLE `user` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `role` enum('admin','user') NOT NULL,
  PRIMARY KEY (`id`)
);
```
Then run the command:

```bash
npx mysql-zod
```

The above command will create a `user.ts` file with the following contents:

```typescript
import z from 'zod'

export const user = z.object({
  id: z.number().nonnegative(),
  name: z.string(),
  username: z.string(),
  password: z.string(),
  profile_picture: z.string().nullable(),
  role: z.enum(['admin', 'user']),
})

export type userType = z.infer<typeof user>
```

You can also use the mysql-zod API programmatically:

```typescript
import { generate } from 'mysql-zod'

await generate({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'secret',
  database: 'myapp',
})
```

## Config

```json
{
  "host": "127.0.0.1",
  "port": 3306,
  "user": "root",
  "password": "secret",
  "database": "myapp",
  "tables": ["user", "log", "/^prod(1|2)_/"],
  "ignore": ["log", "/^temp/"],
  "folder": "@zod",
  "suffix": "table",
  "camelCase": { "pascalCase": true },
  "nullish": false,
  "requiredString": false,
  "modify": [
    ["/_site_/", "_location_"],
    ["/^x(.*)/", "$1_Xref"],
    ["/^wp/", ""],
    ["comms", "_comms_"],
    ["entity", "_entity"]
  ],
  "datetime": {
    "useDate": false,
    "useIso": true,
    "coerce" : false,
    "offset": true,
    "precision": 3,
    "minDate": "1900-01-01",
    "maxDate": "2099-12-31",
    "year" : "/^\\d{4}$/"
  }
}
```

| Option | Description |
| ------ | ----------- |
| tables | Filter the tables to include only those specified. If a table name begins and ends with "/", it will be processed as a regular expression. |
| ignore | Filter the tables to exclude those specified. If a table name begins and ends with "/", it will be processed as a regular expression. |
| folder | Specify the output directory. |
| suffix | Suffix to the name of a generated file. (eg: `user.table.ts`) |
| camelCase | Convert all table names and their properties to camelcase. (eg: `profile_picture` becomes `profilePicture`) The value of this option may be a simple Boolean true/false to enable/disable default camel casing. If the value is an object for the camelCase feature, the object will be passed as Options to camelCase. Valid Options object properties are "pascalCase", "preserveConsecutiveUppercase", and "locale". For example, with `{"pascalCase":true}`, a table name becomes `ProfilePicture`. See [GitHub](https://github.com/sindresorhus/camelcase) for details. |
| nullish | Set schema as `nullish` instead of `nullable` |
| requiredString | Add `min(1)` for string schema |
| modify | Array of substitution pairs for type name. Each pair in this array represents a _From/To_ replacement for the table name. The result will be the new type name and the filename prefix. If the _From_ value begins and ends with "/", it will be processed as a regular expression. The _To_ values do not need slashes. See above for examples. This can be used, for example, to identify words for camelCasing, and to version file and type names.
| datetime | _See notes on Date and Time types below._ <br> If present, this object refines how these types are converted to Zod schema. See example above and details below. |

### Date and Time types

MySQL date and time types include DATE, DATETIME, TIMESTAMP, and YEAR. MySQL accepts, stores, and returns different formats for dates and times. Years may be 1-4 digits or a string. Time may or may not have sub-second precision. User data from a browser form or other sources may be a string or Date object, and subject to other formats. Even if the database accepts, for example, a 2 digit year for a YEAR type in the range of 0 to 99, application rules may require values to be provided as 4 digit years or from 2020 to 2030. You may not wish data coming _from_ from the database to validate in the context of your application, even if the database somehow has those values already stored.

MySQL-Zod defaults to validating with a single rule `z.string()` for all date and time fields in all processed tables. This is because no context is processed from the database, and there is no other means to differentiate intent for different fields with the same data type. Until this utility is enhanced to process constraints, mysql-zod.json options allow you to set somewhat better default rules than `z.string()`, based on your understanding of your data. No matter what the default, `z.string()` or custom Zod schema, manual changes to generated code for individual tables and fields will almost certainly be required.

| datetime options | Description |
| ------ | ----------- |
| useDate | Boolean/true = `z.date()` to validate a Date object. <super><small>[ref1](#references)</small></super> |
| useIso | Boolean/true = `z.string().datetime()` to validate a string representation of an ISO-formatted date+time. <super><small>[ref2](#references)</small></super> |
| | `useDate` and `useIso` are mutually exclusive. If they are both true, a false value will be used for both at run-time. |
| coerce | Boolean applies coersion for all date types. That is, values are converted to primitives **before** processing them as z.string, z.number, or z.date. <br> For example, with `z.coerce.date()` a string will first be converted from a string to a valid date object before other date-related processing. <super><small>[ref3](#references)</small></super> |
| offset | Boolean = true results in `z.string().datetime({ offset: true })`. (useIso only)|
| precision | Numeric 0-6 adds a precision constraint to `datetime()`.  (useIso only)|
| minDate | String adds a minumum constraint to `.date()` or `.datetime()`. <br> Example: `z.date().min(new Date("1900-01-01"))` <br> **Note** : Without server-specific settings, the minimum year for a TIMESTAMP datatype is 1970. The maxDate value should be less than or equal to that year. <super><small>[ref3](#references)</small></super> |
| maxDate | String adds a maximum constraint to `.date()` or `.datetime()`. <br> Example: `z.date().max(new Date("2099-12-31"))` <br> **Note** : Without server-specific settings, the maximum year for a TIMESTAMP datatype is 2038. The maxDate value should be less than or equal to that year. <super><small>[ref3](#references)</small></super>|
| year | MySQL supports multiple formats for the YEAR data type (<super><small>[ref4](#references)</small></super>) including strings and numbers. <br> If the `year` option is not present, the default Zod schema is `z.string()`. <br> If present, this `year` option may be a regular expression in the format `"/.../"` or the value "number". <br> If a RegExp, the validation applies the RegExp to string input. For example, `"/^\\d{2}$/"` validates a string as consisting of two digits. <br> For `"year": "number"`, only a number will validate, not a string containing a number. |



### References
1) Zod.dev [Dates](https://zod.dev/?id=dates)
1) Zod.dev [ISO datetimes](https://zod.dev/?id=iso-datetimes)
1) Zod.dev [Coercion for primitives](https://zod.dev/?id=coercion-for-primitives)
1) [MYSQL](https://dev.mysql.com/doc/refman/8.0/en/datetime.html) DATE, DATETIME, and TIMESTAMP Types
1) [MySQL](https://dev.mysql.com/doc/refman/8.0/en/year.html) YEAR type