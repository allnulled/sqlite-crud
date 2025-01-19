const Database = require("better-sqlite3");
const Firewall = require("sistema-lenguaje-firewall");

class SqliteCrud {

  constructor(file, options = {}, configurations = {}) {
    this.configurations = {
      trace: false,
      firewallFile: false,
    };
    Object.assign(this.configurations, configurations);
    this.betterSqlite = new Database(file, options);
  }

  sanitize(value) {
    if (typeof value === 'string') {
      return "'" + (value.replace(/'/g, "''")) + "'"; // Escapar comillas simples
    }
    return value;
  }

  sanitizeId(identifier) {
    return "`" + identifier.replace(/`/g, "") + "`";
  }

  sanitizeOperator(operator) {
    if(["<","<=",">",">=","!=","=","is null","is not null","is like","is not like","is in","is not in"].indexOf(operator) === -1) {
      throw new Error("Operator not recognized: " + operator);
    }
    return operator;
  }

  select(table, wheres = [], orders = []) {
    const sanitizedTable = this.sanitizeId(table);
    const whereClauses = wheres.map(([column, operator, value]) => {
      const sanitizedColumn = this.sanitizeId(column);
      const sanitizedOperator = this.sanitizeOperator(operator);
      if (['is null', 'is not null'].includes(sanitizedOperator.toLowerCase())) {
        return `${sanitizedColumn} ${sanitizedOperator}`;
      } else if (['is in', 'is not in'].includes(sanitizedOperator.toLowerCase())) {
        if (!Array.isArray(value)) throw new Error('Value for IN must be an array');
        const sanitizedValues = value.map(v => `'${this.sanitize(v)}'`).join(', ');
        return `${sanitizedColumn} ${sanitizedOperator.replace('is ', '')} (${sanitizedValues})`;
      } else {
        return `${sanitizedColumn} ${sanitizedOperator} ${this.sanitize(value)}`;
      }
    }).join(' AND ');
    const orderClauses = orders.map(([column, direction]) => {
      const sanitizedColumn = this.sanitizeId(column);
      const sanitizedDirection = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      return `${sanitizedColumn} ${sanitizedDirection}`;
    }).join(', ');
    const whereSql = whereClauses ? `WHERE ${whereClauses}` : '';
    const orderSql = orderClauses ? `ORDER BY ${orderClauses}` : '';
    const sql = `SELECT * FROM ${sanitizedTable} ${whereSql} ${orderSql}`;
    return this.getAllResults(sql);
  }

  insert(table, value) {
    const sanitizedTable = this.sanitizeId(table);
    const keys = Object.keys(value).map(key => this.sanitizeId(key));
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${sanitizedTable} (${keys.join(', ')}) VALUES (${placeholders});`;
    const statement = this.betterSqlite.prepare(sql);
    return this.runStatement(statement, Object.values(value));
  }

  update(table, id, properties) {
    const sanitizedTable = this.sanitizeId(table);
    const setClauses = Object.entries(properties).map(([key, value]) => {
      return `${this.sanitizeId(key)} = ?`;
    }).join(', ');
    const sql = `UPDATE ${sanitizedTable} SET ${setClauses} WHERE id = ?;`;
    const statement = this.betterSqlite.prepare(sql);
    return this.runStatement(statement, [...Object.values(properties), id]);
  }

  delete(table, id) {
    const sanitizedTable = this.sanitizeId(table);
    const sql = `DELETE FROM ${sanitizedTable} WHERE id = ?;`;
    const statement = this.betterSqlite.prepare(sql);
    return this.runStatement(statement, id);
  }

  createTable(table, contents = "") {
    const sanitizedTable = this.sanitizeId(table);
    const sql = `CREATE TABLE IF NOT EXISTS ${sanitizedTable} ( id INTEGER PRIMARY KEY AUTOINCREMENT${ contents ? ", " + contents : "" } );`;
    return this.exec(sql);
  }

  dropTable(table) {
    const sanitizedTable = this.sanitizeId(table);
    const sql = `DROP TABLE IF EXISTS ${sanitizedTable};`;
    return this.exec(sql);
  }

  createColumn(table, column, contents = "") {
    const sanitizedTable = this.sanitizeId(table);
    const sanitizedColumn = this.sanitizeId(column);
    const sql = `ALTER TABLE ${sanitizedTable} ADD COLUMN ${sanitizedColumn} ${contents}`;
    return this.exec(sql);
  }

  dropColumn(table, column) {
    const sanitizedTable = this.sanitizeId(table);
    const sanitizedColumn = this.sanitizeId(column);
    const sql = `ALTER TABLE ${sanitizedTable} DROP COLUMN ${sanitizedColumn}`;
    return this.exec(sql);
  }

  renameTable(table, newTable) {
    const sanitizedTable = this.sanitizeId(table);
    const sanitizedNewTable = this.sanitizeId(newTable);
    const sql = `ALTER TABLE ${sanitizedTable} RENAME TO ${sanitizedNewTable}`;
    return this.exec(sql);
  }

  renameColumn(table, column, newColumn) {
    const sanitizedTable = this.sanitizeId(table);
    const sanitizedColumn = this.sanitizeId(column);
    const sanitizedNewColumn = this.sanitizeId(newColumn);
    const sql = `ALTER TABLE ${sanitizedTable} RENAME COLUMN ${sanitizedColumn} TO ${sanitizedNewColumn}`;
    return this.exec(sql);
  }

  exec(sql) {
    if (typeof sql !== 'string') throw new Error('SQL must be a string');
    this.trace("[sqlite][exec] " + sql);
    return this.betterSqlite.exec(sql);
  }

  runStatement(statement, parameters = []) {
    this.trace("[sqlite][runStatement] " + statement.source, Array.isArray(parameters) ? parameters : [parameters]);
    return statement.run(parameters);
  }

  getAllResults(sql) {
    this.trace("[sqlite][runStatement] " + sql);
    return this.betterSqlite.prepare(sql).all();
  }

  trace(traceText, others = []) {
    if(this.configurations.trace) {
      console.log(traceText, ...others);
    }
  }

  notifyError(error, origin = false, propagate = false) {
    console.error(error, "from: " + (origin ?? "unknown"));
    if(propagate) {
      throw error;
    }
  }

  getSchema() {
    const allColumns = this.getAllResults(`SELECT 
          m.name AS table_name, 
          p.name AS column_name, 
          p.type AS data_type, 
          p.\`notnull\` AS not_null, 
          p.pk AS primary_key,
          fk.\`table\` AS foreign_table,
          fk.\`to\` AS foreign_column
      FROM sqlite_master AS m
      JOIN pragma_table_info(m.name) AS p
      LEFT JOIN pragma_foreign_key_list(m.name) AS fk
        ON p.name = fk.\`from\`
      WHERE m.type = 'table' 
        AND m.name NOT LIKE 'sqlite_%'
      ORDER BY m.name, p.cid;`);
    const schema = {};
    for(let index_column=0; index_column<allColumns.length; index_column++) {
      const column = allColumns[index_column];
      const { 
        table_name,
        column_name,
        data_type,
        not_null,
        primary_key,
        foreign_table,
        foreign_column,
      } = column;
      if(!(table_name in schema)) {
        schema[table_name] = {
          columns: {},
          fks: {}
        };
      }
      schema[table_name].columns[column_name] = {
        table_name,
        column_name,
        data_type,
        not_null,
        primary_key,
        foreign_table,
        foreign_column
      };
      if(foreign_table) {
        schema[table_name].fks[column_name] = {
          foreign_table,
          foreign_column
        };
      }
    }
    return { tables: schema };
  }

}

class SqliteCredentials {
  
  static create(...args) {
    return new this(...args);
  }

  constructor(data) {
    this.data = data;
  }

  isUser(user) {
    return this.data.user.name === name;
  }

  isUserById(userId) {
    return this.data.user.id === userId;
  }

  hasGroup(group) {
    return this.data.groups.filter(g => g.name === group).length;
  }

  hasGroupById(groupId) {
    return this.data.groups.filter(g => (g.id + "") === (groupId + "")).length;
  }

  hasPermission(permission) {
    return this.data.permissions.filter(g => g.name === permission).length;
  }

  hasPermissionById(permissionId) {
    return this.data.permissions.filter(p => (p.id + "") === (permissionId + "")).length;
  }

  toObject() {
    return this.data;
  }

  toString() {
    return JSON.stringify(this.data, null, 2);
  }

  toJSON() {
    return this.data;
  }

}

class SqliteAuthentication extends SqliteCrud {

  constructor(file, options = {}, configurations = {}) {
    super(file, options, configurations);
    if(this.configurations.firewallFile) {
      this.firewall = Firewall.crear({});
    } else {
      this.firewall = false;
    }
  }

  initializeAuth() {
    this.createAuthTables();
    this.createAuthData();
    return this.loadFirewallFile();
  }

  createAuthTables() {
    try {
      this.createTable("users", "name VARCHAR(255) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:users", false);
    }
    try {
      this.createTable("groups", "name VARCHAR(255), description TEXT");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:groups", false);
    }
    try {
      this.createTable("permissions", "name VARCHAR(255), description TEXT");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:permissions", false);
    }
    try {
      this.createTable("sessions", "name VARCHAR(255), token VARCHAR(100), id_user INTEGER, FOREIGN KEY (id_user) REFERENCES users (id)");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:sessions", false);
    }
    try {
      this.createTable("sessions", "id_user INTEGER, token VARCHAR(100), FOREIGN KEY (id_user) REFERENCES users(id)");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:sessions", false);
    }
    try {
      this.createTable("users_and_groups", "name VARCHAR(255), id_user INTEGER, id_group INTEGER, FOREIGN KEY (id_user) REFERENCES users (id), FOREIGN KEY (id_group) REFERENCES groups (id)");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:users_and_groups", false);
    }
    try {
      this.createTable("permissions_and_groups", "name VARCHAR(255), id_permission INTEGER, id_group INTEGER, FOREIGN KEY (id_permission) REFERENCES permissions (id), FOREIGN KEY (id_group) REFERENCES groups (id)");
    } catch (error) {
      this.notifyError(error, "createAuthTables/table:permissions_and_groups", false);
    }
  }

  createAuthData() {
    try {
      this.insert("users", {
        name: "admin",
        email: "admin@admin.org",
        password: "admin"
      });
    } catch (error) {
      this.notifyError(error, "createAuthData/users:admin", false);
    }
    try {
      this.insert("groups", {
        name: "administrators",
        description: "The group of administrators"
      });
    } catch (error) {
      this.notifyError(error, "createAuthData/groups:administrators", false);
    }
    try {
      this.insert("permissions", {
        name: "administrate",
        description: "The permission to administrate"
      });
    } catch (error) {
      this.notifyError(error, "createAuthData/permission:administrate", false);
    }
    try {
      this.insert("users_and_groups", {
        id_user: this.select("users", [["name", "=", "admin"]])[0].id,
        id_group: this.select("groups", [["name", "=", "administrators"]])[0].id,
      });
    } catch (error) {
      this.notifyError(error, "createAuthData/users_and_groups:admin-administrators", false);
    }
    try {
      this.insert("permissions_and_groups", {
        id_permission: this.select("permissions", [["name", "=", "administrate"]])[0].id,
        id_group: this.select("groups", [["name", "=", "administrators"]])[0].id,
      });
    } catch (error) {
      this.notifyError(error, "createAuthData/permissions_and_groups:administrate-administrators", false);
    }
  }

  alphabet = "abcdefghijklmnoprstuvwxyz".split("");

  generateRandomCharacter() {
    return this.alphabet[Math.floor(Math.random() * this.alphabet.length)];
  }

  generateRandomText(len) {
    let out = "";
    while(out.length < len) {
      out += this.generateRandomCharacter();
    }
    return out;
  }

  async loadFirewallFile() {
    if(!this.firewall) {
      return -1;
    }
    if(!this.configurations.firewallFile) {
      return -2;
    }
    await this.firewall.cargar_fichero(this.configurations.firewallFile);
  }

  login(name, password) {
    const sanitizedName = this.sanitize(name);
    const matchedUsers = this.getAllResults(`SELECT * FROM users WHERE email = ${sanitizedName} OR name = ${sanitizedName};`);
    if(matchedUsers.length === 0) {
      throw new Error(`User not found by name or email «${name}» on «SqliteAuthentication.login»`);
    }
    const matchedUser = matchedUsers[0];
    if(matchedUser.password !== password) {
      throw new Error("User password is not correct on «SqliteAuthentication.login»");
    }
    const openedSessions = this.select("sessions", [["id_user", "=", matchedUser.id]]);
    let openedSession = undefined;
    if(openedSessions.length) {
      openedSession = openedSessions[0];
    } else {
      openedSession = {
        id_user: matchedUser.id,
        token: this.generateRandomText(100)
      };
      this.insert("sessions", openedSession);
    }
    return openedSession;
  }

  logout(token) {
    return this.delete("sessions", [["token", "=", token]]);
  }

  authenticate(token) {
    const matchedSessions = this.select("sessions", [["token", "=", token]]);
    if(matchedSessions.length === 0) {
      throw new Error(`Could not authenticate token: «${token}»`);
    }
    const matchedSession = matchedSessions[0];
    const idUser = matchedSession.id_user;
    const authenticationData = this.getAllResults(`SELECT 
          u.id AS user_id, 
          u.name AS user_name, 
          g.id AS group_id, 
          g.name AS group_name, 
          p.id AS permission_id, 
          p.name AS permission_name
      FROM users AS u
      JOIN users_and_groups AS ug ON u.id = ug.id_user
      JOIN groups AS g ON ug.id_group = g.id
      JOIN permissions_and_groups AS pg ON g.id = pg.id_group
      JOIN permissions AS p ON pg.id_permission = p.id
      WHERE u.id = ${this.sanitize(idUser)};
    `);
    const authorizedGroups = new Map();
    const authorizedPermissions = new Map();
    for(let index=0; index<authenticationData.length; index++) {
      const row = authenticationData[index];
      if(!authorizedGroups.has(row.group_id)) {
        authorizedGroups.set(row.group_id, {
          id: row.group_id,
          name: row.group_name
        });
      }
      if(!authorizedPermissions.has(row.permission_id)) {
        authorizedPermissions.set(row.permission_id, {
          id: row.permission_id,
          name: row.permission_name
        });
      }
    }
    return SqliteCredentials.create({
      user: {id: idUser},
      groups: Array.from(authorizedGroups.values()),
      permissions: Array.from(authorizedPermissions.values())
    });
  }

  authorize(credentials, operation, parameters) {
    this.firewall.emitir(operation, {
      credentials,
      parameters,
      sqliteCrud: this
    });
  }

  authorized = {
    select: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.select", args);
      return this.select(...args);
    },
    insert: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.insert", args);
      return this.insert(...args);
    },
    update: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.update", args);
      return this.update(...args);
    },
    delete: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.delete", args);
      return this.delete(...args);
    },
    createTable: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.createTable", args);
      return this.createTable(...args);
    },
    createColumn: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.createColumn", args);
      return this.createColumn(...args);
    },
    renameTable: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.renameTable", args);
      return this.renameTable(...args);
    },
    renameColumn: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.renameColumn", args);
      return this.renameColumn(...args);
    },
    deleteTable: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.deleteTable", args);
      return this.deleteTable(...args);
    },
    deleteColumn: async (credentials, ...args) => {
      await this.authorize(credentials, "crud.deleteColumn", args);
      return this.deleteColumn(...args);
    },
  };

}

module.exports = SqliteAuthentication;
