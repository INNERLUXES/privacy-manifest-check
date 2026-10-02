// The tables the checks are built on, taken from Apple's documentation of privacy manifests. The text they
// come from is kept in research/sources, and a test compares these tables with it, so a change in one
// without the other fails. docs/required-reason-api.md shows them as tables.
//
// apis holds the symbols exactly as Apple lists them for the category. How the tool finds them in source
// code is in detect.js. Reasons marked sdkOnly are the wrapper reasons Apple allows only third-party SDKs to
// declare.

const DOCS = 'https://developer.apple.com/documentation/bundleresources';

export const SOURCES = [
  { name: 'Privacy manifest files', url: `${DOCS}/privacy-manifest-files` },
  { name: 'Describing use of required reason API', url: `${DOCS}/describing-use-of-required-reason-api` },
  { name: 'NSPrivacyAccessedAPIType', url: `${DOCS}/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype` },
  { name: 'NSPrivacyAccessedAPITypeReasons', url: `${DOCS}/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons` },
  { name: 'Describing data use in privacy manifests', url: `${DOCS}/describing-data-use-in-privacy-manifests` },
  { name: 'NSPrivacyCollectedDataType', url: `${DOCS}/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype` },
  { name: 'NSPrivacyCollectedDataTypePurposes', url: `${DOCS}/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatypepurposes` },
  { name: 'NSPrivacyTracking', url: `${DOCS}/app-privacy-configuration/nsprivacytracking` },
  { name: 'NSPrivacyTrackingDomains', url: `${DOCS}/app-privacy-configuration/nsprivacytrackingdomains` }
];

export const MANIFEST_NAME = 'PrivacyInfo.xcprivacy';

export const API_CATEGORIES = [
  {
    id: 'NSPrivacyAccessedAPICategoryFileTimestamp',
    name: 'File timestamp',
    apis: [
      'creationDate', 'modificationDate', 'fileModificationDate', 'contentModificationDateKey', 'creationDateKey',
      'getattrlist(_:_:_:_:_:)', 'getattrlistbulk(_:_:_:_:_:)', 'fgetattrlist(_:_:_:_:_:)', 'stat', 'fstat(_:_:)',
      'fstatat(_:_:_:_:)', 'lstat(_:_:)', 'getattrlistat(_:_:_:_:_:_:)'
    ],
    reasons: [
      { code: 'DDA9.1', summary: 'show file timestamps to the person using the device' },
      { code: 'C617.1', summary: 'read timestamps, size or other metadata of files inside the app container, the app group container or the app CloudKit container' },
      { code: '3B52.1', summary: 'read timestamps, size or other metadata of files or directories the user granted access to, such as through a document picker' },
      { code: '0A2A.1', summary: 'a third-party SDK that wraps file timestamp API for the app to call', sdkOnly: true }
    ]
  },
  {
    id: 'NSPrivacyAccessedAPICategorySystemBootTime',
    name: 'System boot time',
    apis: ['systemUptime', 'mach_absolute_time()'],
    reasons: [
      { code: '35F9.1', summary: 'measure the time elapsed between events inside the app, or run timers' },
      { code: '8FFB.1', summary: 'calculate absolute timestamps for events inside the app, such as UIKit or AVFAudio events' },
      { code: '3D61.1', summary: 'include system boot time in an optional bug report the person chooses to submit' }
    ]
  },
  {
    id: 'NSPrivacyAccessedAPICategoryDiskSpace',
    name: 'Disk space',
    apis: [
      'volumeAvailableCapacityKey', 'volumeAvailableCapacityForImportantUsageKey', 'volumeAvailableCapacityForOpportunisticUsageKey',
      'volumeTotalCapacityKey', 'systemFreeSize', 'systemSize', 'statfs(_:_:)', 'statvfs(_:_:)', 'fstatfs(_:_:)', 'fstatvfs(_:_:)',
      'getattrlist(_:_:_:_:_:)', 'fgetattrlist(_:_:_:_:_:)', 'getattrlistat(_:_:_:_:_:_:)'
    ],
    reasons: [
      { code: '85F4.1', summary: 'show disk space information to the person using the device' },
      { code: 'E174.1', summary: 'check that there is enough disk space to write files, or delete files when space is low, with behaviour users can see' },
      { code: '7D9E.1', summary: 'include disk space information in an optional bug report the person chooses to submit' },
      { code: 'B728.1', summary: 'a health research app that warns participants about low disk space affecting data collection' }
    ]
  },
  {
    id: 'NSPrivacyAccessedAPICategoryActiveKeyboards',
    name: 'Active keyboards',
    apis: ['activeInputModes'],
    reasons: [
      { code: '3EC4.1', summary: 'a custom keyboard app that finds out which keyboards are active' },
      { code: '54BD.1', summary: 'show a user interface that fits the active keyboards, with behaviour users can see' }
    ]
  },
  {
    id: 'NSPrivacyAccessedAPICategoryUserDefaults',
    name: 'User defaults',
    apis: ['UserDefaults'],
    reasons: [
      { code: 'CA92.1', summary: 'read and write information only the app itself can access' },
      { code: '1C8F.1', summary: 'read and write information only the apps, extensions and App Clips of the same App Group can access' },
      { code: 'C56D.1', summary: 'a third-party SDK that wraps user defaults API for the app to call', sdkOnly: true },
      { code: 'AC6B.1', summary: 'read the managed app configuration set by MDM, or write MDM feedback' }
    ]
  }
];

