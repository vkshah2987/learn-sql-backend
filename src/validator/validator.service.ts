import { Injectable, Logger } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import { promisify } from 'util';

export interface ValidationResult {
  error: string | null;
  result?: {
    columns: string[];
    rows: any[][];
  };
}

export interface ValidatorOptions {
  timeout?: number; // milliseconds
  maxRows?: number;
}

@Injectable()
export class ValidatorService {
  private readonly logger = new Logger(ValidatorService.name);
  private readonly ALLOWED_STATEMENTS = ['SELECT'];
  private readonly FORBIDDEN_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE',
    'REPLACE', 'MERGE', 'CALL', 'EXPLAIN', 'LOCK', 'GRANT', 'REVOKE'
  ];

  async run(sql: string, options: ValidatorOptions = {}): Promise<ValidationResult> {
    const { timeout = 5000, maxRows = 1000 } = options;

    try {
      // Step 1: Pre-validate SQL
      const preValidation = this.preValidateSQL(sql);
      if (preValidation.error) {
        return preValidation;
      }

      // Step 2: Execute SQL in SQLite sandbox
      return await this.executeSQLInSandbox(sql, timeout, maxRows);
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      return {
        error: `Execution error: ${error.message}`,
      };
    }
  }

  private preValidateSQL(sql: string): ValidationResult {
    const trimmedSQL = sql.trim().toUpperCase();

    // Check if SQL is empty
    if (!trimmedSQL) {
      return { error: 'SQL query cannot be empty' };
    }

    // Check for forbidden keywords
    for (const keyword of this.FORBIDDEN_KEYWORDS) {
      if (trimmedSQL.includes(keyword)) {
        return { 
          error: `Operation not allowed: ${keyword}. Only SELECT statements are permitted.`,
        };
      }
    }

    // Check if it starts with an allowed statement
    const startsWithAllowed = this.ALLOWED_STATEMENTS.some(stmt => 
      trimmedSQL.startsWith(stmt)
    );

    if (!startsWithAllowed) {
      return {
        error: `Only SELECT statements are allowed. Found: ${trimmedSQL.split(' ')[0]}`,
      };
    }

    // Check for multiple statements (basic check for semicolons)
    const statements = sql.split(';').filter(s => s.trim());
    if (statements.length > 1) {
      return {
        error: 'Multiple statements are not allowed. Please use a single SELECT statement.',
      };
    }

    return { error: null };
  }

  private async executeSQLInSandbox(
    sql: string, 
    timeout: number, 
    maxRows: number
  ): Promise<ValidationResult> {
    return new Promise((resolve, reject) => {
      // Create in-memory SQLite database
      const db = new sqlite3.Database(':memory:');

      // Set up timeout
      const timeoutId = setTimeout(() => {
        db.close();
        resolve({ error: 'Query execution timeout' });
      }, timeout);

      // Create sample data for testing
      db.serialize(() => {
        // Create users table with sample data
        db.run(`CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          age INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`INSERT INTO users (name, email, age) VALUES 
          ('John Doe', 'john@example.com', 30),
          ('Jane Smith', 'jane@example.com', 25),
          ('Bob Johnson', 'bob@example.com', 35),
          ('Alice Wilson', 'alice@example.com', 28),
          ('Charlie Brown', 'charlie@example.com', 32)`);

        // Create products table with sample data
        db.run(`CREATE TABLE products (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          price DECIMAL(10,2),
          category TEXT,
          in_stock BOOLEAN DEFAULT 1
        )`);

        db.run(`INSERT INTO products (name, price, category, in_stock) VALUES 
          ('Laptop', 999.99, 'Electronics', 1),
          ('Mouse', 29.99, 'Electronics', 1),
          ('Desk Chair', 199.99, 'Furniture', 0),
          ('Coffee Mug', 12.99, 'Kitchen', 1),
          ('Notebook', 5.99, 'Office', 1)`);

        // Execute the user's SQL
        db.all(sql, (err, rows: any[]) => {
          clearTimeout(timeoutId);
          
          if (err) {
            db.close();
            resolve({ 
              error: `SQL Error: ${err.message}` 
            });
            return;
          }

          try {
            // Limit rows
            const limitedRows = rows.slice(0, maxRows);
            
            // Extract column names
            const columns = limitedRows.length > 0 ? Object.keys(limitedRows[0] as Record<string, any>) : [];
            
            // Convert to array format
            const rowsArray = limitedRows.map(row => columns.map(col => (row as Record<string, any>)[col]));

            db.close();
            resolve({
              error: null,
              result: {
                columns,
                rows: rowsArray,
              },
            });
          } catch (processingError: any) {
            db.close();
            resolve({ 
              error: `Result processing error: ${processingError.message}` 
            });
          }
        });
      });
    });
  }

  /**
   * Reset sandbox to known state (for admin reset functionality)
   */
  async resetSandbox(): Promise<{ status: string; message: string }> {
    // For SQLite in-memory, each execution creates a fresh database
    // So no persistent reset is needed
    this.logger.log('Sandbox reset completed (in-memory SQLite)');
    return {
      status: 'ok',
      message: 'Sandbox reset to known state',
    };
  }

  /**
   * Normalize results for comparison (future use)
   */
  normalizeResult(result: { columns: string[]; rows: any[][] }): string {
    // Create a normalized hash for result comparison
    const sortedColumns = [...result.columns].sort();
    const sortedRows = result.rows
      .map(row => [...row])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    
    return JSON.stringify({ columns: sortedColumns, rows: sortedRows });
  }
}
