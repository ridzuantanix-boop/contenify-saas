import app from '../../.open-next/worker.js';
import { createCanonicalProductionWorker } from './production-origin.mjs';

export default createCanonicalProductionWorker(app);
