import postgres from 'postgres';

// Ensure environment variables are defined
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_NEON) {
  throw new Error("Database URLs are missing in environment variables.");
}

// Create primary and fallback DB connections
const mainDB = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  prepare: false,
  max: 10,
});

const fallbackDB = postgres(process.env.DATABASE_URL_NEON, {
  ssl: { rejectUnauthorized: false },
  prepare: false,
  max: 10,
});

// Define primitive types for query values
export type Primitive = string | number | boolean | null | undefined | Primitive[];

// Determine if a query is a write operation
const isWriteQuery = (queryString: string) => {
  const writeKeywords =
    /^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|SET|COMMENT|MERGE|CALL)\s/i;
  return writeKeywords.test(queryString.trim());
};

export const sql = mainDB;


// **Query function that supports both read and write operations**
export const query = async <T = any>(
  queryString: string,
  values: Primitive[] = []
): Promise<{ rows: T[] }> => {
  const db = isWriteQuery(queryString) ? mainDB : fallbackDB;
  try {
    // @ts-ignore
    const result = await db.unsafe<T[]>(queryString, values); // Ensure it's an array
    return { rows: result }; // Directly return result without unnecessary spread
  } catch (error) {
    console.error("DB Query Error:", error);
    throw error;
  }
};

// **Tagged template function for SQL queries**
export const sqlQuery = async <T = any>(
  strings: TemplateStringsArray,
  ...values: Primitive[]
): Promise<T[]> => {
  const queryString = strings.join("?"); // Approximate the final query string
  const db = isWriteQuery(queryString) ? mainDB : fallbackDB;
  try {
    // @ts-ignore
    return await db.unsafe<T[]>(queryString, values);
  } catch (error) {
    console.error("SQL Query Error:", error);
    throw error;
  }
};

// **Test database connections for both main and fallback DBs**
export const testDBConnection = async (): Promise<Record<string, { status: string; message?: string }>> => {
  const results: Record<string, { status: string; message?: string }> = {};

  try {
    await mainDB`SELECT NOW()`;
    results.mainDB = { status: "Success" };
  } catch (error: unknown) {
    results.mainDB = { status: "Error", message: (error as Error).message };
  }

  try {
    await fallbackDB`SELECT NOW()`;
    results.fallbackDB = { status: "Success" };
  } catch (error: unknown) {
    results.fallbackDB = { status: "Error", message: (error as Error).message };
  }

  return results;
};
