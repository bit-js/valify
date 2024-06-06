import { evaluate } from '.';
import suite from '@json-schema-org/tests';
import { expect, test, describe } from 'bun:test';

// eslint-disable-next-line
const tests = suite.loadSync();
const options = {
  allowNaN: false,
  strictStringWidth: true,
  noArrayObject: true
};
const ignoredSuites = ['refRemote'];

for (let i = 0, { length } = tests; i < length; ++i) {
  const item = tests[i];
  const { schemas } = item;

  if (ignoredSuites.includes(item.name)) continue;

  describe(item.name, () => {
    for (let i = 0, { length } = schemas; i < length; ++i) {
      const item = schemas[i];

      describe(`${item.description}: ${JSON.stringify(item.schema, null, 4)}`, () => {
        const f = evaluate(item.schema, options);
        const strF = f.toString();

        const fn = (e) => f(e) ? e : null;

        const { tests } = item;
        for (let i = 0, { length } = tests; i < length; ++i) {
          const item = tests[i];

          test(`${item.description}: ${JSON.stringify(item.data, null, 4)}: ${strF}`, () => {
            expect(fn(item.data)).toEqual(item.valid ? item.data : null);
          });
        }
      });
    }
  });
}

