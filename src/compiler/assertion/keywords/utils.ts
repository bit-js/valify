import type { Schema } from '../../../types/schema';
import type { Context } from '../context';

export type KeywordMapping = Record<string, (ctx: Context, parentSchema: Exclude<Schema, boolean>, identifier: string) => void>;

export const noTypeIdx = 0;

export const stringIdx = 1;
export const stringCode = 1 << stringIdx;

export const numberIdx = 2;
export const numberCode = 1 << numberIdx;

export const intIdx = 2;
export const intCode = 1 << 7;

export const arrayIdx = 3;
export const arrayCode = 1 << arrayIdx;

export const objectIdx = 4;
export const objectCode = 1 << objectIdx;

export const boolCode = 1 << 5;
export const nullCode = 1 << 6;

export function createConditionArray(): string[][] {
    return [[], [], [], [], []];
}

function isIdentifier(str: string): boolean {
    const firstCode = str.charCodeAt(0);

    // If first character is invalid (fuck eslint)
    // eslint-disable-next-line
    if (firstCode !== 95 && ((firstCode < 97 && firstCode > 90) || firstCode > 122 || firstCode < 65)) return false;

    // Traverse the string for the rest of the characters
    for (let i = 1, { length } = str; i < length; i++) {
        const code = str.charCodeAt(i);
        // eslint-disable-next-line
        if (code !== 95 && ((code < 97 && code > 90) || (code < 65 && code > 57) || code > 122 || code < 48)) return false;
    }

    // String is a valid identifier
    return true;
}

export function accessor(source: string, prop: string): string {
    return isIdentifier(prop) ? `${source}.${prop}` : `${source}[${JSON.stringify(prop)}]`;
}
