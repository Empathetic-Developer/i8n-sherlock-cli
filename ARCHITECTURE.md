## i18n-sherlock-cli: System Architecture Overview
### 1. High-Level System Architecture
This diagram illustrates the main logical components of the i18n-sherlock-cli tool and their interactions with the developer's project environment.

Component Breakdown:
1. CLI Layer (The Interface):

Responsibility: This is the entry point of the application (bin/cli.js). Its sole purpose is to parse command-line arguments, flags, and options.

Key Technology: yargs. It defines the command structure (e.g., add <namespace> <key> <text>), handles help text generation, and routes the parsed arguments to the appropriate handler in the Core Logic Layer.

2. Core Logic Layer (The Brains):

Responsibility: This layer contains all the business logic and orchestrates the execution of commands. It is completely decoupled from the command-line interface itself, making it highly testable and maintainable.

Sub-Components:

Configuration Loader (config.js): Uses cosmiconfig to automatically find and load the .i8n-sherlockrc.json file from the user's project, providing all necessary settings to the command handlers.

Command Handlers: Each command is seperately stored in thier respective files. These functions orchestrate the workflow, calling on utilities and helpers to perform their tasks.
commands.js contains one function each for implementatoin in progress commands (sync, clean, etc.).

File System Utilities (files.js): A dedicated module responsible for all interactions with the file system. It contains the optimized loadLocaleData function, which uses a streaming API (glob.stream) and an in-memory cache to ensure high performance. It also contains the safe updateJsonFile helper.

Business Logic Helpers: These are the recursive, "deep" functions (findPathToString, findMissingKeysDeep, etc.) that implement the core algorithms for comparing and analyzing the nested JSON structures.

Interactive Prompts: Uses inquirer to create interactive sessions for features like the "Did you mean...?" typo suggestion.

3. Data Layer (The Environment):

Responsibility: This represents the user's project environment that the tool operates on. The tool reads from and writes to this layer but does not own it.

Components:

.i8n-sherlockrc.json: The configuration file that directs the tool's behavior.

Locale JSON Files: The user's translation files, which are the primary input and output of the system.

### 2. Command Execution Flow (Sequence Diagram for add)
This diagram shows the step-by-step interaction between the components when a developer executes the most complex command, i18n-sherlock add.

Flow Breakdown:
Execution: The developer runs the command in their terminal.

Parsing: The CLI Layer (yargs) parses the arguments (namespace, key, text).

Invocation: The CLI calls the corresponding addCommand handler in the Core Logic Layer.

Configuration: The addCommand first asks the Configuration Loader to find and parse the .i8n-sherlockrc.json file.

Data Loading: It then calls the File System Utilities to load the base language files. The utility uses a stream to read files one by one for responsive feedback.

Business Logic: addCommand performs its internal logic:

It runs a deep search to check for duplicate strings or keys.

It validates the key path, interactively prompting the user with typo suggestions if needed.

File Writing: Once the logic is complete, addCommand calls the File System Utilities' updateJsonFile helper for each locale that needs to be modified.

Disk Operation: The utility safely reads, modifies, and writes the JSON files back to the user's project directory.

Feedback: Throughout the process, the addCommand provides incremental logging to the user's console.

### 3. Key Architectural Decisions & NFRs
Modularity & Separation of Concerns: The strict separation between the CLI Layer and the Core Logic Layer is intentional. It allows the core business logic to be unit-tested independently of the command-line interface, making the tool more robust and easier to maintain.

Performance: To ensure the tool feels instantaneous even on large projects, a streaming approach was chosen for file I/O. Instead of waiting to find all files before processing, the tool processes each file the moment it's discovered. An in-memory cache further prevents redundant file reads within a single command execution.

Safety & Reliability: The tool is designed to be a safe assistant.

Data Loss Prevention: File writing operations are designed to fail gracefully if a file cannot be parsed, preventing accidental data erasure.

Proactive Error Prevention: The add command's "Did you mean...?" feature actively prevents developers from creating malformed data structures due to typos.

Non-destructive Previews: Commands that modify files (sync, clean) offer a --dry-run flag, adhering to the principle of least surprise.

Usability (Developer Experience): Significant focus was placed on providing clear, real-time feedback. Incremental logging with progress indicators ensures the user always knows the tool is working and not frozen.

This architecture creates a tool that is not only powerful and feature-rich but also performant, safe, and intuitive to use.