import app from '../../.open-next/worker.js';
import { createStagingWorker } from './staging-gate.mjs';

export default createStagingWorker(app);
