import type { Schema } from '../../../types/schema';
import type { Context } from '../context';

export type KeywordResolver = (ctx: Context, parentSchema: Exclude<Schema, boolean>, identifier: string) => void;
export type KeywordMapping = (Record<string, KeywordResolver> & {
    // eslint-disable-next-line
    __finalize__?: KeywordResolver
})[];

export const stringCode = 1;
export const numberCode = 1 << 1;
export const intCode = 1 << 2;
export const arrayCode = 1 << 3;
export const objectCode = 1 << 4;
export const boolCode = 1 << 5;
export const nullCode = 1 << 6;

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

export function analyzeDeepEqual(identifier: string, value: unknown): string {
    if (typeof value !== 'object') return `${identifier}===${JSON.stringify(value)}`;
    if (value === null) return `${identifier}===null`;

    if (Array.isArray(value)) {
        return value.length === 0
            ? `Array.isArray(${identifier})&&${identifier}.length===0`
            : `Array.isArray(${identifier})&&${identifier}.length===${value.length}&&${value.map((item, idx) => analyzeDeepEqual(`${identifier}[${idx}]`, item)).join('&&')}`;
    }

    const keys = Object.keys(value);
    return keys.length === 0
        ? `typeof ${identifier}==='object'&&${identifier}!==null&&Object.keys(${identifier}).length===0`
        // @ts-expect-error Unsafe access
        : `typeof ${identifier}==='object'&&${identifier}!==null&&${keys.map((key) => analyzeDeepEqual(accessor(identifier, key), value[key])).join('&&')}&&Object.keys(${identifier}).length===${keys.length}`;
}

/* eslint-disable */
export const deepEquals: (a: any, b: any) => boolean = globalThis.Bun?.deepEquals === undefined
    ? function d(x, y): boolean {
        if (x === y) return true;
        if (Array.isArray(x)) return Array.isArray(y) && x.length === y.length && (x as any[]).every((a, i) => d(a, y[i]));

        if (typeof x === 'object' && x !== null && typeof y === 'object' && y !== null) {
            const kX = Object.keys(x);
            const kY = Object.keys(y);
            return kX.length === kY.length && kX.every((k) => Object.hasOwn(y, k) && d(x[k], y[k]));
        }

        return false;
    }
    : (x, x1) => Bun.deepEquals(x, x1, true);
