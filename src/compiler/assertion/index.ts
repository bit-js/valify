import type { Schema, FromSchema } from '../../types/schema';
import { RootContext, type Options } from './context';
import type { KeywordMapping } from './keywords';

export * as keywords from './keywords';

export function inspect(schema: Schema, keywords: KeywordMapping, options: Options = {}): string {
    const root = new RootContext(options, keywords);
    const conditions = root.compileConditions(schema, 'x');
    return `${root.declarations.join(';')};return (x)=>${conditions};`;
}

export type Assert<T extends Schema> = (x: any) => x is FromSchema<T>;

export function evaluate<const T extends Schema>(schema: Schema, keywords: KeywordMapping, options: Options = {}): Assert<T> {
    return Function(inspect(schema, keywords, options))();
}
