import { evaluate, inspect, keywords } from '.';
import { expect, describe, test } from 'bun:test';
import loadSuites from '../../../tests';

const suitesMap = await loadSuites('draft6');

const ignoredSuites = [
  // eslint-disable-next-line
  'refRemote', 'ref', 'infinite-loop-detection',
  // eslint-disable-next-line
  'format',
  // eslint-disable-next-line
  'oneOf', 'anyOf', 'allOf', 'not', 'if-then-else',
  // eslint-disable-next-line
  'definitions', 'default', 'dependencies'
];

for (const suiteName in suitesMap) {
  if (ignoredSuites.includes(suiteName)) continue;

  const suites = suitesMap[suiteName];
  for (let i = 0, suiteLen = suites.length; i < suiteLen; ++i) {
    const suite = suites[i];

    try {
      const fn = evaluate(suite.schema, keywords.draft6, {
        noArrayObject: true,
        strictStringWidth: true,
        unicodeAwareRegex: true,
        accurateMultipleOf: true
      });

      describe(suite.description, () => {
        describe(`Schema: ${JSON.stringify(suite.schema, null, 4)}`, () => {
          describe(fn.toString(), () => {
            const { tests } = suite;

            for (let j = 0, { length } = tests; j < length; ++j) {
              const item = tests[j];

              describe(item.description, () => {
                test(`Data: ${JSON.stringify(item.data, null, 4)}`, () => {
                  expect(fn(item.data)).toBe(item.valid)
                });
              });
            }
          });

        });
      });

    } catch (e) {
      console.error(e.message);
      console.error(`Compile error of schema: ${JSON.stringify(suite.schema, null, 4)}`);
      console.error(inspect(suite.schema, keywords.draft6, {
        noArrayObject: true,
        strictStringWidth: true,
        unicodeAwareRegex: true,
        accurateMultipleOf: true
      }));
      process.exit(1);
    }
  }
}

