export const noTypeIdx = 0;

export const stringIdx = 1;
export const stringCode = 1 << stringIdx;

export const numberIdx = 2;
export const numberCode = 1 << numberIdx;

export const intIdx = 2;
export const intCode = 1 << 7;

export const arrayIdx = 3;
export const arrayCode = 1 << arrayIdx;

export const objectIdx = 4;
export const objectCode = 1 << objectIdx;

export const boolCode = 1 << 5;
export const nullCode = 1 << 6;

export function createConditionArray(): string[][] {
    return [[], [], [], [], []];
}
