# privacy-manifest-check

Checks the privacy manifests of an iOS, iPadOS or watchOS app or SDK project against the code that the project actually contains. It finds every `PrivacyInfo.xcprivacy` file, reads it as an XML property list, scans the `.swift`, `.m`, `.mm` and `.h` files for calls of Apple's required reason API (file timestamps, system boot time, disk space, active keyboards, user defaults), and reports a category that the code uses and no manifest declares, a declared category with no reason or with a reason code Apple does not list for it, tracking settings that disagree, collected data types that are incomplete, and a manifest that cannot be read. Every finding names the file and the line.

Apple asks every app and every third-party SDK to describe, in its privacy manifest, why it calls the APIs that can be used to fingerprint a device, and App Store Connect does not accept an upload that uses these APIs without a reason. The manifest is a small file that nobody opens again once it is written, and the code around it keeps changing: a new `UserDefaults` call in a feature, a file date read in a cache cleaner, a reason code copied from another category. None of them breaks a build. They show up later, as an email from App Review or a rejected upload. This tool compares the two in a second, so the check can run on every pull request.

- Every finding has an id, a severity (error, warning, info), the file, the line, a plain message and a fix.
- The categories, the API symbols of each one and every approved reason code come from Apple's documentation, are kept in [src/data.js](src/data.js), and a test compares them with the saved text of the pages in [research/sources](research/sources). [docs/required-reason-api.md](docs/required-reason-api.md) shows them as tables with their source addresses.
- The property list is read by a small, strict XML reader of its own that refuses a DOCTYPE or an entity declaration, so a manifest cannot make the tool expand entities or read another file. A binary plist is refused with the command that converts it.
- Code is scanned as text: comments and string literals are blanked first, then calls are matched by name. Nothing is compiled.
- Reports as text, Markdown, JSON and CSV, with an exit code for a pipeline gate.
- It reads files only. It never runs Xcode, `plutil` or a build, prints no line of source code, fetches nothing and opens no network connection.
- Plain JavaScript, no dependencies; the same files always give the same report.

```
npm test
```

```
ℹ tests 105
ℹ pass 105
ℹ fail 0
```

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/privacy-manifest-check.git
cd privacy-manifest-check
node bin/privacy-manifest-check.js examples/ios-app
```

Or without a clone, in the folder of your project:

```
npx --yes github:INNERLUXES/privacy-manifest-check .
```

`examples/` holds a made-up "orders" app. `examples/ios-app` is wrong on purpose: its manifest declares `UserDefaults` correctly, but the code also reads file modification dates (in Swift and in Objective-C) and the manifest does not declare the file timestamp category; it declares disk space, which nothing calls; and its one collected data type has no Tracking or Purposes key. A `Pods` folder with a made-up library is there to show that third-party code is left out. `examples/ios-app-fixed` is the same app with the manifest corrected. `examples/output` holds the reports of the first project in every format; `npm run example` writes them again and fails if the README no longer shows what a real run prints.

## Usage

```
node bin/privacy-manifest-check.js examples/ios-app
```

```
privacy-manifest-check: examples/ios-app
manifests: 1
  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy: tracking false; 0 tracking domains; 1 collected data type; declares UserDefaults, DiskSpace
source files: 3 scanned, 3 call required reason API
required reason API in code:
  File timestamp: 2 calls in 2 files, not declared
  User defaults: 2 calls in 2 files, declared
findings: 1 error, 1 warning, 1 info

ERROR    undeclared-api  examples/ios-app/OrdersApp/Legacy/OrderSync.m:17
         File timestamp API (NSFileModificationDate, modificationDate) is called 2 times in 2 files, first here, and no PrivacyInfo.xcprivacy declares NSPrivacyAccessedAPICategoryFileTimestamp
         fix: Add an NSPrivacyAccessedAPITypes entry for NSPrivacyAccessedAPICategoryFileTimestamp with the reason that matches the use. Apple lists: DDA9.1, C617.1, 3B52.1, 0A2A.1

WARNING  data-type-incomplete  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:11
         NSPrivacyCollectedDataTypeEmailAddress lacks NSPrivacyCollectedDataTypeTracking, NSPrivacyCollectedDataTypePurposes
         fix: Give every collected data type its Linked and Tracking booleans and at least one purpose

INFO     unused-category  examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:29
         Disk space (NSPrivacyAccessedAPICategoryDiskSpace) is declared, and no scanned code calls it
         fix: Remove the entry if no code or linked SDK in this target calls the API; keep it if the call is in code this scan does not read (a precompiled library, another language)

note: left out 1 kind of folder (Pods); use --include-deps to read them

GATE: FAIL - 1 error
```

The exit code is `1`: the undeclared file timestamp category is an error, and errors fail the run by default. The warning is a manifest entry Xcode's privacy report cannot use as it is, and the info line is a declaration to remove or to explain. The file in the report is the first call of the category; the JSON report lists every call.

The fixed app passes, also with `--fail-on warning`:

```
node bin/privacy-manifest-check.js examples/ios-app-fixed --fail-on warning
```

```
privacy-manifest-check: examples/ios-app-fixed
manifests: 1
  examples/ios-app-fixed/OrdersApp/PrivacyInfo.xcprivacy: tracking false; 0 tracking domains; 1 collected data type; declares FileTimestamp, UserDefaults
source files: 3 scanned, 3 call required reason API
required reason API in code:
  File timestamp: 2 calls in 2 files, declared
  User defaults: 2 calls in 2 files, declared
findings: 0 error, 0 warning, 0 info

no findings

GATE: PASS (--fail-on warning)
```

```
privacy-manifest-check <folder> [options]
```

```
--include-deps     also read Pods, Carthage, build, DerivedData, .git, node_modules
                   (left out by default)
