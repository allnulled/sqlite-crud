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

La API de esta clase ofrece estos métodos:

- sanitize(text)
- sanitizeId(id)
- sanitizeOperator(operator)
- select(table, wheres, orders)
- insert(table, value)
- update(table, id, properties)
- delete(table, id)
- createTable(table, content)
- createColumn(table, column, content)
- dropTable(table)
- dropColumn(table, column)
- renameTable(table, newTable)
- renameColumn(table, column, newColumn)
- exec(sql)

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
let SqliteCrud, sqliteCrud;

const resetDatabaseFile = async function() {
  require("fs").unlinkSync(__dirname + "/test.sqlite");
  require("fs").writeFileSync(__dirname + "/test.sqlite", "", "utf8");
};

describe("SqliteCrud API Test", function() {

  before(async () => {
    chai = await import("chai");
  });

  before(resetDatabaseFile);
  
  after(resetDatabaseFile);
  
  it("can load the library", async function() {
    SqliteCrud = require(__dirname + "/sqlite-crud.js");
  });

  it("can create an instance", async function() {
    sqliteCrud = new SqliteCrud("test.sqlite", { readonly: false }, { trace: true });
  });

  it("can create test tables", async function() {
    sqliteCrud.exec("CREATE TABLE users ( id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255), age INTEGER );");
    sqliteCrud.createTable("users", "name VARCHAR(255), INTEGER age");
    sqliteCrud.createTable("groups", "name VARCHAR(255)");
    sqliteCrud.createTable("permissions", "name VARCHAR(255)");
    sqliteCrud.createTable("sessions", "id_user INTEGER, token VARCHAR(100), FOREIGN KEY (id_user) REFERENCES users(id)");
  });

  it("can commit all simple CRUD operations", async function() {
    // Create (Insert)
    const insertResult = sqliteCrud.insert("users", { name: "Juan", age: 30 });
    chai.expect(insertResult.changes).to.equal(1);
    sqliteCrud.insert("users", { name: "Pepe", age: 31 });
    sqliteCrud.insert("users", { name: "Tomás", age: 32 });
    sqliteCrud.insert("users", { name: "Hipólito", age: 33 });
    sqliteCrud.insert("users", { name: "Lucía", age: 34 });
  
    // Read (Select)
    const users = sqliteCrud.select("users", [["age", "=", 30]], [["name", "ASC"]]);
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
    chai.expect(remainingUsers.length).to.equal(4);
  });

});
```