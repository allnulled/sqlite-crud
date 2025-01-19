# sqlite-crud

Wrapper de better-sqlite3 con operaciones típicas de datos y esquema.

## Instalar

```sh
npm i -s @allnulled/sqlite-crud
```

## Importar

```js
const SqliteCrud = require("@allnulled/sqlite-crud");
const sqliteCrud = new SqliteCrud("file.sqlite", {
    // (optional) better-sqlite3 opions:
    readonly: false
}, {
    // (optional) @allnulled/sqlite-crud options:
    trace: true
});
```

## API

La API devuelve una clase. La clase tiene 2 capas unidas por herencia: la `API CRUD` y la `API AUTH`. Todos los métodos están al mismo nivel en la clase, pero se implementan en 2 herencias, para diferenciar APIs.

Primero, va la CRUD. Luego, se extiende la AUTH.

La API CRUD de la clase ofrece:

- `sanitize(text)`
- `sanitizeId(id)`
- `sanitizeOperator(operator)`
- `getSchema()`
- `select(table, wheres, orders)`
- `insert(table, value)`
- `update(table, id, properties)`
- `delete(table, id)`
- `createTable(table, content)`
- `createColumn(table, column, content)`
- `dropTable(table)`
- `dropColumn(table, column)`
- `renameTable(table, newTable)`
- `renameColumn(table, column, newColumn)`
- `exec(sql)`
- `runStatement(statement, parameters = [])`
- `getAllResults(sql)`
- `trace(traceText, others = [])`
- `notifyError(error, origin = false, propagate = false)`
- `getSchema()`

La API AUTH de la clase ofrece:

- `initializeAuth()`
- `login(name, password)`
- `logout(token)`
- `authenticate(token):SqliteCredentials`
- `authorized.select(sqliteCredentials, ...args)`
- `authorized.insert(sqliteCredentials, ...args)`
- `authorized.update(sqliteCredentials, ...args)`
- `authorized.delete(sqliteCredentials, ...args)`
- `authorized.createTable(sqliteCredentials, ...args)`
- `authorized.createColumn(sqliteCredentials, ...args)`
- `authorized.renameTable(sqliteCredentials, ...args)`
- `authorized.renameColumn(sqliteCredentials, ...args)`
- `authorized.deleteTable(sqliteCredentials, ...args)`
- `authorized.deleteColumn(sqliteCredentials, ...args)`

### Detalles de la API

#### La propiedad authorized y el firewall

La propiedad `authorized` tiene los métodos de alto nivel de la API CRUD/AUTH, pero forzando autorización mediante un objeto de tipo `SqliteCredentials`.

El firewall puede crearse al: 

```js
new SqliteCrud("db.sqlite", {}, {
  firewallFile: "security.fwl"
});
```

Cuando se haga el `initializeAuth`, se llamará a la lectura y carga del fichero.

La API del firewall viene dada por la librería [sistema-lenguaje-firewall](https://github.com/allnulled/sistema-lenguaje-firewall/tree/main).



#### El wheres y orders del select

Los que cabe explicar, que no se sobreentienden, serían el `where` y el `orders`.

El `where` es un array así:

```js
[
    ["name", "=", "Pepe"],
    ["age", ">=", 30],
    ["id", "is in", [1,2,3,4,5,6,7,8,9,10] ],
    ["id", "is not null"],
]
```

El segundo parámetro es siempre un operador. Se permiten los operadores: `["<","<=",">",">=","!=","=","is null","is not null","is like","is not like","is in","is not in"]`.

En cuanto al `orders`, hay que pasarle un array también, pero así:

```js
[
    ["name", "ASC"],
    ["age", "DESC"]
]
```

No he incluído paginación de momento.

También se puede explicar el `content`, que sería el texto SQL que iría dentro. Pero se inyecta la columna `id` como PK y autoincremental.

## Uso

Este es el test. Puede que no cubra todos los métodos.

```js
let chai;
let SqliteRest, sqliteCrud;

const resetDatabaseFile = async function() {
  require("fs").unlinkSync(__dirname + "/test.sqlite");
  require("fs").writeFileSync(__dirname + "/test.sqlite", "", "utf8");
};

const commonMemory = {};

describe("SqliteRest API Test", function() {

  before(async () => {
    chai = await import("chai");
  });

  before(resetDatabaseFile);
  
  // after(resetDatabaseFile);
  
  it("can load the library", async function() {
    SqliteRest = require(__dirname + "/sqlite-crud.js");
  });

  it("can create an instance", async function() {
    sqliteCrud = new SqliteRest("test.sqlite", {
      readonly: false
    }, {
      trace: true,
      firewallFile: __dirname + "/test.fwl"
    });
  });

  it("can initialize auth tables and data", async function() {
    await sqliteCrud.initializeAuth();
  });

  it("can commit all simple CRUD operations", async function() {
    // Create (Insert)
    const insertResult = sqliteCrud.insert("users", { name: "Juan", email: "Juan@correos.org", password: "123456" });
    chai.expect(insertResult.changes).to.equal(1);
    sqliteCrud.insert("users", { name: "Pepe", email: "Pepe@correos.org", password: "123456" });
    sqliteCrud.insert("users", { name: "Tomás", email: "Tomas@correos.org", password: "123456" });
    sqliteCrud.insert("users", { name: "Orlando", email: "Orlando@correos.org", password: "123456" });
    sqliteCrud.insert("users", { name: "Kentucky", email: "Kentucky@correos.org", password: "123456" });
  
    // Read (Select)
    const users = sqliteCrud.select("users", [["name", "=", "Juan"]], [["name", "ASC"]]);
    chai.expect(users.length).to.equal(1);
    chai.expect(users[0].name).to.equal("Juan");
  
    // Update
    const updateResult = sqliteCrud.update("users", users[0].id, { name: "Juan Actualizado" });
    chai.expect(updateResult.changes).to.equal(1);
  
    // Verify Update
    const updatedUser = sqliteCrud.select("users", [["id", "=", users[0].id]]);
    chai.expect(updatedUser[0].name).to.equal("Juan Actualizado");
  
    // Delete
    const deleteResult = sqliteCrud.delete("users", users[0].id);
    chai.expect(deleteResult.changes).to.equal(1);
  
    // Verify Delete
    const remainingUsers = sqliteCrud.select("users");
    chai.expect(remainingUsers.length).to.equal(5);
  });

  it("can use login on valid data", async function() {
    const session = sqliteCrud.login("admin", "admin");
    console.log(session);
    chai.expect(session.token.length).to.equal(100);
    commonMemory.session = session;
  });

  it("can get schema", async function() {
    const schema = sqliteCrud.getSchema();
    chai.expect(typeof schema).to.equal("object");
  });

  it("can use authenticate method", async function() {
    const authenticationData = sqliteCrud.authenticate(commonMemory.session.token);
    console.log(authenticationData);
  });

  it("can use Authorized API methods", async function() {
    const credentials = sqliteCrud.authenticate(commonMemory.session.token);
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
    await sqliteCrud.authorized.select(credentials, "users");
  });

});
```