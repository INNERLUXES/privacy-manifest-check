# Method

The tool answers one question: does the privacy manifest of this project say what the code of the project does? It reads the `PrivacyInfo.xcprivacy` files as data, scans the Swift and Objective-C source as text, compares the two, and turns each difference into a finding with a severity, a file and a line. It never runs Xcode, `plutil` or a build, and it never fetches anything.

Everything it knows about categories, API symbols, reason codes, data types and purposes comes from Apple's documentation of privacy manifests, saved under [research/sources](../research/sources) and listed in [required-reason-api.md](required-reason-api.md). A test compares the tables in `src/data.js` with those saved pages, so the tool and its sources cannot drift apart without a failing test.

## What a privacy manifest is

A privacy manifest is a property list named `PrivacyInfo.xcprivacy` that an app or a third-party SDK carries in its bundle. Apple's page [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) says it records the types of data the app or SDK collects, and the required reason API it uses on iOS, iPadOS, tvOS, visionOS and watchOS. Four top-level keys matter here:

- `NSPrivacyTracking`: a boolean, whether the app or SDK uses data for tracking as App Tracking Transparency defines it. Apple's documentation gives its default as false.
- `NSPrivacyTrackingDomains`: an array of the internet domains the app or SDK connects to for tracking. Apple's page says that when the user has not granted tracking permission, requests to these domains fail, and that to provide the list `NSPrivacyTracking` is set to true.
- `NSPrivacyCollectedDataTypes`: an array of dicts, one per type of data collected, each with `NSPrivacyCollectedDataType`, `NSPrivacyCollectedDataTypeLinked`, `NSPrivacyCollectedDataTypeTracking` and `NSPrivacyCollectedDataTypePurposes`.
- `NSPrivacyAccessedAPITypes`: an array of dicts, one per category of required reason API used, each with `NSPrivacyAccessedAPIType` and `NSPrivacyAccessedAPITypeReasons`.

Apple's page [Describing use of required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api) says that if the API is used in the code of an app, the app's manifest reports it, and if it is used in the code of a third-party SDK, the SDK's own manifest reports it; an SDK cannot rely on the manifests of the apps that link it. It also says the declared reasons must be approved reasons that accurately reflect the use, and that the APIs and the data derived from them may be used for the declared reasons only.

## How the files are read

**The folder.** The folder given on the command line is walked in name order. The walk skips `Pods`, `Carthage`, `build`, `DerivedData`, `.git` and `node_modules`, at any depth, unless `--include-deps` is given; the names are compared exactly, letter case included. Symbolic links are not followed. A file is a manifest when its name is exactly `PrivacyInfo.xcprivacy`; it is a source file when its extension is exactly `.swift`, `.m`, `.mm` or `.h`. The lists are sorted by the path below the folder, written with forward slashes, so the order is the same on Linux, macOS and Windows.

**The property list.** The XML reader is the one described in [secure-defaults.md](secure-defaults.md): it refuses a DOCTYPE or ENTITY declaration before reading anything in it, refuses every entity but the five predefined ones, and skips only the exact public plist DOCTYPE line that Xcode writes. It keeps `dict`, `array`, `string`, `integer`, `real`, `date`, `data`, `true` and `false`, and the line of every key and value. A key given twice in one dict, a tag that is not closed, a second root, nesting deeper than 64 levels or more than 200,000 elements are refused, and the file becomes a `parse-error` finding with its line. A binary property list (it starts with `bplist`) is refused with the command that converts it: `plutil -convert xml1 -o converted.plist PrivacyInfo.xcprivacy`.

**The model.** From the property list the tool keeps the four keys above. A value of the wrong type under a known key (a string where a boolean is needed) is left out of the model and reported as `invalid-value`; the read goes on.

**The source files.** Each source file is read as text, up to 10 MB. Comments and the inside of string literals are replaced by spaces first, so a mention in a comment or in a string is not a call, and line numbers do not move. Swift block comments nest; C ones do not. Swift raw strings (`#"..."#`) and multi-line strings (`"""`) are understood, and in `.m`, `.mm` and `.h` files so are character literals and escaped quotes. After that each line is matched against the patterns in `src/detect.js`. Only the name of the API and the position are kept; no line of source is ever put in a report.

## Which symbols are looked for

Apple's page for `NSPrivacyAccessedAPIType` lists the APIs of each category. The tool looks for them by the names written below. Swift code and Objective-C code use different spellings for some of them; the Objective-C constants named here are the constants of the same symbols (`NSFileModificationDate` is the Objective-C name of `FileAttributeKey.modificationDate`), and that mapping is the tool's own, not a line of Apple's page.

| Category | Found in code as |
| --- | --- |
| File timestamp | `FileAttributeKey.creationDate`, `FileAttributeKey.modificationDate`, or `[.creationDate]` and `[.modificationDate]` as a subscript; `NSFileCreationDate`, `NSFileModificationDate`; `fileModificationDate`; `contentModificationDateKey`, `creationDateKey`, `NSURLContentModificationDateKey`, `NSURLCreationDateKey`; the calls `stat(`, `fstat(`, `fstatat(`, `lstat(`, `getattrlist(`, `getattrlistat(`, `fgetattrlist(`, `getattrlistbulk(` |
| System boot time | `systemUptime`; the call `mach_absolute_time(` |
| Disk space | `volumeAvailableCapacityKey`, `volumeAvailableCapacityForImportantUsageKey`, `volumeAvailableCapacityForOpportunisticUsageKey`, `volumeTotalCapacityKey` and their `NSURLVolume...Key` forms; `FileAttributeKey.systemFreeSize`, `FileAttributeKey.systemSize` or as a subscript; `NSFileSystemFreeSize`, `NSFileSystemSize`; the calls `statfs(`, `statvfs(`, `fstatfs(`, `fstatvfs(`, `getattrlist(`, `getattrlistat(`, `fgetattrlist(` |
| Active keyboards | `activeInputModes` |
| User defaults | `UserDefaults`, `NSUserDefaults` |

