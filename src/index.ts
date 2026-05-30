import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config';
import { createPool } from './db/connection';
import { introspect } from './db/introspect';
import { buildModel } from './model/mapper';
import { writeWorkbook } from './output/excel';
import { renderMarkdown } from './output/markdown';
import { logger } from './util/logger';

async function main(): Promise<void> {
  const config = loadConfig(process.argv);
  logger.info(`Connecting to ${config.host}:${config.port}/${config.database} ...`);

  const pool = await createPool(config);
  try {
    logger.info('Reading schema metadata ...');
    const raw = await introspect(pool);
    const model = buildModel(raw, config.database, new Date().toISOString());
    logger.info(`Found ${model.tables.length} tables.`);

    if (config.format === 'markdown') {
      const outputPath = config.outputPath.endsWith('.md')
        ? config.outputPath
        : `${config.outputPath.replace(/\.[^.]+$/, '')}.md`;
      await writeFile(outputPath, renderMarkdown(model), 'utf8');
      logger.info(`Wrote ${outputPath}`);
    } else {
      await writeWorkbook(model, config.outputPath);
      logger.info(`Wrote ${config.outputPath}`);
    }
  } finally {
    await pool.close();
  }
}

main().catch((error) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
