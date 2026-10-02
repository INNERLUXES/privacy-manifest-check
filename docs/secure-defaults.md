# Secure defaults

The default run is the safe run. Nothing below needs a flag, and none of it can be switched off.

## How the tool behaves by default

- **No network.** The tool reads the files it is given and sends nothing anywhere. It does not resolve the tracking domains in a manifest, does not download Apple's plist DTD, does not look up a reason code, an SDK or a library, does not follow an address from any file, and does not check for updates. An argument that looks like an address is refused. It can run in a locked-down job with no outbound access at all.
- **No Xcode, no commands.** The tool never runs Xcode, `plutil`, a shell or any other program. Source files are read as text and searched with a few patterns; nothing in them is compiled or run. No name, path or value from the input is ever put on a command line. A project from an unknown source can be checked without running any of its code, which is not true of opening it in Xcode or building it.
- **No dependencies.** Node 22 or newer and nothing else, so a privacy check does not add a supply chain of its own. There is no `node_modules` to install before it runs.
- **Safe XML.** Every manifest is read by a small reader that refuses a DOCTYPE or an ENTITY declaration before reading anything in it, and refuses every entity except `&lt;`, `&gt;`, `&amp;`, `&quot;` and `&apos;`. The one exception is the public DOCTYPE line Xcode writes at the top of every plist, which is compared character for character (with or without the older "Apple Computer" name) and skipped as text: it has no internal subset, and the DTD it names is never opened. A plist DOCTYPE with anything added to it is refused like any other. Nesting deeper than 64 levels and more than 200,000 elements in one file are refused too.
- **No binary parsers.** A binary property list is recognised by its first bytes and refused, with the `plutil` command to convert it. There is no code that decodes a binary format, so a crafted binary file has nothing to attack.
- **Strict parsing.** A manifest that is not well-formed XML (a tag that is not closed, a second root element, an attribute given twice, a stray `<` or `&`), a plist with a key given twice or a value of an unknown type, and a top value that is not a dict are refused with the file and the line. They are reported as `parse-error` findings, which fail the gate by default; a report that skipped a file it did not understand is never written without saying so.
- **Reads only what is named.** The tool opens the folder given on the command line and the files of the five kinds inside it. It does not follow symbolic links, and does not look at the folders around the one it was given.
- **Third-party code is left out.** `Pods`, `Carthage`, `build`, `DerivedData`, `.git` and `node_modules` are not walked unless `--include-deps` is given, which also keeps the run fast and the report about the project's own code.
- **Regular files only, bounded.** Each file is opened once, its type and size are taken from the open file, and anything that is not a regular file or is over 10 MB is refused before it is read. The walk is bounded in depth and in the number of entries.
- **No source in the output.** A report holds file paths, line numbers, API symbol names, and the keys and values of the manifest that a finding is about. It never holds a line of source code or the value of a string literal, so a report can be pasted into a pull request or a job summary without carrying a secret from the code.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message, so a hostile file name cannot rewrite the terminal or reorder what a reader sees. Markdown cells escape pipes, backslashes, line breaks and `<`, `>` and `&`. CSV cells are quoted as RFC 4180 says, and a cell that a spreadsheet would read as a formula gets a leading `'`.
- **No prototype tricks.** Dict keys are stored in objects without a prototype, and the tables are looked up in a `Map`, so a key named `__proto__` or `constructor` is just data.
- **The gate is on.** Without any option, an error makes the run exit with `1`. A pipeline that adds the tool notices a missing manifest or an undeclared category from the first run.
- **Writes nothing to disk.** The report goes to the screen. Redirect it to a file or the job summary only when you need to keep it.

## Running it safely on a project you do not know

1. Run the check before anything else touches the project: before opening it in Xcode, before `pod install` or a package resolve, and before a build. Each of those runs code from the project or its dependencies; the check does not.
2. Run it as a user with read access to the project and nothing else. It needs no Xcode, no signing certificates, no store credentials and no network.
3. Give it the folder of one app or SDK. Keep the default and read the notes, which say what was left out; add `--include-deps` only to look at vendored code on purpose.
