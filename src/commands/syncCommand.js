import chalk from "chalk";
import fs from "fs/promises";
import readline from "readline";
import { loadLocaleData } from "../files.js";
import { countTotalKeysDeep } from "./statsCommand.js";

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


/**
 * Recursively builds an object containing only the keys and values from baseObj that are missing from targetObj.
 */
function findMissingStructureDeep(baseObj, targetObj) {
    const missingStructure = {};
    if (!targetObj) return baseObj; // If target doesn't exist at all, the entire base is missing

    for (const key in baseObj) {
        if (!Object.prototype.hasOwnProperty.call(baseObj, key)) continue;

        if (!targetObj.hasOwnProperty(key)) {
            missingStructure[key] = baseObj[key]; // Key is completely missing
        } else if (typeof baseObj[key] === 'object' && baseObj[key] !== null && !Array.isArray(baseObj[key])) {
            const nestedMissing = findMissingStructureDeep(baseObj[key], targetObj[key]);
            if (Object.keys(nestedMissing).length > 0) {
                missingStructure[key] = nestedMissing; // Some keys are missing inside the object
            }
        }
    }
    return missingStructure;
}

/**
 * Recursively merges properties of a source object into a target object.
 */
function deepMerge(target, source) {
    const output = { ...target };
    if (typeof target === 'object' && typeof source === 'object') {
        for (const key in source) {
            if (typeof source[key] === 'object' && source[key] !== null) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        }
    }
    return output;
}


// --- SYNC COMMAND (Upgraded with Deep Check) ---
export async function syncCommand(locales, dryRun, skipConfirmation, config) {
    let targetLocales = locales;
    if (locales.length === 1 && locales[0] === 'all') {
        targetLocales = config.locales;
    }

    console.log(chalk.blue(`\n🔄 Syncing translations for locale(s): ${targetLocales.join(', ')}`));

    process.stdout.write(chalk.blue('  - Loading base language files... '));
    const { data: baseData } = await loadLocaleData(config.baseLocale, config.path);
    console.log(chalk.green('Done.'));

    for (const locale of targetLocales) {
        if (locale === config.baseLocale) continue;

        console.log(chalk.cyan.bold(`\n--- Processing locale: ${locale} ---`));
        process.stdout.write(chalk.blue('  - Comparing file structures... '));

        const { data: targetData } = await loadLocaleData(locale, config.path);
        const missingStructureByNamespace = {};
        let totalMissingCount = 0;

        for (const namespace in baseData) {
            const missing = findMissingStructureDeep(baseData[namespace], targetData[namespace]);
            if (Object.keys(missing).length > 0) {
                missingStructureByNamespace[namespace] = missing;
                totalMissingCount += countTotalKeysDeep(missing); // Use our leaf-node counter
            }
        }
        console.log(chalk.green('Done.'));

        if (totalMissingCount === 0) {
            console.log(chalk.green('✅ Already up to date.'));
            continue;
        }

        console.log(chalk.yellow(`Found ${totalMissingCount} key(s) to add:`));
        // You can add more detailed logging here if you want to show the specific keys

        if (dryRun) {
            console.log(chalk.magenta.bold('\n[DRY RUN] No files were changed.'));
            continue;
        }

        const proceed = skipConfirmation ? true : await askForConfirmation('\nDo you want to apply these changes? (y/N) ');

        if (proceed) {
            console.log(chalk.blue('  - Applying changes...'));
            for (const namespace in missingStructureByNamespace) {
                const missingContent = missingStructureByNamespace[namespace];
                const outputPath = config.path.replace('{locale}', locale).replace('{namespace}', namespace);
                
                // Read the current content of the file to merge with
                let currentContent = {};
                try {
                    const fileContent = await fs.readFile(outputPath, 'utf8');
                    currentContent = JSON.parse(fileContent);
                } catch (e) { /* File might not exist, that's okay */ }

                const newContent = deepMerge(currentContent, missingContent);
                
                // Sorting is complex with deep objects, so we'll write as is to preserve structure
                await fs.writeFile(outputPath, JSON.stringify(newContent, null, 2) + '\n', 'utf8');
            }
            console.log(chalk.green.bold('✅ Changes applied successfully.'));
        } else {
            console.log(chalk.red('❌ Sync cancelled by user.'));
        }
    }
}