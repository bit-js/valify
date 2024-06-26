import { arrayCode, boolCode, intCode, nullCode, numberCode, objectCode, stringCode, type KeywordMapping } from './keywords/utils';
import type { Schema } from '../../types/schema';

export interface Options {
    /**
     * Does not count `Number.NaN`, `Number.POSITIVE_INFINITY` and `Number.NEGATIVE_INFINITY` as valid numbers
     */
    noNonFiniteNumber?: boolean;

    /**
     * Handle string width correctly for Unicode characters
     */
    strictStringWidth?: boolean;

    /**
     * Use `Object.hasOwn` instead of directly accessing the property and check its value
     */
    strictPropertyCheck?: boolean;

    /**
     * Array does not count as objects
     */
    noArrayObject?: boolean;

    /**
     * Handle `multipleOf` keyword correctly for numbers below 1
     */
    accurateMultipleOf?: boolean;

    /**
     * Handle Unicode regular expressions correctly
     */
    unicodeAwareRegex?: boolean;

    /**
     * Directly use `Set#size` for `uniqueItems` comparisons and `Array#includes` for `enum` comparisons
     */
    fastAssertions?: boolean;
}

export class RootContext {
    /**
     * Store all functions in the scope
     */
    public readonly declarations: string[];

    /**
     * Store the root schema
     */
    public readonly target: Schema;

    /**
     * Store all imported symbols
     */
    public readonly importMap: Record<any, string>;

    /**
     * Compiler options
     */
    public readonly options: Required<Options>;

    /**
     * Keywords mappings
     */
    public readonly keywords: KeywordMapping;

    public constructor(schema: Schema, options: Options, keywordMap: KeywordMapping) {
        this.target = schema;
        this.keywords = keywordMap;

        this.declarations = [];
        this.importMap = {};

        options.noNonFiniteNumber ??= false;
        options.strictStringWidth ??= false;
        options.strictPropertyCheck ??= false;
        options.noArrayObject ??= false;
        options.accurateMultipleOf ??= false;
        options.unicodeAwareRegex ??= false;
        options.fastAssertions ??= false;

        // @ts-expect-error Unset properties have been handled previously
        this.options = options;
    }

    public includeFunc(value: (...args: any[]) => any): string {
        // @ts-expect-error Map value pointers
        // eslint-disable-next-line
        return this.importMap[value] ??= this.addFunc(value.toString());
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

        const ctx = new Context(this);
        ctx.evaluate(schema, identifier);
        return ctx.finalize(identifier);
    }

    public evaluate(): string {
        const conditions = this.compileConditions(this.target, 'x');
        return `${this.declarations.join(';')};return function x0(x){return ${conditions}};`;
    }
}

export class Context {
    public readonly root: RootContext;

    // Stores the attached conditions of different types
    public readonly stringConditions: string[];
    public readonly numberConditions: string[];
    public readonly arrayConditions: string[];
    public readonly objectConditions: string[];
    public readonly otherConditions: string[];

    // Custom state
    public hasArrayItems: boolean;

    // Track whether a type has been specified
    private typeSet: number;

    public constructor(root: RootContext) {
        this.stringConditions = [];
        this.numberConditions = [];
        this.arrayConditions = [];
        this.objectConditions = [];
        this.otherConditions = [];

        this.hasArrayItems = false;

        this.root = root;
        this.typeSet = 0;
    }

    public clone(): Context {
        const ctx = new Context(this.root);
        ctx.typeSet = this.typeSet;
        return ctx;
    }

    public evaluate(schema: Schema, identifier: string): void {
        if (typeof schema === 'boolean')
            this.otherConditions.push(schema ? `${identifier}!==undefined` : `${identifier}===undefined`);
        else {
            const { keywords } = this.root;

            for (let i = 0, { length } = keywords; i < length; ++i) {
                const words = keywords[i];
                // eslint-disable-next-line
                for (const key in schema) words[key]?.(this, schema, identifier);
            }
        }
    }

    public getRegexString(key: string): string {
        return (this.root.options.unicodeAwareRegex ? new RegExp(key, 'u') : new RegExp(key)).toString();
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
        // Finalize conditions
        const finalConditions = [];
        const { typeSet } = this;

        if (this.stringConditions.length !== 0) {
            finalConditions.push((typeSet & stringCode) === stringCode
                ? `(typeof ${identifier}==='string'&&${this.stringConditions.join('&&')})`
                : `(typeof ${identifier}!=='string'||${this.stringConditions.join('&&')})`);
        } else if ((typeSet & stringCode) === stringCode)
            finalConditions.push(`typeof ${identifier}==='string'`);

        if (this.arrayConditions.length !== 0) {
            finalConditions.push((typeSet & arrayCode) === arrayCode
                ? `(Array.isArray(${identifier})&&${this.arrayConditions.join('&&')})`
                : `(!Array.isArray(${identifier})||${this.arrayConditions.join('&&')})`);
        } else if ((typeSet & arrayCode) === arrayCode)
            finalConditions.push(`Array.isArray(${identifier})`);

        if (this.numberConditions.length !== 0) {
            finalConditions.push((typeSet & numberCode) === numberCode
                ? this.root.options.noNonFiniteNumber
                    ? `(Number.isFinite(${identifier})&&${this.numberConditions.join('&&')})`
                    : `(typeof ${identifier}==='number'&&${this.numberConditions.join('&&')})`

                : (typeSet & intCode) === intCode
                    ? `(Number.isInteger(${identifier})&&${this.numberConditions.join('&&')})`
                    : this.root.options.noNonFiniteNumber
                        ? `(!Number.isFinite(${identifier})||${this.numberConditions.join('&&')})`
                        : `(typeof ${identifier}!=='number'||${this.numberConditions.join('&&')})`);
        } else if ((typeSet & numberCode) === numberCode) {
            finalConditions.push(this.root.options.noNonFiniteNumber
                ? `Number.isFinite(${identifier})`
                : `typeof ${identifier}==='number'`);
        } else if ((typeSet & intCode) === intCode)
            finalConditions.push(`Number.isInteger(${identifier})`);

        if (this.objectConditions.length !== 0) {
            finalConditions.push((typeSet & objectCode) === objectCode
                ? this.root.options.noArrayObject
                    ? `(typeof ${identifier}==='object'&&${identifier}!==null&&!Array.isArray(${identifier})&&${this.objectConditions.join('&&')})`
                    : `(typeof ${identifier}==='object'&&${identifier}!==null&&${this.objectConditions.join('&&')})`
                : this.root.options.noArrayObject
                    ? `(${identifier}===null||typeof ${identifier}!=='object'||Array.isArray(${identifier})||${this.objectConditions.join('&&')})`
                    : `(${identifier}===null||typeof ${identifier}!=='object'||${this.objectConditions.join('&&')})`);
        } else if ((typeSet & objectCode) === objectCode) {
            finalConditions.push(this.root.options.noArrayObject
                ? `typeof ${identifier}==='object'&&${identifier}!==null&&!Array.isArray(${identifier})`
                : `typeof ${identifier}==='object'&&${identifier}!==null`);
        }

        if ((typeSet & boolCode) === boolCode)
            finalConditions.push(`typeof ${identifier}==='boolean'`);
        if ((typeSet & nullCode) === nullCode)
            finalConditions.push(`${identifier}===null`);

        return this.otherConditions.length === 0
            ? finalConditions.length === 0 ? `${identifier}!==undefined` : finalConditions.join('||')
            : finalConditions.length === 0 ? this.otherConditions.join('&&') : `(${finalConditions.join('||')})&&${this.otherConditions.join('&&')}`;
    }
}

