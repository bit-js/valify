import { evaluate, inspect, keywords } from '.';
import { expect, describe, test } from 'bun:test';
import loadSuites from '../../../tests';

const suitesMap = await loadSuites('draft6');

const ignoredSuites = [
  // eslint-disable-next-line
  'ref',
  // eslint-disable-next-line
  'format',
  // eslint-disable-next-line
  'definitions', 'default', 'dependencies',
  // eslint-disable-next-line
  // These suites cannot be supported without using network requests
  'refRemote', 'definitions',
  // I don't care that's skill issue
  'infinite-loop-detection'
];

const selectedSuite: string | null = null;

for (const suiteName in suitesMap) {
  if (ignoredSuites.includes(suiteName)) continue;
  if (selectedSuite !== null && suiteName !== selectedSuite) continue;

  const suites = suitesMap[suiteName];
  for (let i = 0, suiteLen = suites.length; i < suiteLen; ++i) {
    const suite = suites[i];

    const args: Parameters<typeof evaluate> = [suite.schema, keywords.draft6, {
      noArrayObject: true,
      strictStringWidth: true,
      strictPropertyCheck: true,
      unicodeAwareRegex: true,
      accurateMultipleOf: true,
      noNonFiniteNumber: true,
      fastAssertions: false
    }];

    try {
      const fn = evaluate(...args);

      describe(suite.description, () => {
        describe(`Schema: ${JSON.stringify(suite.schema, null, 4)}`, () => {
          describe(fn.toString(), () => {
            const { tests } = suite;

            for (let j = 0, { length } = tests; j < length; ++j) {
              const item = tests[j];

              describe(item.description, () => {
                test(`Data: ${JSON.stringify(item.data, null, 4)} - Expected: ${item.valid}`, () => {
                  expect(fn(item.data)).toBe(item.valid);
                });
              });
            }
          });
        });
      });

    } catch (e) {
      console.error(e.message);
      console.error(`Compile error of schema: ${JSON.stringify(suite.schema, null, 4)}`);
      console.error(inspect(...args));

      process.exit(1);
    }
  }
}

