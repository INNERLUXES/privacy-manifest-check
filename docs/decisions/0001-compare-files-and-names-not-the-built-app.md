# 1. Compare the manifests with the code by name, from the files

## Context

The tool needs to tell whether the privacy manifests of an app or SDK describe the required reason API that its code calls. There are richer ways to know what an app calls: build it and read the privacy report that Xcode generates from an archive, link-time or symbol analysis of the binary, a full Swift parse with SwiftSyntax or the compiler's own index, or a run on a device with tracing. Each of them needs Xcode on a macOS machine, a working build with signing set up, and often network access to resolve packages, and a build runs the code in build phases and plugins. The people who need the answer most often need it before a build exists: on a pull request that adds a call or edits a manifest, in a pipeline on Linux, or in a review of a project sent by someone else.

## Decision

The tool reads the project as files. Manifests are read as XML property lists by a small reader inside the tool that refuses DOCTYPE and entity declarations. Source files are read as text; comments and the inside of string literals are blanked, and the required reason API of Apple's list is found by its written name, in Swift and in the Objective-C spelling of the same symbols. The categories, symbols, reason codes, data types and purposes are Apple's, saved from the official documentation, and a test keeps the tables and the saved text equal. The tool never runs Xcode or any other program, never compiles, never decodes a binary file and never fetches anything.

## Consequences

The check runs in a second, on Windows, Linux or macOS, with only Node, no Xcode, no network access and no credentials, and no input can make it run code or reach out to a host. The same files always give the same report, so it can run on every pull request and gate a release branch. The cost is that it sees names, not types: it can report a call that is not the API, and it can miss an API reached through a name built at run time, through a library it is not given, or in a language it does not read. The tool says what it left out, keeps the patterns narrow where a name is ambiguous, lists the limits in docs/limits.md, and points to the privacy report of Xcode and a review of the built app as the next step.
