# Changes

## 1.0.0

First release.

- Checks the privacy manifests (`PrivacyInfo.xcprivacy`) of an iOS, iPadOS or watchOS app or SDK project against the required reason API that its Swift and Objective-C code calls. Reads files only; never runs Xcode, `plutil` or a build and never fetches anything.
- Reads each manifest as an XML property list with a small strict reader that refuses DOCTYPE and ENTITY declarations and every entity except the five XML predefines, skips only the exact public plist DOCTYPE line, and stops at the line of anything that is not well-formed. Binary plists are refused with the `plutil` command that converts them.
- Scans `.swift`, `.m`, `.mm` and `.h` files for the APIs of the five categories Apple lists: file timestamp, system boot time, disk space, active keyboards and user defaults. Comments and string literals are blanked first, so line numbers are right and a mention is not a call. `Pods`, `Carthage`, `build`, `DerivedData`, `.git` and `node_modules` are left out unless `--include-deps` is given.
- The categories, their API symbols, every approved reason code, the collected data types and the purposes come from Apple's documentation, are kept in `src/data.js`, and are compared by a test with the saved text of the pages in `research/sources`.
- Fifteen checks: `parse-error`, `no-manifest`, `undeclared-api`, `no-reason`, `invalid-reason`, `tracking-without-domains`, `domains-without-tracking`, `data-type-incomplete`, `unknown-data-type`, `unknown-purpose`, `unknown-api-category`, `duplicate-category`, `malformed-entry`, `invalid-value` and `unused-category`.
- Every finding has an id, a severity, the file and line, the subject, a message and a fix.
- Reports as text, Markdown, JSON and CSV; `--fail-on` for a pipeline gate; exit code `2` for a usage or input error.
- Safe input: only the folder given is read, symbolic links are not followed, files over 10 MB are refused, XML nested more than 64 deep and more than 200,000 elements are refused, no line of source and no string value is printed, and control characters are removed from every text shown.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
