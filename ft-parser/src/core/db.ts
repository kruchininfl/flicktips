import mysql, {
  QueryError,
  Connection,
  RowDataPacket,
  OkPacket,
  ResultSetHeader,
  FieldPacket,
  QueryOptions,
} from 'mysql2/promise';

const config = {
  host: 'localhost',
  user: 'flicktips',
  password: 'Aing6sii',
  database: 'flicktips'
};

let connection: undefined | Connection = undefined;

export async function q(
  query: string,
  values?: any,
) {
  if (!connection) {
    return Promise.reject().catch((e) => {
      console.error("There are no connection!");
      throw "There are no connection!";
    });
  }

  return connection.query.apply(connection, [query as unknown as QueryOptions, values]).catch((e: QueryError) => {
    console.info(connection?.format.apply(connection, [query, values]));
    console.error(e);
    throw e;
  });
}

export async function openDbConnection() {
  connection = connection || await mysql.createConnection(config);
}

export async function closeDbConnection() {
  if (connection) {
    await connection.end();
    connection = undefined;
  }
}