export const DATA_TYPES = [
  'NSPrivacyCollectedDataTypeName',
  'NSPrivacyCollectedDataTypeEmailAddress',
  'NSPrivacyCollectedDataTypePhoneNumber',
  'NSPrivacyCollectedDataTypePhysicalAddress',
  'NSPrivacyCollectedDataTypeOtherUserContactInfo',
  'NSPrivacyCollectedDataTypeHealth',
  'NSPrivacyCollectedDataTypeFitness',
  'NSPrivacyCollectedDataTypePaymentInfo',
  'NSPrivacyCollectedDataTypeCreditInfo',
  'NSPrivacyCollectedDataTypeOtherFinancialInfo',
  'NSPrivacyCollectedDataTypePreciseLocation',
  'NSPrivacyCollectedDataTypeCoarseLocation',
  'NSPrivacyCollectedDataTypeSensitiveInfo',
  'NSPrivacyCollectedDataTypeContacts',
  'NSPrivacyCollectedDataTypeEmailsOrTextMessages',
  'NSPrivacyCollectedDataTypePhotosorVideos',
  'NSPrivacyCollectedDataTypeAudioData',
  'NSPrivacyCollectedDataTypeGameplayContent',
  'NSPrivacyCollectedDataTypeCustomerSupport',
  'NSPrivacyCollectedDataTypeOtherUserContent',
  'NSPrivacyCollectedDataTypeBrowsingHistory',
  'NSPrivacyCollectedDataTypeSearchHistory',
  'NSPrivacyCollectedDataTypeUserID',
  'NSPrivacyCollectedDataTypeDeviceID',
  'NSPrivacyCollectedDataTypePurchaseHistory',
  'NSPrivacyCollectedDataTypeProductInteraction',
  'NSPrivacyCollectedDataTypeAdvertisingData',
  'NSPrivacyCollectedDataTypeOtherUsageData',
  'NSPrivacyCollectedDataTypeCrashData',
  'NSPrivacyCollectedDataTypePerformanceData',
  'NSPrivacyCollectedDataTypeOtherDiagnosticData',
  'NSPrivacyCollectedDataTypeEnvironmentScanning',
  'NSPrivacyCollectedDataTypeHands',
  'NSPrivacyCollectedDataTypeHead',
  'NSPrivacyCollectedDataTypeOtherDataTypes'
];

export const PURPOSES = [
  'NSPrivacyCollectedDataTypePurposeThirdPartyAdvertising',
  'NSPrivacyCollectedDataTypePurposeDeveloperAdvertising',
  'NSPrivacyCollectedDataTypePurposeAnalytics',
  'NSPrivacyCollectedDataTypePurposeProductPersonalization',
  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
  'NSPrivacyCollectedDataTypePurposeOther'
];

const BY_ID = new Map(API_CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id) {
  return BY_ID.get(id) ?? null;
}

// The category an unknown-for-this-category reason code belongs to, or null when no category has it.
export function categoryOfReason(code) {
  return API_CATEGORIES.find((c) => c.reasons.some((r) => r.code === code)) ?? null;
}
