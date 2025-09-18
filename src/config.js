import { cosmiconfig } from 'cosmiconfig';
import chalk from 'chalk';

const explorer = cosmiconfig('i8n-sherlock');

/**
 * Loads the i8n-sherlock configuration.
 * @param {string|undefined} customPath - An optional explicit path to the config file.
 * @returns {Promise<object|null>} The configuration object or null if not found.
 */
export async function loadConfig(customPath) {
    try {
        const result = customPath 
            ? await explorer.load(customPath) 
            : await explorer.search();

        if (!result) {
            console.error(chalk.red('❌ Error: Configuration file not found.'));
            console.log(chalk.yellow('Please run `i8n-sherlock init` to create one.'));
            return null;
        }
        return result.config;
    } catch (error) {
        console.error(chalk.red('Error loading configuration:'), error);
        return null;
    }
}