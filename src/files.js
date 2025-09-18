import fs from 'fs/promises';
import path from 'path';
import glob from 'fast-glob';
import chalk from 'chalk';

const fileCache = new Map();

export async function loadLocaleData(locale, pathPattern) {
    const globPath = pathPattern.replace('{locale}', locale).replace('{namespace}', '**'); // Use ** to match any file name
    const stream = glob.stream(globPath, { onlyFiles: true });
    const allData = {};
    let fileCount = 0;

    // Use a "for await...of" loop to process each file as it's found by the stream
    for await (const file of stream) {
        const relativePath = path.relative(path.dirname(globPath).split('/{locale}/')[0].replace('{locale}', locale), file);
        const namespace = relativePath.replace('.json', '').replace(/\\/g, '/'); // Create nested namespace key if needed

        // Caching logic here
        if (fileCache.has(file)) {
            allData[namespace] = fileCache.get(file);
        } else {
            try {
                const content = await fs.readFile(file, 'utf8');
                const jsonData = JSON.parse(content);
                fileCache.set(file, jsonData);
                allData[namespace] = jsonData;
            } catch (e) {
                // Log errors but continue
                console.error(chalk.red(`\nError reading or parsing ${file}:`), e);
                allData[namespace] = {};
            }
        }
        // process.stdout.write(chalk.green('.')); // Print a dot for each file processed for progress
        fileCount++;
    }

    return { data: allData, count: fileCount };
}