--format <name>    text, markdown, json or csv (default: text)
--fail-on <level>  exit with 1 when a finding is at this level or above: error or warning
                   (default: error)
--help             show the usage
--version          show the version
```

Give the folder of the project, or of one app or SDK inside a larger repository. Paths in the report are relative to the folder you run the command in, with forward slashes on every system; a project outside it is shown with its absolute path.

By default these folders are not read, at any depth, and a note says which were left out: `Pods`, `Carthage`, `build`, `DerivedData`, `.git` and `node_modules`. Third-party code ships its own manifest and is not the project's code. `--include-deps` reads them too, which is useful to see what a vendored library calls. Symbolic links are not followed.

## Checks

| Id | Severity | What it reports |
| --- | --- | --- |
| `parse-error` | error | A `PrivacyInfo.xcprivacy` that is not a well-formed XML property list, or is a binary one; the file and the line are shown, and the other manifests are still checked |
| `no-manifest` | error | Required reason API is called in code and the folder has no `PrivacyInfo.xcprivacy` at all |
| `undeclared-api` | error | A category of required reason API is called in code and no manifest declares it |
| `no-reason` | error | A declared category has an empty or missing `NSPrivacyAccessedAPITypeReasons` |
| `invalid-reason` | error | A reason code that Apple does not list for that category; a code that belongs to another category is named |
| `tracking-without-domains` | warning | `NSPrivacyTracking` is true and `NSPrivacyTrackingDomains` is empty or missing |
| `domains-without-tracking` | warning | Tracking domains are listed and `NSPrivacyTracking` is false or missing |
| `data-type-incomplete` | warning | A collected data type without `NSPrivacyCollectedDataTypeLinked`, `NSPrivacyCollectedDataTypeTracking` or a non-empty `NSPrivacyCollectedDataTypePurposes` |
| `unknown-data-type` | warning | An `NSPrivacyCollectedDataType` value that Apple does not list |
| `unknown-purpose` | warning | An `NSPrivacyCollectedDataTypePurposes` value that Apple does not list |
| `unknown-api-category` | warning | An `NSPrivacyAccessedAPIType` value that Apple does not list; its reasons cannot be checked |
| `duplicate-category` | warning | The same category declared twice in one manifest |
| `malformed-entry` | warning | An entry of `NSPrivacyAccessedAPITypes` or `NSPrivacyCollectedDataTypes` that is not a dict or lacks its type key |
| `invalid-value` | warning | A value of the wrong type under a known key, such as a string where `NSPrivacyTracking` needs true or false |
| `unused-category` | info | A declared category that no scanned code calls |

[docs/method.md](docs/method.md) gives each check, its exact rule and why it matters, how the code is scanned, and which symbols are looked for in each category.

## Required reason API

The five categories Apple lists, with the number of approved reason codes of each:

| Category value | API | Reason codes |
| --- | --- | --- |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | file creation and modification dates, `stat` and the `getattrlist` family | `DDA9.1`, `C617.1`, `3B52.1`, `0A2A.1` |
| `NSPrivacyAccessedAPICategorySystemBootTime` | `systemUptime`, `mach_absolute_time()` | `35F9.1`, `8FFB.1`, `3D61.1` |
| `NSPrivacyAccessedAPICategoryDiskSpace` | volume capacity keys, `systemFreeSize`, `systemSize`, the `statfs` family | `85F4.1`, `E174.1`, `7D9E.1`, `B728.1` |
| `NSPrivacyAccessedAPICategoryActiveKeyboards` | `activeInputModes` | `3EC4.1`, `54BD.1` |
| `NSPrivacyAccessedAPICategoryUserDefaults` | `UserDefaults` | `CA92.1`, `1C8F.1`, `C56D.1`, `AC6B.1` |

[docs/required-reason-api.md](docs/required-reason-api.md) lists every symbol and what each reason code allows, with the address of each Apple page it comes from. The tool checks that a reason code is valid for its category. It cannot know whether the reason is true for your app: that is for you to decide, and the wording of each code in Apple's documentation says what the data may be used for.

## Formats

- `text`: for a terminal: the manifests, the categories used in code, the counts, then the findings, errors first, each with its check id, file and line, message and fix.
- `markdown`: the same for a pull request comment or the job summary. Pipes, line breaks and angle brackets from the input are escaped, so a name cannot break a table.
- `json`: the whole report: the manifests with their facts, every category used in code with every call (file, line, symbol), every finding with id, severity, file, line, subject, message and fix, the notes and the gate.
- `csv`: one row per finding, quoted as RFC 4180 says. A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.

To put the report in the job summary of a GitHub Actions run:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Privacy manifest report
    run: npx --yes github:INNERLUXES/privacy-manifest-check . --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Privacy manifest gate
    run: npx --yes github:INNERLUXES/privacy-manifest-check . --fail-on error
```

It needs no Xcode, no macOS runner and no secrets; a Linux runner is enough.

## Exit codes

`0` no finding at the `--fail-on` level, `1` at least one such finding (by default: an error), `2` a usage or input error (a missing folder, a missing option, an unknown format).

A manifest that cannot be read is not exit code `2`: it is a `parse-error` finding, so the run still reports everything else and the gate fails.

## Limits

The tool matches names in text. It does not compile the code, so it does not know which type a `stat` belongs to, it cannot see an API called through a name it builds at run time, and it does not read what a precompiled library or a Swift package dependency calls. A project is checked as one unit: all the manifests found together declare what all the code calls, so a manifest in one target does not cover a call in a sibling target that has its own. Whether a reason is true for the way your app uses the data is yours to judge. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Background

- How mobile apps are built and prepared for the store, with checks like this one in the pipeline: [mobile application development](https://innerluxes.dev/application/mobile/development).

## License

MIT
