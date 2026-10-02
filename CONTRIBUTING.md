# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux, Windows and macOS, the repository checks, CodeQL, and a secure development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, with `!` for a breaking change.

## Changing a check

1. Describe the change in docs/method.md first: what the check reports, its severity, and why it matters, with the page of Apple's documentation it follows. Where the tool makes its own choice (which names count as a call of an API, what is a warning and what is an error), say so and say why.
2. Add a test with the manifest and the source written inline, small enough that the result can be worked out by hand. Use made-up bundle ids and host names (`com.example.orders`, `example.test`).
3. Text from the input goes through `safeText` before it reaches a finding or a note, so control characters are removed. Never put a line of source or the value of a string literal into a finding.
4. A finding id, once released, keeps its meaning: pipelines and other tools read it from the JSON and CSV reports.

## Changing the tables

The categories, API symbols, reason codes, data types and purposes in `src/data.js` come from Apple's documentation. When Apple changes a page, save the new text in `research/sources` (the address on the first line, the data address on the second), change `src/data.js` to match, and update docs/required-reason-api.md. `test/data.test.js` compares the tables with the saved text, so changing one without the other fails. Never add a reason code, a category or a data type from memory or from a blog post.

## Changing the detection

1. Add a test for every form you add and one for a near miss that must not match: a longer name that contains the symbol, a call after a dot, the name in a comment or in a string.
2. Keep every pattern anchored on a name and free of nested repetition.
3. A name that is a property of many unrelated types is matched only in the forms that point at the file or system API; say so in docs/method.md and docs/limits.md.
4. Paths are opened with `path.resolve`, never `path.join`, so an absolute path works on every system. Paths shown in a report are relative, with forward slashes. File and folder names are compared exactly, letter case included, on every system. Do not assume that a backslash is a separator on Linux or macOS.

## Changing the readers

1. For the XML and plist readers, add a test for every form you add and one that must be refused. Keep refusing DOCTYPE and ENTITY declarations and every entity except the five XML predefines; the plist DOCTYPE line stays an exact match. A form that cannot be read with certainty is refused, never guessed.
2. Keep the size, depth and element limits.

## Rules for the code

- No runtime dependencies. Node 22 or newer and nothing else.
- The tool reads the folder it is given and writes only to the screen. It opens no network connection, runs no program (no Xcode, no `plutil`, no shell), and never follows a URL, a symbolic link or a path from an input.
- Source files stay ASCII; write any other character in a pattern as a `\u` escape.
- Never commit a real manifest or a real source file, even as a fixture. Write small made-up files, and never put a real key, token or signing identity into one, even an expired one.

## Before you open the pull request

```
npm test
npm run check
npm run example
```
