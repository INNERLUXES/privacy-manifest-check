## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a check, a pattern or a reader is described in docs/method.md, and has a test with the manifest and the source written inline, and a near miss that must not match
- [ ] A change to a category, an API symbol, a reason code, a data type or a purpose follows Apple's documentation: the new page text is saved in research/sources, `src/data.js` and docs/required-reason-api.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText`, and no line of source or string value reaches a report; the tool still runs no Xcode or `plutil`, fetches nothing, opens no connection and follows no symbolic link
- [ ] Paths are opened with `path.resolve`, shown relative with forward slashes, and file and folder names are compared exactly, so the result is the same on Linux, macOS and Windows
- [ ] No real manifest or source file and no real key, token or signing identity in fixtures or examples
- [ ] The commit messages of this pull request follow Conventional Commits
