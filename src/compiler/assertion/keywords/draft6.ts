/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import type { Schema } from '../../../types/schema';
import { accessor, arrayIdx, noTypeIdx, numberIdx, objectIdx, stringIdx, type KeywordMapping } from './utils';

const mapping: KeywordMapping = {
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
        ctx.conditions[stringIdx].push(`${(ctx.root.options.unicodeAwareRegex ? new RegExp(parentSchema.pattern!, 'u') : new RegExp(parentSchema.pattern!)).toString()}.test(${identifier})`);
    },

    // Number
    multipleOf: (ctx, parentSchema, identifier) => {
        ctx.conditions[numberIdx].push(ctx.root.options.accurateMultipleOf ? `${identifier}/${parentSchema.multipleOf}%1===0` : `${identifier}%${parentSchema.multipleOf}===0`);
    },

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

    items: (ctx, parentSchema, identifier) => {
        const { items } = parentSchema;
        const { root } = ctx;
        const arrayConditions = ctx.conditions[arrayIdx];

        if (Array.isArray(items))
            for (let i = 0, { length } = items; i < length; ++i) arrayConditions.push(`${identifier}.length===${i}||${root.compileConditions((items as Schema[])[i], `${identifier}[${i}]`)}`);
        else
            arrayConditions.push(`${identifier}.every((x)=>${root.compileConditions(items as Schema, 'x')})`);
    },

    additionalItems: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { additionalItems } = parentSchema;

        if (additionalItems === false) {
            if (Array.isArray(parentSchema.items))
                ctx.conditions[arrayIdx].push(`${identifier}.length===${parentSchema.items.length}`);
        } else {
            ctx.conditions[arrayIdx].push(Array.isArray(parentSchema.items)
                ? `${root.addFunc(`(x)=>{for(let i=${parentSchema.items.length},{length}=x;i<length;++i)if(!(${root.compileConditions(additionalItems!, `${identifier}[i]`)}))return false;return true;}`)}(${identifier})`
                : `${identifier}.every((x)=>${root.compileConditions(additionalItems!, 'x')})`);
        }
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

        ctx.conditions[arrayIdx].push(typeof minContains === 'number' || typeof maxContains === 'number'
            ? `${root.addFunc(`(x)=>{let c=0;for(let i=0,{length}=x;i<length;++i)c+=${root.compileConditions(contains!, 'x[i]')};return c>${typeof minContains === 'number' ? minContains - 1 : 0}${typeof maxContains === 'number' ? `&&c<${maxContains + 1}` : ''};}`)}(${identifier})`
            : `${identifier}.some((x)=>${root.compileConditions(contains!, 'x')})`);
    },

    // Dependent object keywords
    properties: (ctx, parentSchema, identifier) => {
        const {
            properties = {},
            required = []
        } = parentSchema;

        const { root } = ctx;
        const objectConditions = ctx.conditions[objectIdx];

        for (const key in properties) {
            const propIdentifier = accessor(identifier, key);
            const conditions = [root.compileConditions(properties[key], propIdentifier)];

            objectConditions.push(required.includes(key)
                ? conditions.join('&&')
                : `(${propIdentifier}===undefined||${conditions.join('&&')})`);
        }
    },

    required: (ctx, parentSchema, identifier) => {
        const { properties = {} } = parentSchema;
        const objectConditions = ctx.conditions[objectIdx];

        const { required } = parentSchema;
        for (let i = 0, { length } = required!; i < length; ++i) {
            const key = required![i];
            if (!(key in properties))
                objectConditions.push(`${accessor(identifier, key)}!==undefined`);
        }
    },

    dependentRequired: (ctx, parentSchema, identifier) => {
        const objectConditions = ctx.conditions[objectIdx];

        const { dependentRequired } = parentSchema;
        for (const key in dependentRequired!) {
            const conditions = [];

            const dependencies = dependentRequired[key];
            for (let i = 0, { length } = dependencies; i < length; ++i) conditions.push(`${accessor(identifier, dependencies[i])}!==undefined`);

            objectConditions.push(`(${accessor(identifier, key)}===undefined||${conditions.join('&&')})`);
        }
    },

    dependentSchemas: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const objectConditions = ctx.conditions[objectIdx];

        const { dependentSchemas } = parentSchema;
        for (const key in dependentSchemas!) objectConditions.push(`(${accessor(identifier, key)}===undefined||${root.compileConditions(dependentSchemas[key], identifier)})`);
    },

    additionalProperties: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { additionalProperties, patternProperties, properties } = parentSchema;

        const conditions = [];

        if (properties !== undefined) conditions.push(`${root.addDeclaration(Object.keys(properties))}.includes(k)`);
        if (patternProperties !== undefined)
            for (const regex in patternProperties) conditions.push(`${new RegExp(regex).toString()}.test(k)`);

        if (additionalProperties !== false)
            conditions.push(root.compileConditions(additionalProperties!, `${identifier}[k]`));
        ctx.conditions[objectIdx].push(`Object.keys(${identifier}).every((k)=>${conditions.join('||')})`);
    },

    // Independent object keywords
    patternProperties: (ctx, parentSchema, identifier) => {
        const { root } = ctx;
        const { patternProperties } = parentSchema;

        const conditions: string[] = [];
        for (const key in patternProperties) conditions.push(`(!${(ctx.root.options.unicodeAwareRegex ? new RegExp(key, 'u') : new RegExp(key)).toString()}.test(k)||${root.compileConditions(patternProperties[key], `${identifier}[k]`)})`);

        if (conditions.length !== 0)
            ctx.conditions[objectIdx].push(`Object.keys(${identifier}).every((k)=>${conditions.join('&&')})`);
    },

    propertyNames: (ctx, parentSchema, identifier) => {
        ctx.conditions[objectIdx].push(`Object.keys(${identifier}).every((k)=>${ctx.root.compileConditions(parentSchema.propertyNames!, 'k')})`);
    },

    minProperties: (ctx, parentSchema, identifier) => {
        ctx.conditions[objectIdx].push(`Object.keys(${identifier}).length>${parentSchema.minProperties! - 1}`);
    },

    maxProperties: (ctx, parentSchema, identifier) => {
        ctx.conditions[objectIdx].push(`Object.keys(${identifier}).length<${parentSchema.maxProperties! + 1}`);
    }
};

export default mapping;
