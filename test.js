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