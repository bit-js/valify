/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import type { Schema } from '../../../types/schema';
import { accessor, analyzeDeepEqual, deepEquals, type KeywordMapping } from './utils';

const mapping: KeywordMapping = [
    {
        // Generic keywords
        type: (ctx, { type }) => {
            if (typeof type === 'string') ctx.addType(type);
            else for (let i = 0, { length } = type!; i < length; ++i) ctx.addType(type![i]);
        },

        enum: (ctx, parentSchema, identifier) => {
            ctx.otherConditions.push(ctx.root.options.fastAssertions
                ? `${ctx.root.addDeclaration(parentSchema.enum)}.includes(${identifier})`
                : `((${(parentSchema.enum as any[]).map((item) => analyzeDeepEqual(identifier, item)).join(')||(')}))`);
        },

        const: (ctx, parentSchema, identifier) => {
            ctx.otherConditions.push(analyzeDeepEqual(identifier, parentSchema.const));
        },

        // String
        minLength: (ctx, parentSchema, identifier) => {
            ctx.stringConditions.push(ctx.root.options.strictStringWidth
                ? `[...${identifier}].length>${parentSchema.minLength! - 1}`
                : `${identifier}.length>${parentSchema.minLength! - 1}`);
        },

        maxLength: (ctx, parentSchema, identifier) => {
            ctx.stringConditions.push(ctx.root.options.strictStringWidth
                ? `[...${identifier}].length<${parentSchema.maxLength! + 1}`
                : `${identifier}.length<${parentSchema.maxLength! + 1}`);
        },

        pattern: (ctx, parentSchema, identifier) => {
            ctx.stringConditions.push(`${ctx.getRegexString(parentSchema.pattern!)}.test(${identifier})`);
        },

        // Number
        multipleOf: (ctx, parentSchema, identifier) => {
            ctx.numberConditions.push(ctx.root.options.accurateMultipleOf ? `${identifier}/${parentSchema.multipleOf}%1===0` : `${identifier}%${parentSchema.multipleOf}===0`);
        },

        minimum: (ctx, parentSchema, identifier) => {
            ctx.numberConditions.push(`${identifier}>=${parentSchema.minimum}`);
        },

        maximum: (ctx, parentSchema, identifier) => {
            ctx.numberConditions.push(`${identifier}<=${parentSchema.maximum}`);
        },

        exclusiveMinimum: (ctx, parentSchema, identifier) => {
            ctx.numberConditions.push(`${identifier}>${parentSchema.exclusiveMinimum}`);
        },

        exclusiveMaximum: (ctx, parentSchema, identifier) => {
            ctx.numberConditions.push(`${identifier}<${parentSchema.exclusiveMaximum}`);
        },

        // Arrays
        minItems: (ctx, parentSchema, identifier) => {
            ctx.arrayConditions.push(`${identifier}.length>${parentSchema.minItems! - 1}`);
        },

        maxItems: (ctx, parentSchema, identifier) => {
            ctx.arrayConditions.push(`${identifier}.length<${parentSchema.maxItems! + 1}`);
        },

        uniqueItems: (ctx, parentSchema, identifier) => {
            if (parentSchema.uniqueItems === true) {
                ctx.arrayConditions.push(ctx.root.options.fastAssertions
                    ? `${identifier}.every((x,i,a)=>a.indexOf(x,i+1)===-1)`
                    : `${identifier}.every((x,i,a)=>a.findLastIndex((y)=>${ctx.root.includeFunc(deepEquals)}(x,y))===i)`);
            }
        },

        items: (ctx, parentSchema, identifier) => {
            // Items outside of allOf will be read first
            if (ctx.hasArrayItems) return;
            ctx.hasArrayItems = true;

            const { items } = parentSchema;
            const { root } = ctx;
            const { arrayConditions } = ctx;

            if (Array.isArray(items)) {
                const { length } = items;
                for (let i = 0; i < length; ++i) arrayConditions.push(`${identifier}.length===${i}||${root.compileConditions((items as Schema[])[i], `${identifier}[${i}]`)}`);
            } else
                arrayConditions.push(`${identifier}.every((x)=>${root.compileConditions(items as Schema, 'x')})`);
        },

        // Array contains
        minContains: (ctx, parentSchema, identifier) => {
            // Other case is handled by contains
            if (!('contains' in parentSchema))
                ctx.arrayConditions.push(`${identifier}.length>${parentSchema.minContains! - 1}`);
        },

        maxContains: (ctx, parentSchema, identifier) => {
            // Other case is handled by contains
            if (!('contains' in parentSchema))
                ctx.arrayConditions.push(`${identifier}.length<${parentSchema.maxContains! + 1}`);
        },

        contains: (ctx, parentSchema, identifier) => {
            const { root } = ctx;
            const { minContains, maxContains, contains } = parentSchema;

            ctx.arrayConditions.push(typeof minContains === 'number' || typeof maxContains === 'number'
                ? `${root.addFunc(`(x)=>{let c=0;for(let i=0,{length}=x;i<length;++i)c+=${root.compileConditions(contains!, 'x[i]')};return c>${typeof minContains === 'number' ? minContains - 1 : 0}${typeof maxContains === 'number' ? `&&c<${maxContains + 1}` : ''};}`)}(${identifier})`
                : `${identifier}.some((x)=>${root.compileConditions(contains!, 'x')})`);
        },

        // Object
        patternProperties: (ctx, { patternProperties }, identifier) => {
            const { root, objectConditions } = ctx;
            // eslint-disable-next-line
            objectConditions.push(`Object.keys(${identifier}).every((k)=>${Object.keys(patternProperties!).map(
                (key) => `(!${ctx.getRegexString(key)}.test(k)||${root.compileConditions(patternProperties![key], `${identifier}[k]`)})`
                // eslint-disable-next-line
            ).join('&&')})`);
        },

        dependencies: (ctx, { dependencies }, identifier) => {
            const { objectConditions } = ctx;

            for (const key in dependencies) {
                const dependency = dependencies[key];

                if (Array.isArray(dependency)) {
                    if (dependency.length === 0) continue;

                    objectConditions.push(ctx.root.options.strictPropertyCheck
                        ? `(!Object.hasOwn(${identifier},${JSON.stringify(key)})||${dependency.map((k) => `Object.hasOwn(${identifier},${JSON.stringify(k)})`).join('&&')})`
                        : `(${accessor(identifier, key)}===undefined||${dependency.map((k) => `${accessor(identifier, k as string)}!==undefined`).join('&&')})`);
                } else {
                    objectConditions.push(ctx.root.options.strictPropertyCheck
                        ? `(!Object.hasOwn(${identifier},${JSON.stringify(key)})||${ctx.root.compileConditions(dependency as Schema, identifier)})`
                        : `(${accessor(identifier, key)}===undefined||${ctx.root.compileConditions(dependency as Schema, identifier)})`);
                }
            }
        },

        propertyNames: (ctx, parentSchema, identifier) => {
            ctx.objectConditions.push(`Object.keys(${identifier}).every((k)=>${ctx.root.compileConditions(parentSchema.propertyNames!, 'k')})`);
        },

        minProperties: (ctx, parentSchema, identifier) => {
            ctx.objectConditions.push(`Object.keys(${identifier}).length>${parentSchema.minProperties! - 1}`);
        },

        maxProperties: (ctx, parentSchema, identifier) => {
            ctx.objectConditions.push(`Object.keys(${identifier}).length<${parentSchema.maxProperties! + 1}`);
        },

        required: (ctx, parentSchema, identifier) => {
            const { objectConditions } = ctx;
            const { strictPropertyCheck } = ctx.root.options;

            const { required } = parentSchema;
            for (let i = 0, { length } = required!; i < length; ++i) objectConditions.push(strictPropertyCheck ? `Object.hasOwn(${identifier},${JSON.stringify(required![i])})` : `${accessor(identifier, required![i])}!==undefined`);
        },

        properties: (ctx, parentSchema, identifier) => {
            const { properties, required } = parentSchema;

            const { root, objectConditions } = ctx;
            const { strictPropertyCheck } = ctx.root.options;

            for (const key in properties) {
                const propIdentifier = accessor(identifier, key);

                objectConditions.push(required?.includes(key)
                    ? root.compileConditions(properties[key], propIdentifier)
                    : strictPropertyCheck
                        ? `(!Object.hasOwn(${identifier},${JSON.stringify(key)})||${root.compileConditions(properties[key], propIdentifier)})`
                        : `(${propIdentifier}===undefined||${root.compileConditions(properties[key], propIdentifier)})`);
            }
        },

        // Dependent keywords
        additionalItems: (ctx, parentSchema, identifier) => {
            const { additionalItems, items } = parentSchema;
            if (!Array.isArray(items) && items !== undefined) return;

            const { root } = ctx;

            if (additionalItems === false) {
                if (Array.isArray(items))
                    ctx.arrayConditions.push(`${identifier}.length===${items.length}`);
            } else {
                ctx.arrayConditions.push(items === undefined || items.length === 0
                    ? `${identifier}.every((x)=>${root.compileConditions(additionalItems!, 'x')})`
                    : `${root.addFunc(`(x)=>{for(let i=${items.length},{length}=x;i<length;++i)if(!(${root.compileConditions(additionalItems!, `${identifier}[i]`)}))return false;return true;}`)}(${identifier})`);
            }
        },

        additionalProperties: (ctx, parentSchema, identifier) => {
            const conditions = [];

            if (parentSchema.properties !== undefined)
                conditions.push(...Object.keys(parentSchema.properties).map((key) => `k===${JSON.stringify(key)}`));
            if (parentSchema.patternProperties !== undefined)
                conditions.push(...Object.keys(parentSchema.patternProperties).map((key) => `${ctx.getRegexString(key)}.test(k)`));

            conditions.push(parentSchema.additionalProperties === false ? 'false' : ctx.root.compileConditions(parentSchema.additionalProperties!, `${identifier}[k]`));
            ctx.objectConditions.push(`Object.keys(${identifier}).every((k)=>${conditions.join('||')})`);
        }
    },
    {
        anyOf: (ctx, parentSchema, identifier) => {
            ctx.otherConditions.push(`((${parentSchema.anyOf!.map((subschema) => {
                const conditionContext = ctx.clone();
                conditionContext.evaluate(subschema, identifier);
                return conditionContext.finalize(identifier);
            }).join(')||(')}))`);
        },

        oneOf: (ctx, parentSchema, identifier) => {
            ctx.otherConditions.push(`(${parentSchema.oneOf!.map((subschema) => {
                const conditionContext = ctx.clone();
                conditionContext.evaluate(subschema, identifier);
                return conditionContext.finalize(identifier);
            }).join('?1:0)+(')}?1:0)===1`);
        },

        not: (ctx, parentSchema, identifier) => {
            ctx.otherConditions.push(`!(${ctx.root.compileConditions(parentSchema.not!, identifier)})`);
        },

        allOf: (ctx, parentSchema, identifier) => {
            const { allOf } = parentSchema;
            for (let i = 0, { length } = allOf!; i < length; ++i) ctx.evaluate(allOf![i], identifier);
        }
    }
];

export default mapping;
