import { arrayCode, boolCode, intCode, noTypeIdx, nullCode, numberCode, objectCode, stringCode, stringIdx, numberIdx, arrayIdx, objectIdx, createConditionArray, type KeywordMapping } from './keywords/utils';
import type { Schema } from '../../types/schema';

export interface Options {
    noNonFiniteNumber?: boolean;
    strictStringWidth?: boolean;
    noArrayObject?: boolean;
    accurateMultipleOf?: boolean;
    unicodeAwareRegex?: boolean;
}

export class RootContext {
    /**
     * Store all functions in the scope
     */
    public readonly declarations: string[];

    /**
     * Compiler options
     */
    public readonly options: Required<Options>;

    /**
     * Keywords mappings
     */
    public readonly keywords: KeywordMapping;

    public constructor(options: Options, keywords: KeywordMapping) {
        this.keywords = keywords;
        this.declarations = [];

        options.noNonFiniteNumber ??= false;
        options.strictStringWidth ??= false;
        options.noArrayObject ??= false;
        options.accurateMultipleOf ??= false;
        options.unicodeAwareRegex ??= false;

        // @ts-expect-error Unset properties have been handled previously
        this.options = options;
    }

    public addDeclaration(value: any): string {
        const { declarations } = this;

        const name = `f${declarations.length}`;
        declarations.push(`const ${name}=${JSON.stringify(value)};`);

        return name;
    }

    public addFunc(value: string): string {
        const { declarations } = this;

        const name = `f${declarations.length}`;
        declarations.push(`const ${name}=${value};`);

        return name;
    }

    public compileConditions(schema: Schema, identifier: string): string {
        if (schema === false) return `${identifier}===undefined`;
        if (schema === true) return `${identifier}!==undefined`;

        const { keywords } = this;

        const ctx = new Context(this);
        // eslint-disable-next-line
        for (const key in schema) keywords[key]?.(ctx, schema, identifier);

        return ctx.finalize(identifier);
    }
}

export class Context {
    public readonly root: RootContext;

    // Stores the attached conditions of different types
    public readonly conditions: string[][];

    // Track whether a type has been specified
    private typeSet: number;

    public constructor(root: RootContext) {
        this.root = root;
        this.conditions = createConditionArray();
        this.typeSet = 0;
    }

    public addType(type: string | undefined): void {
        if (typeof type === 'string') {
            switch (type.charCodeAt(2)) {
                // String & Array schema
                case 114:
                    this.typeSet |= type.charCodeAt(3) === 105 ? stringCode : arrayCode;
                    break;

                // Number schema
                case 109:
                    this.typeSet |= numberCode;
                    break;

                // Integer schema
                case 116:
                    this.typeSet |= intCode;
                    break;

                // Object schema
                case 106:
                    this.typeSet |= objectCode;
                    break;

                // Bool schema
                case 111:
                    this.typeSet |= boolCode;
                    break;

                // Nil schema
                case 108:
                    this.typeSet |= nullCode;
                    break;
            }
        }
    }

    public finalize(identifier: string): string {
        const finalConditions = [];
        const { typeSet, conditions } = this;

        if (conditions[stringIdx].length !== 0) {
            finalConditions.push((typeSet & stringCode) === stringCode
                ? `(typeof ${identifier}==='string'&&${conditions[stringIdx].join('&&')})`
                : `(typeof ${identifier}!=='string'||${conditions[stringIdx].join('&&')})`);
        } else if ((typeSet & stringCode) === stringCode)
            finalConditions.push(`typeof ${identifier}==='string'`);

        if (conditions[arrayIdx].length !== 0) {
            finalConditions.push((typeSet & arrayCode) === arrayCode
                ? `(Array.isArray(${identifier})&&${conditions[arrayIdx].join('&&')})`
                : `(!Array.isArray(${identifier})||${conditions[arrayIdx].join('&&')})`);
        } else if ((typeSet & arrayCode) === arrayCode)
            finalConditions.push(`Array.isArray(${identifier})`);

        if (conditions[numberIdx].length !== 0) {
            finalConditions.push((typeSet & numberCode) === numberCode
                ? this.root.options.noNonFiniteNumber
                    ? `(Number.isFinite(${identifier})&&${conditions[numberIdx].join('&&')})`
                    : `(typeof ${identifier}==='number'&&${conditions[numberIdx].join('&&')})`

                : (typeSet & intCode) === intCode
                    ? `(Number.isInteger(${identifier})&&${conditions[numberIdx].join('&&')})`
                    : this.root.options.noNonFiniteNumber
                        ? `(!Number.isFinite(${identifier})||${conditions[numberIdx].join('&&')})`
                        : `(typeof ${identifier}!=='number'||${conditions[numberIdx].join('&&')})`);
        } else if ((typeSet & numberCode) === numberCode) {
            finalConditions.push(this.root.options.noNonFiniteNumber
                ? `Number.isFinite(${identifier})`
                : `typeof ${identifier}==='number'`);
        } else if ((typeSet & intCode) === intCode)
            finalConditions.push(`Number.isInteger(${identifier})`);

        if (conditions[objectIdx].length !== 0) {
            finalConditions.push((typeSet & objectCode) === objectCode
                ? this.root.options.noArrayObject
                    ? `(typeof ${identifier}==='object'&&${identifier}!==null&&!Array.isArray(${identifier})&&${conditions[objectIdx].join('&&')})`
                    : `(typeof ${identifier}==='object'&&${identifier}!==null&&${conditions[objectIdx].join('&&')})`
                : this.root.options.noArrayObject
                    ? `(${identifier}===null||typeof ${identifier}!=='object'||Array.isArray(${identifier})||${conditions[objectIdx].join('&&')})`
                    : `(${identifier}===null||typeof ${identifier}!=='object'||${conditions[objectIdx].join('&&')})`);
        } else if ((typeSet & objectCode) === objectCode) {
            finalConditions.push(this.root.options.noArrayObject
                ? `typeof ${identifier}==='object'&&${identifier}!==null&&!Array.isArray(${identifier})`
                : `typeof ${identifier}==='object'&&${identifier}!==null`);
        }

        if ((typeSet & boolCode) === boolCode)
            finalConditions.push(`typeof ${identifier}==='boolean'`);
        if ((typeSet & nullCode) === nullCode)
            finalConditions.push(`${identifier}===null`);

        return conditions[noTypeIdx].length === 0
            ? finalConditions.length === 0 ? `${identifier}!==undefined` : finalConditions.join('||')
            : finalConditions.length === 0 ? conditions[noTypeIdx].join('&&') : `(${finalConditions.join('||')})&&${conditions[noTypeIdx].join('&&')}`;
    }
}
