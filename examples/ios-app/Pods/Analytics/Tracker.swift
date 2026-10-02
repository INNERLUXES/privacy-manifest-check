import Foundation

// A made-up third-party library. Pods/ is left out of the scan unless --include-deps is given, so this
// call of the boot time API is not part of the report; the library ships its own privacy manifest.
enum Tracker {
    static func now() -> UInt64 {
        mach_absolute_time()
    }
}
