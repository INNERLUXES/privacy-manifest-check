# Threat model

## What the tool touches

- It reads the folder named on the command line and the `PrivacyInfo.xcprivacy`, `.swift`, `.m`, `.mm` and `.h` files inside it, and nothing else. It does not follow a path or an address written inside a file, and it does not look at the folders around the one it was given.
- It writes only to the screen (standard output and standard error).
- It opens no network connection and runs no program: not Xcode, not `plutil`, not a shell.

## What the input may hold

A project folder is often checked in a pipeline that runs on pull requests, including pull requests from people outside the team, and a review may start from a project sent by a client or a vendor. The tool treats every file as possibly hostile. A manifest can hold a DOCTYPE with entity declarations meant to expand into gigabytes of text or to read another file or a network address, very deep nesting, very many elements, or a key meant to reach an object's prototype. It can hold a DOCTYPE that looks like Apple's line but adds an internal subset, or be a binary plist made to confuse a reader. A source file can be huge, hold a very long line made to slow a pattern down, or hold text that looks like a call inside a comment. A folder can hold a symbolic link that points out of it or in a loop, a device or a pipe in place of a file, a very deep tree, or file names with control characters, direction characters or text meant for a spreadsheet or a Markdown table.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A DOCTYPE defines entities that expand exponentially (a "billion laughs" file) or an external entity that reads a local file or a network address | The XML reader refuses any DOCTYPE or ENTITY declaration before it reads what is inside, and refuses every entity except the five that XML predefines. The one plist DOCTYPE line Xcode writes is matched exactly, with no internal subset, and skipped as text; the DTD it names is never opened |
| A crafted binary plist exploits a binary parser | There is no binary parser: a binary plist is recognised by its first bytes and refused, with the command to convert it |
| A huge file, deeply nested XML or very many elements exhaust memory or time | Files over 10 MB are refused from the size of the open file before they are read; XML deeper than 64 levels or with more than 200,000 elements is refused. The XML reader keeps its own stack instead of recursing on the input; the plist reader recurses only as deep as the XML reader allows |
| A crafted source file makes a pattern run for a very long time | The patterns are short, anchored on a name and free of nested repetition, and each runs on one line at a time; the masking of comments and strings is a single pass over the text. A test runs a long line and a long unclosed comment and checks the time |
| A symbolic link leads the walk out of the folder or round in a circle | Links are not followed, files or folders; a note counts them |
| A device, a pipe or a folder in place of a file makes the tool hang or read without end | The type and size are taken from the open file, and anything that is not a regular file is refused |
| A tree that is very deep or has very many entries exhausts the walk | The walk goes no deeper than 64 folders and stops after 200,000 entries, and says so in a note |
| A key named `__proto__` or `constructor` changes how objects behave | Dict keys are kept in objects without a prototype, and the category tables are looked up with a `Map`; tests check that no prototype changes |
| A malformed manifest is read differently from Xcode, so a missing declaration is missed | Anything that is not well-formed XML, a key given twice, or a value of an unknown type is refused with its line and becomes a `parse-error` finding that fails the gate by default; nothing is guessed |
| A file name or a value rewrites the terminal through escape sequences, or reorders text with direction characters | Control characters (C0 and C1), line and paragraph separators and Unicode direction controls are replaced by a space before any text reaches a report or an error message, and the length is capped |
| A name breaks the Markdown table in the job summary, or hides text as an HTML tag | Pipes, backslashes, line breaks, `<`, `>` and `&` are escaped in every table cell |
| A CSV report runs a formula when opened in a spreadsheet | Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading `'`; every cell is quoted as RFC 4180 says |
| A secret in a source file ends up in a report or a job summary | The tool prints names, file paths and line numbers, never a line of source and never the value of a string; a test checks that a string literal from a source file does not appear in the report |
| The argument names a URL, so the tool becomes a fetcher | Arguments that look like addresses are refused; the tool has no code that opens a connection |

## Out of scope

What the code of the app does with the data, the binaries of libraries, the privacy policy and the store forms, and the truth of a declared reason. docs/limits.md lists what a check of the files cannot see.
