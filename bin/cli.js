#!/usr/bin/env node

import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { loadConfig } from "../src/config.js";

import { initCommand } from "../src/commands/initCommand.js";
import findCommand from "../src/commands/findString.js";
import { auditCommand } from "../src/commands/auditComand.js";
import { statsCommand } from "../src/commands/statsCommand.js";
import { exportMissingCommand } from "../src/commands/exportMissing.js";
import { addCommand } from "../src/commands/addCommand.js";
import { syncCommand } from "../src/commands/syncCommand.js";
import { importCommand } from "../src/commands/importCommand.js";

yargs(hideBin(process.argv))
  .option("config", {
    type: "string",
    describe: "Path to a custom config file",
    hidden: true,
  })
  // INIT Command
  .command(
    "init",
    "Create a default i8n-sherlock.config.json file",
    () => {},
    initCommand
  )
  // FIND Command
  .command(
    "find <text>",
    "Find a string in the base locale and check its translation status",
    (yargs) => {
      return yargs.positional("text", {
        describe: "The text to search for (case-insensitive)",
        type: "string",
      });
    },
    async (argv) => {
      const config = await loadConfig();
      if (config) {
        await findCommand(argv.text, config);
      }
    }
  )
  // AUDIT Command
  .command(
    "audit <locale>",
    "Find all missing keys in a target locale",
    (yargs) => {
      return yargs.positional("locale", {
        describe: "The locale to audit against the base",
        type: "string",
      });
    },
    async (argv) => {
      const config = await loadConfig();
      if (config && config.locales.includes(argv.locale)) {
        await auditCommand(argv.locale, config);
      } else if (config) {
        console.error(
          `Locale '${argv.locale}' not found in your config file's "locales" array.`
        );
      }
    }
  )
  // EXPORT-MISSING Command
  .command(
    "export-missing <locale...>",
    "Exports a JSON file and/or an XLIFF file of untranslated keys",
    (yargs) => {
      return yargs
        .positional("locale", {
          /* ... */
        })
        .option("force", {
          /* ... */
        })
        .option("xliff", {
          // <-- Add this new option
          type: "boolean",
          description:
            "Generate an XLIFF file for each locale instead of JSON.",
          default: false,
        });
    },
    async (argv) => {
      const config = await loadConfig(argv.config);
      if (config) {
        // Pass the new flag to the command handler
        await exportMissingCommand(argv.locale, argv.force, argv.xliff, config);
      }
    }
  )
  //   //SYNC command
    .command(
      "sync <locale...>",
      "Add missing keys from the base locale to target locales",
      (yargs) => {
        return yargs
          .positional("locale", {
            describe: 'One or more locales to sync (or "all")',
            type: "string",
          })
          .option("dry-run", {
            type: "boolean",
            description: "Show what would change without writing to files.",
            default: false,
          })
          .option("yes", {
            alias: "y",
            type: "boolean",
            description: "Skip confirmation prompts.",
            default: false,
          });
      },
      async (argv) => {
        const config = await loadConfig(argv.config);
        if (config) {
          await syncCommand(argv.locale, argv.dryRun, argv.yes, config);
        }
      }
    )
  //   //Clean command
    // .command(
    //   "clean <locale...>",
    //   "Remove orphaned keys from target locales that no longer exist in the base locale",
    //   (yargs) => {
    //     return yargs
    //       .positional("locale", {
    //         describe: 'One or more locales to clean (or "all")',
    //         type: "string",
    //       })
    //       .option("dry-run", {
    //         type: "boolean",
    //         description: "Show what would be deleted without writing to files.",
    //         default: false,
    //       })
    //       .option("yes", {
    //         alias: "y",
    //         type: "boolean",
    //         description: "Skip confirmation prompts.",
    //         default: false,
    //       });
    //   },
    //   async (argv) => {
    //     const config = await loadConfig(argv.config);
    //     if (config) {
    //       await cleanCommand(argv.locale, argv.dryRun, argv.yes, config);
    //     }
    //   }
    // )
  //Stats command
  .command(
    "stats",
    "Display the translation coverage stats for all locales",
    (yargs) => {
      return yargs.option("json", {
        type: "boolean",
        description: "Output stats in JSON format.",
        default: false,
      });
    },
    async (argv) => {
      const config = await loadConfig(argv.config);
      if (config) {
        await statsCommand(argv.json, config);
      }
    }
  )

  // ADD Command (Final Version)
  .command(
    "add <namespace> <key> <text>",
    "Adds a new string with an explicit key, reusing translations where possible",
    (yargs) => {
      return yargs
        .positional("namespace", {
          describe: "The namespace (file) to add the string to",
          type: "string",
        })
        .positional("key", {
          describe: "The key to use for the new string (e.g., myNewKey)",
          type: "string",
        })
        .positional("text", {
          describe: "The new string to add, enclosed in quotes",
          type: "string",
        });
    },
    async (argv) => {
      const config = await loadConfig(argv.config);
      if (config) {
        await addCommand(argv.namespace, argv.key, argv.text, config);
      }
    }
  )

  //Import Command
  .command(
    'import <locale> <file>',
    'Import translations from an XLIFF file into your JSON files',
    (yargs) => {
        return yargs
            .positional('locale', {
                describe: 'The locale to apply translations to (e.g., es)',
                type: 'string',
            })
            .positional('file', {
                describe: 'Path to the .xliff file to import',
                type: 'string',
            })
            .option('dry-run', {
                type: 'boolean',
                description: 'Show what would be imported without writing to files.',
                default: false,
            });
    },
    async (argv) => {
        const config = await loadConfig(argv.config);
        if (config) {
            await importCommand(argv.locale, argv.file, argv.dryRun, config);
        }
    }
)

  .demandCommand(1, "You need to provide a command. Use --help for assistance.")
  .help()
  .strict()
  .alias("h", "help")
  .version(false).argv; // Disable default version flag
