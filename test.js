let chai;
let SqliteRest, sqliteRest;

const resetDatabaseFile = async function() {
  require("fs").unlinkSync(__dirname + "/test.sqlite");
  require("fs").writeFileSync(__dirname + "/test.sqlite", "", "utf8");
};

describe("SqliteRest API Test", function() {

  before(async () => {
    chai = await import("chai");
  });

  before(resetDatabaseFile);
  
  after(resetDatabaseFile);
  
  it("can load the library", async function() {
    SqliteRest = require(__dirname + "/sqlite-crud.js");
  });

  it("can create an instance", async function() {
    sqliteRest = new SqliteRest("test.sqlite", { readonly: false }, { trace: true });
  });

  it("can create test tables", async function() {
    sqliteRest.exec("CREATE TABLE users ( id INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255), age INTEGER );");
    sqliteRest.createTable("users", "name VARCHAR(255), INTEGER age");
    sqliteRest.createTable("groups", "name VARCHAR(255)");
    sqliteRest.createTable("permissions", "name VARCHAR(255)");
    sqliteRest.createTable("sessions", "id_user INTEGER, token VARCHAR(100), FOREIGN KEY (id_user) REFERENCES users(id)");
  });

  it("can commit all simple CRUD operations", async function() {
    // Create (Insert)
    const insertResult = sqliteRest.insert("users", { name: "Juan", age: 30 });
    chai.expect(insertResult.changes).to.equal(1);
    sqliteRest.insert("users", { name: "Pepe", age: 31 });
    sqliteRest.insert("users", { name: "Tomás", age: 32 });
    sqliteRest.insert("users", { name: "Orlando", age: 33 });
    sqliteRest.insert("users", { name: "Kentucky", age: 34 });
  
    // Read (Select)
    const users = sqliteRest.select("users", [["age", "=", 30]], [["name", "ASC"]]);
    chai.expect(users.length).to.equal(1);
    chai.expect(users[0].name).to.equal("Juan");
  
    // Update
    const updateResult = sqliteRest.update("users", users[0].id, { name: "Juan Actualizado" });
    chai.expect(updateResult.changes).to.equal(1);
  
    // Verify Update
    const updatedUser = sqliteRest.select("users", [["id", "=", users[0].id]]);
    chai.expect(updatedUser[0].name).to.equal("Juan Actualizado");
  
    // Delete
    const deleteResult = sqliteRest.delete("users", users[0].id);
    chai.expect(deleteResult.changes).to.equal(1);
  
    // Verify Delete
    const remainingUsers = sqliteRest.select("users");
    chai.expect(remainingUsers.length).to.equal(4);
  });

});