import { app } from './app.js';
import { config } from './config.js';
import { connectDatabase } from './lib/db.js';

try {
  await connectDatabase();
  app.listen(config.PORT, '0.0.0.0', () => console.info(`AHDORA API listening on port ${config.PORT}`));
} catch (error) {
  console.error(
    'API startup failed. Atlas connection is required; check MongoDB network access.',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exit(1);
}