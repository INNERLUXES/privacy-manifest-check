# Limits

## Names in text, not a compiler

- **The code is matched by name.** The tool does not parse Swift or Objective-C and does not know types. `stat(` is taken for the C function wherever it is not written after a dot; a function of your own with that name, called without a dot, is reported. A name that is a property of many types (`creationDate` is also a property of photo assets, for one) is looked for only in the forms that point at the file API: `FileAttributeKey.creationDate`, a subscript such as `attributes[.creationDate]`, `NSFileCreationDate`, the URL resource keys. A read such as `values.creationDate` on the result of `resourceValues(forKeys:)` is not seen on its own; the key passed to that call (`.creationDateKey`) is.
- **Names built at run time are not seen.** An API reached through a string, a selector built from text, `dlsym`, or a wrapper in a file that is not scanned.
- **Other spellings.** The Objective-C constants that stand for the Swift symbols (`NSFileModificationDate` and the like) are covered, listed in docs/method.md. Other ways to reach the same data are not: SwiftUI's `@AppStorage` and `@SceneStorage` read user defaults without writing the word `UserDefaults`, `NSUbiquitousKeyValueStore` and Core Foundation preference calls are not on Apple's list for the category and are not looked for, and `mach_continuous_time` is a different function from the one on the list.
- **Strings.** The inside of a string literal is not code, including a Swift string interpolation: `"\(UserDefaults.standard.string(forKey: k))"` is not seen. A call inside an interpolation is rare; if you write one, expect it to be missed.
- **Languages.** Only `.swift`, `.m`, `.mm` and `.h` files are read. C and C++ files (`.c`, `.cpp`, `.cc`), Rust, and code in other build systems are not, although they can call the same C functions.
- **Conditional code.** `#if` blocks are read as written, so a call that is compiled out for the target (for macOS only, for a debug build) is still counted.

## What the manifests cover

- **One project, one comparison.** All the manifests found in the folder together declare what all the code found in the folder calls. Apple's documentation says the manifest of the bundle that holds a call reports it, so a project with several targets, each with its own manifest, is judged more kindly than Apple will: a call in one target is counted as declared if any manifest in the folder declares the category. To check targets separately, run the tool on the folder of each.
- **Third-party code.** `Pods`, `Carthage`, `build`, `DerivedData`, `.git` and `node_modules` are left out by default, and so is a Swift package checked out under one of them. The libraries should ship their own manifests; the tool does not check that they do, or what a binary framework calls. `--include-deps` reads them, with the same limits as any other folder, and then a call in a library is compared with the manifests found in the whole folder, which is rarely what Apple does.
- **Where the manifest sits.** Whether a `PrivacyInfo.xcprivacy` is a resource of the right target (Xcode needs it in the target's resources) cannot be seen from the file, and is not checked.
- **Reasons are claims.** The tool checks that a code is one of those Apple approves for the category. It cannot tell whether the reason is true for the way the app uses the data; each reason carries conditions, for example that the information may not leave the device, which are Apple's text to read and the developer's to meet.
- **SDK-only reasons.** `0A2A.1` and `C56D.1` may be declared only by a third-party SDK. The tool accepts them in any project, because it cannot tell an app from an SDK.
- **Apple's list changes.** Apple says it reviews the categories and the approved reasons from time to time. The tables in `src/data.js` are those of the saved pages; a category or a code added later is reported as unknown (`unknown-api-category`, `invalid-reason`) until the tool is updated, and a request for a new approved reason is made with Apple, not here.

## What the tool does not check

- Nothing in it checks the tracking claim itself: whether the app really tracks, whether the listed domains are the right ones, or whether the data types a manifest lists are all the data the app collects. It compares the keys with each other and with Apple's lists of values.
- The App Store privacy details ("nutrition label") in App Store Connect, the privacy policy and App Tracking Transparency prompts are not read.
- Signature and manifest requirements for named third-party SDKs are not checked. Apple publishes that list on its page about third-party SDK requirements, and it changes.
- tvOS and visionOS projects are read in the same way, but the examples and the wording are for iOS, iPadOS and watchOS.

## Size

- A source or manifest file over 10 MB is not read: a source file is left out with a note, a manifest is a `parse-error`.
- A manifest with XML nested more than 64 deep, or with more than 200,000 elements, is refused.
- The walk stops after 200,000 directory entries and goes no deeper than 64 folders; a note says so when it happens.
- Text shown in a report is cut to a fixed length: 300 characters for a name, a subject or a path, 1,200 for a message or a fix, 600 for a note.

Every limit is reported, as a finding, a note or a stopped run, so a cut is never silent.
