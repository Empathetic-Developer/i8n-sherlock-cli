import chalk from "chalk";
import fs from 'fs/promises';
import path from 'path';
import readline from "readline";
import { loadLocaleData } from "../files.js";
import { countTotalKeysDeep } from "./statsCommand.js";
import { create } from "xmlbuilder2";
import { updateJsonFile } from "./addCommand.js";

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

  function getNodeText(node) {
    if (!node) return undefined;
    if (typeof node === 'string') return node;
    if (typeof node === 'object' && node['#']) return node['#'];
    return undefined;
}


export async function importCommand(locale, xliffPath, dryRun, config) {
    console.log(chalk.blue(`\n📥 Importing translations for locale '${locale}' from ${xliffPath}...`));
    
    let xliffContent;
    try {
        xliffContent = await fs.readFile(xliffPath, 'utf8');
    } catch (e) {
        console.error(chalk.red.bold(`\n❌ Error: Cannot read file at ${xliffPath}`));
        return;
    }

    const parsedXml = create(xliffContent).end({ format: 'object' });
    const transUnits = parsedXml.xliff?.file?.body?.['trans-unit'];

    if (!transUnits || !Array.isArray(transUnits)) {
        console.error(chalk.red.bold('\n❌ Error: Invalid or empty XLIFF file. Could not find <trans-unit> elements.'));
        return;
    }

    process.stdout.write(chalk.blue('  - Verifying namespaces against base locale... '));
    const { data: baseData } = await loadLocaleData(config.baseLocale, config.path);
    console.log(chalk.green('Done.'));

    const changes = {};
    let changesCount = 0;
    const skippedNamespaces = new Set();

    for (const unit of transUnits) {
        const id = unit['@id'];
        const sourceText = getNodeText(unit.source);
        const targetText = getNodeText(unit.target);
        
        if (!targetText || targetText === sourceText) {
            continue;
        }

        const idParts = id.split('.');
        if (idParts.length < 2) continue; // Invalid ID format

        const namespace = idParts[0];
        const keyPath = idParts.slice(1).join('.');
        
        if (!baseData.hasOwnProperty(namespace)) {
            skippedNamespaces.add(namespace);
            continue;
        }
        
        if (!changes[namespace]) {
            changes[namespace] = {};
        }
        changes[namespace][keyPath] = targetText;
        changesCount++;
    }

    if (changesCount === 0) {
        console.log(chalk.yellow('\n✨ No new, valid translations found in the XLIFF file.'));
        return;
    }

    console.log(chalk.yellow(`\nFound ${changesCount} new translation(s) to apply:`));
    for (const namespace in changes) {
        console.log(`  - For namespace ${chalk.cyan(namespace)}:`);
        for (const keyPath in changes[namespace]) {
            console.log(`    - ${chalk.yellow(keyPath)} -> "${changes[namespace][keyPath]}"`);
        }
    }

    if (skippedNamespaces.size > 0) {
        console.log(chalk.yellow(`\n⚠️  Skipped ${skippedNamespaces.size} namespace(s) not found in this project: ${[...skippedNamespaces].join(', ')}`));
    }

    if (dryRun) {
        console.log(chalk.magenta.bold('\n[DRY RUN] No files were changed.'));
        return;
    }

    const proceed = await askForConfirmation('\nDo you want to apply these changes? (y/N) ');
    if (!proceed) {
        console.log(chalk.red('❌ Import cancelled by user.'));
        return;
    }
    
    console.log(chalk.blue(`\n✍️ Applying changes...`));
    for (const namespace in changes) {
        const outputPath = config.path.replace('{locale}', locale).replace('{namespace}', namespace);
        for (const keyPath in changes[namespace]) {
            process.stdout.write(`\n\n  - Updating ${chalk.cyan(keyPath)} in ${chalk.cyan(path.basename(outputPath))}... `);
            const value = changes[namespace][keyPath];
            await updateJsonFile(outputPath, keyPath, value);
        }
    }

    console.log(chalk.green.bold('\n✅ Success! Translations have been imported.'));

}
