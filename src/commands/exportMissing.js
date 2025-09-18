import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { loadLocaleData } from "../files.js";
import { create } from 'xmlbuilder2';

/**
 * NEW: A recursive helper to format the structured data for JSON output.
 */
function formatForJsonOutput(data) {
    const result = {};
    for (const key in data) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        const entry = data[key];
        if (entry.value !== undefined && entry.status) {
            // This is a leaf node with our structured data
            result[key] = `${entry.value} --${entry.status}--`;
        } else {
            // This is a nested object, recurse
            result[key] = formatForJsonOutput(entry);
        }
    }
    return result;
}

/**
 * NEW: JavaScript version of your Python script to generate an XLIFF file.
 * @param {object} jsonData - The JSON object of missing translations.
 * @param {string} targetLocale - The language the file is being translated INTO.
 * @param {object} config - The project configuration.
 * @returns {string} - The XML content of the XLIFF file as a string.
 */
function generateXliff(jsonData, targetLocale, config) {
    const root = create({ version: '1.0', encoding: 'utf-8' })
        .ele('xliff', { version: '1.2', xmlns: 'urn:oasis:names:tc:xliff:document:1.2' });

    const fileNode = root.ele('file', {
        'source-language': config.baseLocale,
        'target-language': targetLocale, // Add target-language for clarity
        datatype: 'plaintext',
        original: `i8n-sherlock-export-for-${targetLocale}`
    });

    const bodyNode = fileNode.ele('body');

    // Recursive helper to create <trans-unit> elements
    function createTransUnits(data, parentKey = '') {
        for (const key in data) {
            // ...
            const entry = data[key];
            const fullKey = parentKey ? `${parentKey}.${key}` : key;

            if (entry.value !== undefined && entry.status) {
                // Leaf node: use entry.value for clean text
                const transUnit = bodyNode.ele('trans-unit', { id: fullKey });
                transUnit.ele('source').txt(entry.value);
                transUnit.ele('target').txt(entry.value); 
            } else {
                // Nested object: recurse
                createTransUnits(entry, fullKey);
            }
        }
    }

    createTransUnits(jsonData);
    return root.end({ prettyPrint: true });
}

/**
 * REVISED: Now returns structured data: { value: '...', status: '...' }
 */
function findMissingKeysDeep(baseObj, targetObj, isAllowedToBeIdentical) {
    const missing = {};
    let hasMissingKeys = false;

    for (const key in baseObj) {
        const baseValue = baseObj[key];
        const targetValue = targetObj ? targetObj[key] : undefined;

        if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
            const nestedMissing = findMissingKeysDeep(baseValue, targetValue, isAllowedToBeIdentical);
            if (nestedMissing) {
                missing[key] = nestedMissing;
                hasMissingKeys = true;
            }
        } else {
            const isIdentical = baseValue === targetValue;
            if (targetValue === undefined) {
                missing[key] = { value: baseValue, status: 'missing-key' };
                hasMissingKeys = true;
            } else if (isIdentical && !isAllowedToBeIdentical) {
                missing[key] = { value: baseValue, status: 'untranslated' };
                hasMissingKeys = true;
            }
        }
    }
    return hasMissingKeys ? missing : null;
}

// --- EXPORT-MISSING COMMAND (Updated with Deep Search logic) ---
export async function exportMissingCommand(locales, force, asXliff, config) {
    let targetLocales = locales;
    if (locales.length === 1 && locales[0] === 'all') {
        targetLocales = config.locales;
    }

    console.log(chalk.blue(`\n🚀 Exporting translations needed for: ${targetLocales.join(', ')}`));
    const { data: baseData } = await loadLocaleData(config.baseLocale, config.path);

    for (const locale of targetLocales) {
        if (locale === config.baseLocale) continue;
        
        process.stdout.write(chalk.cyan(`\n--- Processing locale: ${locale} --- `));

        const isAllowedToBeIdentical = config.allowIdentical?.includes(locale) || false;
        const { data: targetData } = await loadLocaleData(locale, config.path);
        
        const translationsNeededRaw = findMissingKeysDeep(baseData, targetData, isAllowedToBeIdentical);

        if (!translationsNeededRaw) {
            console.log(chalk.yellow('✨ Fully translated. No export file needed.'));
            continue;
        }

        if (asXliff) {
            // XLIFF is only for translatable locales
            if (isAllowedToBeIdentical) {
                console.log(chalk.dim('(Skipping XLIFF for identical-allowed locale).'));
                continue;
            }
            const outputFilename = `${locale}.xliff`;
            // ... (force check logic) ...
            const fileContent = generateXliff(translationsNeededRaw, locale, config);
            await fs.writeFile(path.join(process.cwd(), outputFilename), fileContent, 'utf8');
            console.log(chalk.green(`✅ Success! Created ${outputFilename}.`));

        } else {
            // JSON is for all non-base locales
            const outputFilename = `${locale}-require-translation.json`;
            const formattedJsonData = formatForJsonOutput(translationsNeededRaw);
            const fileContent = JSON.stringify(formattedJsonData, null, 2);
            await fs.writeFile(path.join(process.cwd(), outputFilename), fileContent, 'utf8');
            console.log(chalk.green(`✅ Success! Created ${outputFilename}.`));
        }
    }
}