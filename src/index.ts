
import type { Schema } from './types/schema';

export function schema<const T extends Schema>(obj: T): T { return obj; }

// Types
export * from './types/schema';

// Utils
export * as jsonPointer from './utils/jsonPointer';
export * as remoteRefs from './utils/remoteRefs';
