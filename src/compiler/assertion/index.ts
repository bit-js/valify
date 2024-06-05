import type { Schema, FromSchema } from '../../types/schema';
import { RootContext, type Options } from './context';

export function inspect(schema: Schema, options: Options = {}): string {
    const root = new RootContext(options);
    const conditions = root.compileConditions(schema, 'x');
    return `${root.declarations.join(';')};return (x)=>${conditions}`;
}

export function evaluate<T extends Schema>(schema: Schema, options: Options = {}): ((x: any) => x is FromSchema<T>) {
    return Function(inspect(schema, options))();
}
