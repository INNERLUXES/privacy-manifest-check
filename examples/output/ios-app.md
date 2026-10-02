## privacy-manifest-check: 1 error, 1 warning, 1 info

Folder: `examples/ios-app`. Source files: 3 scanned, 3 call required reason API.

| Manifest | Settings |
| --- | --- |
| examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy | tracking false; 0 tracking domains; 1 collected data type; declares UserDefaults, DiskSpace |

| Required reason API in code | Calls | Files | Declared |
| --- | --- | --- | --- |
| File timestamp | 2 | 2 | no |
| User defaults | 2 | 2 | yes |

| Severity | Check | Where | Message | Fix |
| --- | --- | --- | --- | --- |
| error | undeclared-api | examples/ios-app/OrdersApp/Legacy/OrderSync.m:17 | File timestamp API (NSFileModificationDate, modificationDate) is called 2 times in 2 files, first here, and no PrivacyInfo.xcprivacy declares NSPrivacyAccessedAPICategoryFileTimestamp | Add an NSPrivacyAccessedAPITypes entry for NSPrivacyAccessedAPICategoryFileTimestamp with the reason that matches the use. Apple lists: DDA9.1, C617.1, 3B52.1, 0A2A.1 |
| warning | data-type-incomplete | examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:11 | NSPrivacyCollectedDataTypeEmailAddress lacks NSPrivacyCollectedDataTypeTracking, NSPrivacyCollectedDataTypePurposes | Give every collected data type its Linked and Tracking booleans and at least one purpose |
| info | unused-category | examples/ios-app/OrdersApp/PrivacyInfo.xcprivacy:29 | Disk space (NSPrivacyAccessedAPICategoryDiskSpace) is declared, and no scanned code calls it | Remove the entry if no code or linked SDK in this target calls the API; keep it if the call is in code this scan does not read (a precompiled library, another language) |

- left out 1 kind of folder (Pods); use --include-deps to read them

**Gate failed:** 1 error.
