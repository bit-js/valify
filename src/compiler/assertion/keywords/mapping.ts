/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import type { Schema } from '../../../types/schema';
import type { Context } from '../context';

import { arrayIdx, noTypeIdx, numberIdx, stringIdx } from './utils';

const mapping: Record<string, (ctx: Context, parentSchema: Exclude<Schema, boolean>, identifier: string) => void> = {
    // Generic keywords
    type: (ctx, { type }) => {
        if (typeof type === 'string') ctx.addType(type);
        else for (let i = 0, { length } = type!; i < length; ++i) ctx.addType(type![i]);
    },

    enum: (ctx, parentSchema, identifier) => {
        ctx.conditions[noTypeIdx].push(`${ctx.root.addDeclaration(parentSchema.enum)}.includes(${identifier})`);
    },

    const: (ctx, parentSchema, identifier) => {
        ctx.conditions[noTypeIdx].push(`${identifier}===${JSON.stringify(parentSchema.enum)}`);
    },

    // String
    minLength: (ctx, parentSchema, identifier) => {
        ctx.conditions[stringIdx].push(ctx.root.options.strictStringWidth
            ? `[...${identifier}].length>${parentSchema.minLength! - 1}`
            : `${identifier}.length>${parentSchema.minLength! - 1}`);
    },

    maxLength: (ctx, parentSchema, identifier) => {
        ctx.conditions[stringIdx].push(ctx.root.options.strictStringWidth
            ? `[...${identifier}].length<${parentSchema.maxLength! + 1}`
            : `${identifier}.length<${parentSchema.maxLength! + 1}`);
    },

    pattern: (ctx, parentSchema, identifier) => {
        ctx.conditions[stringIdx].push(`${new RegExp(parentSchema.pattern!).toString()}.test(${identifier})`);
    },

    // Number
    minimum: (ctx, parentSchema, identifier) => {
        ctx.conditions[numberIdx].push(`${identifier}>=${parentSchema.minimum}`);
    },

    maximum: (ctx, parentSchema, identifier) => {
        ctx.conditions[numberIdx].push(`${identifier}<=${parentSchema.maximum}`);
    },

    exclusiveMinimum: (ctx, parentSchema, identifier) => {
        ctx.conditions[numberIdx].push(`${identifier}>${parentSchema.exclusiveMinimum}`);
    },

    exclusiveMaximum: (ctx, parentSchema, identifier) => {
        ctx.conditions[numberIdx].push(`${identifier}<${parentSchema.exclusiveMaximum}`);
    },

    // Arrays
    minItems: (ctx, parentSchema, identifier) => {
        ctx.conditions[arrayIdx].push(`${identifier}.length>${parentSchema.minItems! - 1}`);
    },

    maxItems: (ctx, parentSchema, identifier) => {
        ctx.conditions[arrayIdx].push(`${identifier}.length<${parentSchema.maxItems! + 1}`);
    },

    uniqueItems: (ctx, parentSchema, identifier) => {
        if (parentSchema.uniqueItems === true)
            ctx.conditions[arrayIdx].push(`new Set(${identifier}).size===${identifier}.length`);
    },

    prefixItems: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { prefixItems } = parentSchema;
        const arrayConditions = ctx.conditions[arrayIdx];

        for (let i = 0, { length } = prefixItems!; i < length; ++i) arrayConditions.push(root.compileConditions(prefixItems![i], `${identifier}[${i}]`));
    },

    items: (ctx, parentSchema, identifier) => {
        const { items } = parentSchema;
        const { root } = ctx;
        const arrayConditions = ctx.conditions[arrayIdx];

        if (Array.isArray(items))
            for (let i = 0, { length } = items; i < length; ++i) arrayConditions.push(root.compileConditions((items as Schema[])[i], `${identifier}[${i}]`));
        else {
            arrayConditions.push('prefixItems' in parentSchema
                ? `${root.addFunc(`(x)=>{for(let i=${(parentSchema.prefixItems as any[]).length},{length}=x;i<length;++i)if(!(${root.compileConditions(items as Schema, `${identifier}[i]`)}))return false;return true;}`)}(${identifier})`
                : `${identifier}.every((x)=>${root.compileConditions(items as Schema, 'x')})`);
        }
    },

    additionalItems: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { additionalItems } = parentSchema;

        ctx.conditions[arrayIdx].push(Array.isArray(parentSchema.items)
            ? `${root.addFunc(`(x)=>{for(let i=${parentSchema.items.length},{length}=x;i<length;++i)if(!(${root.compileConditions(additionalItems!, `${identifier}[i]`)}))return false;return true;}`)}(${identifier})`
            : `${identifier}.every((x)=>${root.compileConditions(additionalItems!, 'x')})`);
    },

    // Array contains
    minContains: (ctx, parentSchema, identifier) => {
        // Other case is handled by contains
        if (!('contains' in parentSchema))
            ctx.conditions[arrayIdx].push(`${identifier}.length>${parentSchema.minContains! - 1}`);
    },

    maxContains: (ctx, parentSchema, identifier) => {
        // Other case is handled by contains
        if (!('contains' in parentSchema))
            ctx.conditions[arrayIdx].push(`${identifier}.length<${parentSchema.maxContains! + 1}`);
    },

    contains: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { minContains, maxContains, contains } = parentSchema;

        if (typeof minContains === 'number' || typeof maxContains === 'number')
            ctx.conditions[arrayIdx].push(`${root.addFunc(`(x)=>{let c=0;for(let i=0,{length}=x;i<length;++i)c+=${root.compileConditions(contains!, 'x[i]')};return c>${typeof minContains === 'number' ? minContains - 1 : 0}${typeof maxContains === 'number' ? `&&c<${maxContains + 1}` : ''};}`)}(${identifier})`);
    }
};

export default mapping;
