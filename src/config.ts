import { Command } from 'commander';

export interface Config {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  outputPath: string;
  format: 'excel' | 'markdown';
}

export function loadConfig(argv: string[]): Config {
  const program = new Command();
  program
    .name('data-dictionary')
    .description('Generate a data dictionary from a SQL Server database.')
    .option('--host <host>', 'SQL Server host', process.env.DB_HOST ?? 'localhost')
    .option('--port <port>', 'SQL Server port', process.env.DB_PORT ?? '1433')
    .option('--user <user>', 'SQL Server user', process.env.DB_USER ?? 'sa')
    .option('--password <password>', 'SQL Server password', process.env.DB_PASSWORD ?? '')
    .option('--database <database>', 'Database to document', process.env.DB_NAME ?? 'AdventureWorksLT')
    .option('--output <path>', 'Output file path', process.env.OUTPUT_PATH ?? 'output/data-dictionary.xlsx')
    .option('--format <format>', 'Output format: excel | markdown', process.env.OUTPUT_FORMAT ?? 'excel')
    .allowExcessArguments(false);

  program.parse(argv);
  const options = program.opts();

  const format = options.format === 'markdown' ? 'markdown' : 'excel';

  return {
    host: options.host,
    port: Number(options.port),
    user: options.user,
    password: options.password,
    database: options.database,
    outputPath: options.output,
    format,
  };
}
