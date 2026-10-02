# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "privacy-manifest-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up manifest, source file or folder layout that shows the problem, what you expected and what happened. Use made-up bundle ids, folder names and host names (such as `com.example.orders` and `example.test`), and no real keys, internal addresses or customer files.

## Scope

In scope:

- an input that makes the tool open a network connection, run a program (Xcode, `plutil`, a shell), or evaluate anything in a source file
- an input that makes the tool read a file other than the manifests and source files of the folder it was given, through a symbolic link, a path in a file or an entity
- a property list that makes the reader expand an entity, read another file, or accept a DOCTYPE other than the exact plist line described in docs/method.md
- a binary plist that the tool tries to decode instead of refusing
- an input that makes the tool hang, take very long, or use unbounded memory or stack, such as deep nesting, very many elements, a very long line or unclosed comment in a source file, a deep or looping folder tree, or a path that is not a regular file
- a line of source code, or the value of a string in a source file, that appears in a report
- text from a file name, a key, a value or a domain that breaks a Markdown table, injects a formula into a CSV report, or rewrites the terminal through control or direction characters
- a key name that changes how objects behave inside the tool
- a finding that docs/method.md says is reported, for an input the tool accepts, that the report leaves out

Out of scope: what the code of the app does with the data, the binaries of libraries, whether a declared reason is true, and Apple's rules themselves (docs/limits.md lists what a check of the files cannot see).

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
