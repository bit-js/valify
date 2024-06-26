import type { ExtendedJSONSchema, FromExtendedSchema } from 'json-schema-to-ts';

interface SchemaExtension extends Record<string, unknown> {
    minContains: number;
    maxContains: number;
}

export type Schema = ExtendedJSONSchema<SchemaExtension>;
export type FromSchema<T extends Schema> = FromExtendedSchema<SchemaExtension, T>;
