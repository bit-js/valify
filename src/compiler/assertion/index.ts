import type { Schema, FromSchema } from '../../types/schema';
import { RootContext, type Options } from './context';

export function inspect(schema: Schema, options: Options = {}): string {
    const root = new RootContext(options);
    const conditions = root.compileConditions(schema, 'x');
    return `${root.declarations.join(';')};return (x)=>${conditions}`;
}

export type Assert<T extends Schema> = (x: any) => x is FromSchema<T>;

export function evaluate<const T extends Schema>(schema: Schema, options: Options = {}): Assert<T> {
    return Function(inspect(schema, options))();
}
