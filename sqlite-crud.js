const Database = require("better-sqlite3");

class SqliteCrud {

  constructor(file, options = {}, configurations = {}) {
    this.configurations = {
      trace: false,
    };
    Object.assign(this.configurations, configurations);
    this.betterSqlite = new Database(file, options);
  }

  sanitize(value) {
    if (typeof value === 'string') {
      return value.replace(/'/g, "''"); // Escapar comillas simples
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
        return `${sanitizedColumn} ${sanitizedOperator} '${this.sanitize(value)}'`;
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
    return this.betterSqlite.prepare(sql).all();
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

  runStatement(statement, parameters) {
    this.trace("[sqlite][runStatement] " + statement);
    return statement.run(parameters);
  }

  trace(traceText) {
    if(this.configurations.trace) {
      console.log(traceText);
    }
  }

}

module.exports = SqliteCrud;