`getattrlist`, `getattrlistat` and `fgetattrlist` are in two categories on Apple's page (file timestamp and disk space), so one call counts for both. A name has to stand alone: `UserDefaultsKey` or `mystat(` is not a match, and `stat(` after a dot is a method of another type, not the C function. The pattern for a symbol that is a plain property name (`creationDate` alone) is deliberately narrow, because the same name is a property of many unrelated types; `docs/limits.md` says what that costs.

## The checks

The tool reads all manifests found in the folder together and compares them with all the code found in it. A finding names the manifest or source file and line it points at.

| Id | Severity | Rule and why it matters |
| --- | --- | --- |
| `parse-error` | error | A `PrivacyInfo.xcprivacy` that is not a well-formed XML property list, or is binary, or holds a top value that is not a dict, or is over the size limit. Xcode cannot use it either, and nothing in it can be checked. The file and the line of the fault are shown, the other manifests are still checked, and the code is compared with the manifests that could be read |
| `no-manifest` | error | No `PrivacyInfo.xcprivacy` exists in the folder (not even an unreadable one) and the code calls required reason API. The finding points at the first call and names every category used. Apple's page says an upload that uses required reason API without describing the reason is not accepted |
| `undeclared-api` | error | A category is called in code and no readable manifest declares it with `NSPrivacyAccessedAPIType`. One finding per category, at its first call, with the number of calls and files and the symbols seen. The fix lists the reason codes Apple approves for that category |
| `no-reason` | error | A category is declared, and `NSPrivacyAccessedAPITypeReasons` is empty or missing. Apple's page says the dictionary needs both keys, and a declaration without a reason says nothing about the use |
| `invalid-reason` | error | A value in `NSPrivacyAccessedAPITypeReasons` that is not one of the codes Apple approves for that category. Codes are compared exactly: `ca92.1`, `CA92.1 ` and an empty string are invalid. When the code is valid for another category the message names it, which is the usual slip (a file timestamp code copied under user defaults) |
| `tracking-without-domains` | warning | `NSPrivacyTracking` is true and `NSPrivacyTrackingDomains` is empty or missing. Apple's page asks for the domains the app or SDK connects to for tracking when tracking is declared. It is a warning, because the domains may be set elsewhere in a larger project, and a person should decide |
| `domains-without-tracking` | warning | `NSPrivacyTrackingDomains` lists domains and `NSPrivacyTracking` is false or missing. Apple's page says to set `NSPrivacyTracking` to true to provide the list, and that requests to the listed domains fail when the user has not granted tracking permission, so the two keys disagree |
| `data-type-incomplete` | warning | An entry of `NSPrivacyCollectedDataTypes` lacks `NSPrivacyCollectedDataTypeLinked`, `NSPrivacyCollectedDataTypeTracking` or `NSPrivacyCollectedDataTypePurposes`, or has an empty purposes array. Apple's page lists all of them as the keys of the dictionary |
| `unknown-data-type` | warning | An `NSPrivacyCollectedDataType` value that is not one of the 35 values Apple lists. Apple's page says Xcode does not generate the privacy report correctly with a data type of your own |
| `unknown-purpose` | warning | A value in `NSPrivacyCollectedDataTypePurposes` that is not one of the 6 values Apple lists, for the same reason |
| `unknown-api-category` | warning | An `NSPrivacyAccessedAPIType` that is not one of the five categories on Apple's page. Apple says it reviews the list from time to time and adds categories; the tool cannot judge the reasons of a category it does not know, so it says so and moves on. Update the tool or check the spelling |
| `duplicate-category` | warning | The same category appears twice in one manifest. The reasons of both entries count as declared; the second entry is the one reported |
| `malformed-entry` | warning | An entry of `NSPrivacyAccessedAPITypes` that is not a dict or has no string `NSPrivacyAccessedAPIType`, or an entry of `NSPrivacyCollectedDataTypes` that is not a dict or has no `NSPrivacyCollectedDataType` |
| `invalid-value` | warning | A known key holds a value of the wrong type: `NSPrivacyTracking` or a `Linked` or `Tracking` flag that is not a boolean, a list that is not an array of strings |
| `unused-category` | info | A category is declared and no scanned code calls it. It is info because the call may be in code this scan cannot read (a precompiled library, another language) and a declaration is harmless; it is worth a look because a reason for an API that is not used is a claim nobody can check. Not reported when no source file was scanned |

Severities: an **error** is a difference that makes the manifest wrong or missing for code that is there. A **warning** is a manifest entry that is inconsistent or that Xcode's privacy report cannot use as written. **Info** is a fact for a reviewer.

## What the gate does

`--fail-on error` (the default) fails the run when there is at least one error. `--fail-on warning` fails it on a warning too. The exit code is `0` when no finding reaches that level and `1` otherwise. A usage or input error (no folder, a folder that does not exist, an unknown option) is `2`. The report always says which gate ran and why it failed.

## Order of findings

Errors first, then warnings, then info; inside a severity by the order of the checks above, then by file, line and subject. The same folder always gives the same report.
