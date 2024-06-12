# Valify

A JSON schema library.

## Assertion

Valify includes a compiler to compile JSON schemas to assertion functions.

```ts
import { schema } from "@bit-js/valify";
import { evaluate, keywords } from "@bit-js/valify/compiler/assertion";

const User = schema({
  type: "object",

  required: ["name", "age"],
  properties: {
    name: {
      type: "string",
      minLength: 3,
      maxLength: 32,
    },

    age: {
      type: "integer",
      exclusiveMinimum: 0,
      exclusiveMaximum: 150,
    },
  },
});

const isUser = evaluate(User, keywords.draft6);
```

To compile the schema ahead-of-time:

```ts
import { schema } from "@bit-js/valify";
import { inspect, keywords } from "@bit-js/valify/compiler/assertion";

const User = schema({
  type: "object",

  required: ["name", "age"],
  properties: {
    name: {
      type: "string",
      minLength: 3,
      maxLength: 32,
    },

    age: {
      type: "integer",
      exclusiveMinimum: 0,
      exclusiveMaximum: 150,
    },
  },
});

const content = `export const isUser=(()=>{${inspect(User, keywords.draft6)}})();`;
```

Compilation options include:

```ts
evaluate(User, keywords.draft6, {
  // Does not count `Number.NaN`, `Number.POSITIVE_INFINITY` and `Number.NEGATIVE_INFINITY` as valid numbers if set to true
  noNonFiniteNumber: true, // Default: false

  // Handle string width correctly for Unicode characters if set to true
  strictStringWidth: true, // Default: false

  // Use `Object.hasOwn` instead of directly accessing the property and check its value if set to true
  strictPropertyCheck: true, // Default: false

  // Array does not count as objects if set to true
  noArrayObject: true, // Default: false

  // Handle `multipleOf` keyword correctly for numbers below 1 if set to true
  accurateMultipleOf: true, // Default: false

  // Handle Unicode regular expressions correctly if set to true
  unicodeAwareRegex: true, // Default: false

  // Do deep comparisons for `uniqueItems`, `enum` and `const` keywords if set to false
  fastAssertions: false, // Default: false
});
```

## Note

This library is experimental and still in active development.

Currently only draft 6 keywords (without `format`, `$ref` and `$id` keywords) are supported.
