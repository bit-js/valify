import type { Schema } from '../types/schema';

export const cache = new Map<string, any>();

/* eslint-disable */
export async function resolve<T extends Schema>(schema: T): Promise<T> {
  if (typeof schema === 'object') {
    const { $ref } = schema;

    if ($ref === undefined) {
      const cloneSchema = { ...schema };

      for (const key in cloneSchema)
        // @ts-expect-error Resolve properties
        cloneSchema[key] = await resolve(schema[key]);

      return cloneSchema;
    } else {
      const obj = cache.get(schema.$ref!);

      if (obj === undefined) {
        const value = await (await fetch($ref)).json();
        cache.set($ref, value);
        return value;
      }

      return obj;
    }
  }

  return schema;
}
