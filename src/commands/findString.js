import chalk from "chalk";
import { loadLocaleData } from "../files.js";
import findPathToString from "../helpers/findPathToString.js";
import getNestedValue from "../helpers/getNestedValues.js";

export default async function findCommand(searchText, config) {
    console.log(chalk.blue(`\n🔍 Searching for text: "${searchText}"`));
    
    // --- Data Loading ---
    process.stdout.write(chalk.blue('  - Loading base language files... ->  '));
    const { data: baseData, count: baseFileCount } = await loadLocaleData(config.baseLocale, config.path);
    console.log(chalk.green(`Done -> Scanned (${baseFileCount} files).`));

    process.stdout.write(chalk.blue('  - Loading other locales... ->  '));
    const otherLocalesResults = await Promise.all(
        config.locales.map(locale => loadLocaleData(locale, config.path))
    );
    const otherLocalesData = otherLocalesResults.map(result => result.data);
    const totalOtherFiles = otherLocalesResults.reduce((sum, result) => sum + result.count, 0);
    console.log(chalk.green(`Done -> Scanned (${totalOtherFiles} files).`));

    // --- Phase 1: Search the Base Locale ---
    let found = false;
    for (const [namespace, content] of Object.entries(baseData)) {
        const foundPath = findPathToString(content, searchText);
        if (foundPath) {
            found = true;
            const value = getNestedValue(content, foundPath);

            console.log(chalk.green.bold(`\n✅ Match Found!`));
            console.log(`   - ${chalk.bold('Namespace')}: ${chalk.cyan(namespace)}`);
            console.log(`   - ${chalk.bold('Key Path')}:  ${chalk.yellow(foundPath)}`);
            console.log(`   - ${chalk.bold('Text')}:      "${value}"`);
            console.log(chalk.bold('   - Translations/ Placeholders found:'));
            
            config.locales.forEach((locale, index) => {
                const localeData = otherLocalesData[index];
                const translatedValue = getNestedValue(localeData[namespace], foundPath);
                if (translatedValue) {
                    console.log(`     - ${chalk.green('✔')} ${chalk.bold(locale)}: "${translatedValue}"`);
                } else {
                    console.log(`     - ${chalk.red('✖')} ${chalk.bold(locale)}: ${chalk.red('Missing')}`);
                }
            });
            break; 
        }
    }

    // --- Phase 2: If nothing found, search for Orphans in Other Locales ---
    if (!found) {
        const orphansFound = []; // Collect all orphans here
        
        for (let i = 0; i < config.locales.length; i++) {
            const locale = config.locales[i];
            const localeData = otherLocalesData[i];
            for (const [namespace, content] of Object.entries(localeData)) {
                const foundPath = findPathToString(content, searchText);
                if (foundPath) {
                    const value = getNestedValue(content, foundPath);
                    // Add the find to our collection instead of stopping
                    orphansFound.push({ locale, namespace, keyPath: foundPath, value });
                }
            }
        }

        // Now, report on what we found
        if (orphansFound.length > 0) {
            console.log(chalk.yellow.bold(`\n ⚠️ Orphan String Found in ${orphansFound.length} location(s)! (Not in base locale '${config.baseLocale}')`));
            
            orphansFound.forEach((orphan, index) => {
                console.log(chalk.bold(`\n--- Location ${index + 1} ---`));
                console.log(`   - ${chalk.bold('Found In Locale')}: ${chalk.cyan(orphan.locale)}`);
                console.log(`   - ${chalk.bold('Namespace')}:     ${chalk.cyan(orphan.namespace)}`);
                console.log(`   - ${chalk.bold('Key Path')}:      ${chalk.yellow(orphan.keyPath)}`);
                console.log(`   - ${chalk.bold('Text')}:          "${orphan.value}"`);
            });

        } else {
            console.log(chalk.yellow(`\n🤷 No exact match found for "${searchText}" in any locale.`));
        }
    }
}