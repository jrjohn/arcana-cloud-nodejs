import { Router, Request, Response } from 'express';
import { config } from '../config.js';

const router = Router();

router.get('/info', (_req: Request, res: Response) => {
  res.json({
    name: 'Arcana Cloud API',
    version: '1.0.0',
    environment: config.nodeEnv,
    deploymentMode: config.deploymentMode,
    timestamp: new Date().toISOString()
  });
});

router.get('/version', (_req: Request, res: Response) => {
  res.json({
    version: '1.0.0',
    node: process.version,
    platform: process.platform,
    arch: process.arch
  });
});

export default router;
