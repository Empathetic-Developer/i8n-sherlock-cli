# i8n-sherlock-cli 🕵️

**i8n-sherlock-cli** is a powerful command-line interface designed to streamline the management of JSON-based translation files. It helps you find, audit, and add translation keys with confidence, saving development time and preventing common i18n mistakes.

This tool is framework-agnostic and works with any project that uses a directory of JSON files for internationalization, such as those using `next-intl`.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
  - [init](#init-command)
  - [stats](#stats-command)
  - [find](#find-command)
  - [audit](#audit-command)
  - [sync](#sync-command)
  - [clean](#clean-command)
  - [export-missing](#export-missing-command)
  - [add](#add-command)
- [License](#license)

## Features

-   🔎 **Find** existing strings and their translation status across all locales.
-   ➕ **Intelligently Add** new keys with interactive typo detection and automatic reuse of existing translations.
-   🕵️ **Audit** locales to get a deep, comprehensive list of all missing keys.
-   🔄 **Sync** locales by automatically adding missing keys from your base language.
-   🧹 **Clean** up your files by removing orphaned keys from deleted features.
-   📊 **Get Detailed Statistics** on Key Coverage and Translation Coverage.
-   📤 **Export** missing work for translators into developer-friendly JSON or professional XLIFF files.
-   ⚙️ **Highly Configurable** to fit your project's unique file structure.

## Installation

It's recommended to install the tool as a local development dependency in your project.

```bash
npm install i8n-sherlock-cli --save-dev
``` 

You can then run the tool using ```npx i8n-sherlock```

## Configuration

The tool is configured using a single ```.i8n-sherlockrc.json``` file in your project's root. To get started, run the init command.

```npx i8n-sherlock init```

This will generate a configuration file with the following options:

```
{
  "baseLocale": "en",
  "locales": ["es", "fr-ca"],
  "path": "locales/{locale}/**/{namespace}.json",
  "allowIdentical": ["en-ca"]
} 
```
- ```baseLocale```: The language that serves as the source of truth (e.g., "en").

- ```locales```: An array of all other language codes you want to manage.

- ```path```: The glob pattern that describes your file structure.

- ```{locale}``` is a placeholder for the language code.

- ```{namespace}``` is a placeholder for the JSON filename (without the extension).
- Use /**/ to enable recursive searching in subdirectories.

- ```allowIdentical```: An array of locales that are permitted to have strings identical to the baseLocale without being flagged as "untranslated" (e.g., "en-ca").

## Commands
All commands are run via ```npx i8n-sherlock```

## Init Command
Initializes the project by creating a default .i8n-sherlockrc.json configuration file in the current directory.

```bash
npx i8n-sherlock init
```


## Stats Command
Displays detailed statistics about your project's translation health, broken down into two tables: Key Coverage (structural completeness) and Translation Coverage (actual translation work).

```bash
npx i8n-sherlock stats
```

## Find Command 

Performs a deep, exact-match search for a string. It first searches the base locale. If not found, it then searches all other locales to find "orphaned" strings.
The case-sensitive string to search for, enclosed in quotes.

```bash 
npx i8n-sherlock find "Your string to find"
```
 

## Audit Command

Performs a deep audit and reports a list of all key paths that exist in the base locale but are missing from a target locale.

The single locale to audit against the base locale.

```bash
npx i8n-sherlock audit es
```


## Sync  Command
Automatically adds keys that are missing in target locales. It finds all keys present in the base locale and creates them in the specified locales, using the base language string as a placeholder.

- ```"es"```: One or more space-separated locales, or the keyword all.

- ```--dry-run```: Shows what changes would be made without writing to any files.

- ```--yes or -y```: Skips the interactive confirmation prompt.

### Sync a single locale
```bash
npx i8n-sherlock sync es
```

### Sync multiple locales
```bash
npx i8n-sherlock sync es fr-ca
```

### Sync all locales defined in the config
```bash
npx i8n-sherlock sync all
```

## Clean Command (In Progress) 
Cleans up translation files by finding and removing orphaned keys that no longer exist in the base locale. (In Progress)
- ```<locale...>```: One or more space-separated locales, or the keyword all.

- ```--dry-run```: Shows what keys would be deleted without writing to any files.

- ```--yes or -y```: Skips the interactive confirmation prompt.

### Clean a single locale
```bash
npx i8n-sherlock clean es
```

### See what would be cleaned from all locales
```bash
npx i8n-sherlock clean all --dry-run
```


## Export Missing Command
Generates a file containing a to-do list of all keys that are either missing or untranslated. This is the primary tool for preparing work for translators.
- ```--xliff```: Generates professional .xliff files with clean source text instead of the default developer-focused JSON report. This automatically excludes allowIdentical locales.

- ```--force or -f```: Overwrites an existing export file if one exists.

### Export a JSON report for Spanish
```bash
npx i8n-sherlock export-missing es
```

### Export an XLIFF file for all translatable locales
```bash
npx i8n-sherlock export-missing all --xliff
```




## Add Command
The primary command for adding new strings. It's an intelligent, multi-step process:

- Checks for duplicate keys or strings in the target namespace.
 - Searches other namespaces to find and reuse existing translations.

- Interactively prompts you to correct potential typos in nested key paths.

- Adds the key and string to all locales.


### Add a top-level key
```bash 
npx i8n-sherlock add common myNewKey "My new string"
```

### Add a nested key using dot notation
```bash
npx i8n-sherlock add common user.profile.tagline "My new tagline"
```

```common```: The file to add the key to (e.g., common).

```user.profile.tagline```: The key to create. Use dot notation for nested objects.

```"My new tagline"```: The new string for the base locale, enclosed in quotes.

### License
This project is licensed under the MIT License.