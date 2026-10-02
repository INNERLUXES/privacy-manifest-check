# Required reason API, data types and purposes

These are the values the tool validates against. They are taken from Apple's documentation of privacy manifests; the text of each page is saved in [research/sources](../research/sources), and `test/data.test.js` fails if `src/data.js` and the saved text differ. The reason summaries below are short paraphrases; the conditions of each reason (what the data may be used for, and that it may not be sent off the device in most cases) are in Apple's page and must be read there before a code is declared.

## Sources

- Privacy manifest files: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Describing use of required reason API: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- NSPrivacyAccessedAPIType: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype
- NSPrivacyAccessedAPITypeReasons: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons
- Describing data use in privacy manifests: https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests
- NSPrivacyCollectedDataType: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype
- NSPrivacyCollectedDataTypePurposes: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatypepurposes
- NSPrivacyTracking: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytracking
- NSPrivacyTrackingDomains: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains

The same pages are available as data under `https://developer.apple.com/tutorials/data/documentation/bundleresources/...json`; the saved text names that address on its second line.

## Categories of required reason API

Each entry in `NSPrivacyAccessedAPITypes` has an `NSPrivacyAccessedAPIType` (one of the five values below) and an `NSPrivacyAccessedAPITypeReasons` array of codes from the list of that category. The APIs line is the list on Apple's page for the category. A reason marked "SDK only" is one Apple allows only a third-party SDK to declare; the tool accepts it as valid and cannot tell whether the project is an SDK.

### File timestamp

Value: `NSPrivacyAccessedAPICategoryFileTimestamp`

APIs on Apple's page: `creationDate`, `modificationDate`, `fileModificationDate`, `contentModificationDateKey`, `creationDateKey`, `getattrlist(_:_:_:_:_:)`, `getattrlistbulk(_:_:_:_:_:)`, `fgetattrlist(_:_:_:_:_:)`, `stat`, `fstat(_:_:)`, `fstatat(_:_:_:_:)`, `lstat(_:_:)`, `getattrlistat(_:_:_:_:_:_:)`

| Reason code | Allows (short) |
| --- | --- |
| `DDA9.1` | show file timestamps to the person using the device |
| `C617.1` | read timestamps, size or other metadata of files inside the app container, the app group container or the app CloudKit container |
| `3B52.1` | read timestamps, size or other metadata of files or directories the user granted access to, such as through a document picker |
| `0A2A.1` | a third-party SDK that wraps file timestamp API for the app to call (SDK only) |

### System boot time

Value: `NSPrivacyAccessedAPICategorySystemBootTime`

APIs on Apple's page: `systemUptime`, `mach_absolute_time()`

| Reason code | Allows (short) |
| --- | --- |
| `35F9.1` | measure the time elapsed between events inside the app, or run timers |
| `8FFB.1` | calculate absolute timestamps for events inside the app, such as UIKit or AVFAudio events |
| `3D61.1` | include system boot time in an optional bug report the person chooses to submit |

### Disk space

Value: `NSPrivacyAccessedAPICategoryDiskSpace`

APIs on Apple's page: `volumeAvailableCapacityKey`, `volumeAvailableCapacityForImportantUsageKey`, `volumeAvailableCapacityForOpportunisticUsageKey`, `volumeTotalCapacityKey`, `systemFreeSize`, `systemSize`, `statfs(_:_:)`, `statvfs(_:_:)`, `fstatfs(_:_:)`, `fstatvfs(_:_:)`, `getattrlist(_:_:_:_:_:)`, `fgetattrlist(_:_:_:_:_:)`, `getattrlistat(_:_:_:_:_:_:)`

| Reason code | Allows (short) |
| --- | --- |
| `85F4.1` | show disk space information to the person using the device |
| `E174.1` | check that there is enough disk space to write files, or delete files when space is low, with behaviour users can see |
| `7D9E.1` | include disk space information in an optional bug report the person chooses to submit |
| `B728.1` | a health research app that warns participants about low disk space affecting data collection |

