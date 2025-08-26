import { config } from 'dotenv';

declare global {
  var __ENV_LOADED__: boolean | undefined;
}

if (!global.__ENV_LOADED__) {
  config({ path: '.dev.vars', quiet: true });
  global.__ENV_LOADED__ = true;
}