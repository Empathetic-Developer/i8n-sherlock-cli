import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { loadLocaleData } from "./files.js";
import readline from "readline";
import { distance } from "fastest-levenshtein";
import inquirer from "inquirer";

function askForConfirmation(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) =>
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.toLowerCase().trim() === "y");
      })
    );
  }



//Clean Command (upcoming)
export async function cleanCommand(locales, dryRun, skipConfirmation, config) {
  let targetLocales = locales;
  if (locales.length === 1 && locales[0] === "all") {
    targetLocales = config.locales;
  }

  console.log(
    chalk.blue(
      `\n🧹 Cleaning orphaned translations for locale(s): ${targetLocales.join(", ")}`
    )
  );

  const baseData = await loadLocaleData(config.baseLocale, config.path);

  for (const locale of targetLocales) {
    if (locale === config.baseLocale) continue;

    console.log(chalk.cyan.bold(`\n--- Processing locale: ${locale} ---`));

    const targetData = await loadLocaleData(locale, config.path);
    const changes = {}; // Stores { namespace: ['key1', 'key2'] }
    let changeCount = 0;

    // Core logic: Iterate the TARGET data and check against the BASE
    for (const [namespace, targetContent] of Object.entries(targetData)) {
      for (const key of Object.keys(targetContent)) {
        // If the namespace doesn't exist in base OR the key doesn't exist in the base namespace
        if (!baseData[namespace] || !baseData[namespace].hasOwnProperty(key)) {
          if (!changes[namespace]) {
            changes[namespace] = [];
          }
          changes[namespace].push(key);
          changeCount++;
        }
      }
    }

    if (changeCount === 0) {
      console.log(chalk.green("✅ No orphaned keys found."));
      continue;
    }

    console.log(
      chalk.yellow(`Found ${changeCount} orphaned key(s) to remove:`)
    );
    for (const [namespace, keys] of Object.entries(changes)) {
      console.log(`  - From file for namespace ${chalk.cyan(namespace)}:`);
      keys.forEach((key) => console.log(`    - ${chalk.red(key)}`));
    }

    if (dryRun) {
      console.log(chalk.magenta.bold("\n[DRY RUN] No files were changed."));
      continue;
    }

    const proceed = skipConfirmation
      ? true
      : await askForConfirmation(
          "\nDo you want to apply these changes? (y/N) "
        );

    if (proceed) {
      for (const [namespace, keysToRemove] of Object.entries(changes)) {
        const filePath = (
          await glob(
            config.path
              .replace("{locale}", locale)
              .replace("{namespace}", namespace)
          )
        )[0];
        if (!filePath) continue; // Should not happen if we found keys, but a good safeguard

        const currentContent = JSON.parse(await fs.readFile(filePath, "utf8"));

        // Create a new object without the orphaned keys
        const newContent = Object.keys(currentContent)
          .filter((key) => !keysToRemove.includes(key))
          .reduce((obj, key) => {
            obj[key] = currentContent[key];
            return obj;
          }, {});

        await fs.writeFile(
          filePath,
          JSON.stringify(newContent, null, 2) + "\n",
          "utf8"
        );
      }
      console.log(chalk.green.bold("✅ Files cleaned successfully."));
    } else {
      console.log(chalk.red("❌ Clean cancelled by user."));
    }
  }
}