### Active keyboards

Value: `NSPrivacyAccessedAPICategoryActiveKeyboards`

APIs on Apple's page: `activeInputModes`

| Reason code | Allows (short) |
| --- | --- |
| `3EC4.1` | a custom keyboard app that finds out which keyboards are active |
| `54BD.1` | show a user interface that fits the active keyboards, with behaviour users can see |

### User defaults

Value: `NSPrivacyAccessedAPICategoryUserDefaults`

APIs on Apple's page: `UserDefaults`

| Reason code | Allows (short) |
| --- | --- |
| `CA92.1` | read and write information only the app itself can access |
| `1C8F.1` | read and write information only the apps, extensions and App Clips of the same App Group can access |
| `C56D.1` | a third-party SDK that wraps user defaults API for the app to call (SDK only) |
| `AC6B.1` | read the managed app configuration set by MDM, or write MDM feedback |

## Collected data types

The 35 values Apple lists for `NSPrivacyCollectedDataType`. Any other value is an `unknown-data-type` warning.

- `NSPrivacyCollectedDataTypeName`
- `NSPrivacyCollectedDataTypeEmailAddress`
- `NSPrivacyCollectedDataTypePhoneNumber`
- `NSPrivacyCollectedDataTypePhysicalAddress`
- `NSPrivacyCollectedDataTypeOtherUserContactInfo`
- `NSPrivacyCollectedDataTypeHealth`
- `NSPrivacyCollectedDataTypeFitness`
- `NSPrivacyCollectedDataTypePaymentInfo`
- `NSPrivacyCollectedDataTypeCreditInfo`
- `NSPrivacyCollectedDataTypeOtherFinancialInfo`
- `NSPrivacyCollectedDataTypePreciseLocation`
- `NSPrivacyCollectedDataTypeCoarseLocation`
- `NSPrivacyCollectedDataTypeSensitiveInfo`
- `NSPrivacyCollectedDataTypeContacts`
- `NSPrivacyCollectedDataTypeEmailsOrTextMessages`
- `NSPrivacyCollectedDataTypePhotosorVideos`
- `NSPrivacyCollectedDataTypeAudioData`
- `NSPrivacyCollectedDataTypeGameplayContent`
- `NSPrivacyCollectedDataTypeCustomerSupport`
- `NSPrivacyCollectedDataTypeOtherUserContent`
- `NSPrivacyCollectedDataTypeBrowsingHistory`
- `NSPrivacyCollectedDataTypeSearchHistory`
- `NSPrivacyCollectedDataTypeUserID`
- `NSPrivacyCollectedDataTypeDeviceID`
- `NSPrivacyCollectedDataTypePurchaseHistory`
- `NSPrivacyCollectedDataTypeProductInteraction`
- `NSPrivacyCollectedDataTypeAdvertisingData`
- `NSPrivacyCollectedDataTypeOtherUsageData`
- `NSPrivacyCollectedDataTypeCrashData`
- `NSPrivacyCollectedDataTypePerformanceData`
- `NSPrivacyCollectedDataTypeOtherDiagnosticData`
- `NSPrivacyCollectedDataTypeEnvironmentScanning`
- `NSPrivacyCollectedDataTypeHands`
- `NSPrivacyCollectedDataTypeHead`
- `NSPrivacyCollectedDataTypeOtherDataTypes`

## Purposes

The 6 values Apple lists for `NSPrivacyCollectedDataTypePurposes`. Any other value is an `unknown-purpose` warning.

- `NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising`
- `NSPrivacyCollectedDataTypePurposeDeveloperAdvertising`
- `NSPrivacyCollectedDataTypePurposeAnalytics`
- `NSPrivacyCollectedDataTypePurposeProductPersonalization`
- `NSPrivacyCollectedDataTypePurposeAppFunctionality`
- `NSPrivacyCollectedDataTypePurposeOther`
