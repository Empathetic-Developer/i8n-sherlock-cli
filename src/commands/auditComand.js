import chalk from "chalk";
import { loadLocaleData } from "../files.js";

/**
 * Recursively finds all key paths from a base object that are missing in a target object.
 * @param {object} baseObj - The source of truth object.
 * @param {object} targetObj - The object to check.
 * @param {string} pathPrefix - The prefix for building the dot-notation path.
 * @returns {string[]} - An array of dot-notation paths for missing keys.
 */
function findMissingKeysDeep(baseObj, targetObj, pathPrefix = '') {
    let missingPaths = [];
    if (!targetObj) { // If the entire target object is missing, all base keys are missing
        for (const key in baseObj) {
            if (Object.prototype.hasOwnProperty.call(baseObj, key)) {
                missingPaths.push(pathPrefix + key);
            }
        }
        return missingPaths;
    }

    for (const key in baseObj) {
        if (!Object.prototype.hasOwnProperty.call(baseObj, key)) continue;

        const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        const baseValue = baseObj[key];

        if (!targetObj.hasOwnProperty(key)) {
            missingPaths.push(currentPath);
        } else if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
            const nestedMissing = findMissingKeysDeep(baseValue, targetObj[key], currentPath);
            missingPaths = missingPaths.concat(nestedMissing);
        }
    }
    return missingPaths;
}


// --- AUDIT COMMAND (Updated with Deep Check) ---
export async function auditCommand(targetLocale, config) {
    console.log(chalk.blue(`\n 🕵️  Auditing locale '${targetLocale}' against base '${config.baseLocale}'...`));
    
    // Use incremental logging for a better experience
    process.stdout.write(chalk.blue('  - Loading files... '));
    const { data: baseData } = await loadLocaleData(config.baseLocale, config.path);
    const { data: targetData } = await loadLocaleData(targetLocale, config.path);
    console.log(chalk.green('Done.'));

    let totalMissing = 0;

    for (const [namespace, baseContent] of Object.entries(baseData)) {
        const targetContent = targetData[namespace];
        
        // Use the new recursive function to find all missing keys
        const missingKeys = findMissingKeysDeep(baseContent, targetContent);

        if (missingKeys.length > 0) {
            totalMissing += missingKeys.length;
            console.log(`\n- In namespace ${chalk.cyan(namespace)}, missing keys for '${targetLocale}':`);
            missingKeys.forEach((keyPath) => console.log(`  - ${chalk.yellow(keyPath)}`));
        }
    }

    if (totalMissing === 0) {
        console.log(chalk.green("\n✨ Perfect! No missing keys found."));
    } else {
        console.log(chalk.red.bold(`\nTotal missing keys found: ${totalMissing}`));
    }
}