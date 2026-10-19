import { createHash } from 'node:crypto';
import { getWorkflowDatabase } from './postgres/statements.mjs';
export const authSessionDatabase = () => getWorkflowDatabase();
export const sessionIdHash = id => createHash('sha256').update(id).digest('hex');
