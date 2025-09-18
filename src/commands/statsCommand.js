import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { loadLocaleData } from "../files.js";
import readline from "readline";
import { distance } from "fastest-levenshtein";
import inquirer from "inquirer";

/** Recursively counts keys that are actually translated (not missing or identical). */
function countActuallyTranslatedKeysDeep(
  baseObj,
  targetObj,
  isAllowedToBeIdentical
) {
  if (typeof targetObj !== "object" || targetObj === null) {
    return 0;
  }
  let count = 0;
  for (const key in baseObj) {
    if (
      Object.prototype.hasOwnProperty.call(baseObj, key) &&
      Object.prototype.hasOwnProperty.call(targetObj, key)
    ) {
      const baseValue = baseObj[key];
      const targetValue = targetObj[key];
      const isIdentical = baseValue === targetValue;

      if (
        typeof baseValue === "object" &&
        baseValue !== null &&
        !Array.isArray(baseValue)
      ) {
        count += countActuallyTranslatedKeysDeep(
          baseValue,
          targetValue,
          isAllowedToBeIdentical
        );
      } else if (!isIdentical || isAllowedToBeIdentical) {
        // Count it if the value is different, OR if it's allowed to be identical
        count++;
      }
    }
  }
  return count;
}

/**
 * Recursively counts all keys in a single object.
 * @param {object} obj The object to count.
 * @returns {number} The total count of keys.
 */
export function countTotalKeysDeep(obj) {
    let count = 0;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // If it's an object, don't count it, just traverse into it.
                count += countTotalKeysDeep(value);
            } else {
                // If it's NOT an object, it's a leaf node. Count it.
                count++;
            }
        }
    }
    return count;
}

/**
 * Recursively counts translated keys by comparing a target object to a base object.
 * @param {object} baseObj The source of truth object (e.g., from 'en').
 * @param {object} targetObj The object to check (e.g., from 'es').
 * @returns {number} The count of translated keys.
 */
function countTranslatedKeysDeep(baseObj, targetObj) {
    if (typeof targetObj !== 'object' || targetObj === null) {
        return 0;
    }

    let count = 0;
    for (const key in baseObj) {
        if (Object.prototype.hasOwnProperty.call(baseObj, key) && Object.prototype.hasOwnProperty.call(targetObj, key)) {
            const baseValue = baseObj[key];
            const targetValue = targetObj[key];
            
            if (typeof baseValue === 'object' && baseValue !== null && !Array.isArray(baseValue)) {
                // It's an object, so we only traverse into it.
                count += countTranslatedKeysDeep(baseValue, targetValue);
            } else {
                // It's a leaf node that exists in both, so we count it.
                count++;
            }
        }
    }
    return count;
}

// --- STATS COMMAND ---
export async function statsCommand(asJson, config) {
  console.log(chalk.blue("\n📊 Calculating translation statistics..."));

  process.stdout.write(chalk.blue("  - Loading all locale data... "));
  const { data: baseData, count: baseFileCount } = await loadLocaleData(
    config.baseLocale,
    config.path
  );
  const otherLocalesResults = await Promise.all(
    config.locales.map((locale) => loadLocaleData(locale, config.path))
  );
  console.log(chalk.green("Done."));

  const totalKeys = countTotalKeysDeep(baseData);
  const stats = [];

  // --- ⬇️  METRICS CALCULATION ⬇️ ---
  const numLocales = config.locales.length;
  const otherFilesCount = otherLocalesResults.reduce(
    (sum, result) => sum + result.count,
    0
  );
  const totalFilesScanned = baseFileCount + otherFilesCount;
  const totalComparisons = totalKeys * numLocales;
  // --- ⬆️ END OF METRICS ⬆️ ---


  for (let i = 0; i < config.locales.length; i++) {
    const locale = config.locales[i];
    const targetData = otherLocalesResults[i].data;
    const isAllowedToBeIdentical =
      config.allowIdentical?.includes(locale) || false;

    const presentKeys = countTranslatedKeysDeep(baseData, targetData);
    const keyCoverage = totalKeys === 0 ? 100 : (presentKeys / totalKeys) * 100;

    const actuallyTranslatedKeys = countActuallyTranslatedKeysDeep(
      baseData,
      targetData,
      isAllowedToBeIdentical
    );
    const translationCoverage =
      totalKeys === 0 ? 100 : (actuallyTranslatedKeys / totalKeys) * 100;

    stats.push({
      locale,
      keyCoverage: parseFloat(keyCoverage.toFixed(1)),
      translationCoverage: parseFloat(translationCoverage.toFixed(1)),
      presentCount: presentKeys,
      translatedCount: actuallyTranslatedKeys,
      totalCount: totalKeys,
      isIdenticalAllowed: isAllowedToBeIdentical,
    });
  }

  if (asJson) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  // --- ⬇️  DISPLAY LOGIC STARTS HERE ⬇️ ---
  console.log(
    chalk.gray(
      `\nScanned ${chalk.bold(totalFilesScanned)} files across ${chalk.bold(numLocales + 1)} locales, performing ~${chalk.bold(totalComparisons.toLocaleString())} key comparisons.`
    )
  );
  console.log(
    `\nBase locale '${config.baseLocale}' contains ${chalk.bold(totalKeys)} total keys.`
  );

  // --- Table 1: Key Coverage ---
  console.log(chalk.bold(`\n\n📊 Key Coverage (Structural Sync Status) \n`));
  console.log("Locale".padEnd(12) + "Coverage".padEnd(12) + "Present / Total");
  console.log("-".repeat(40));

  stats.forEach((s) => {
    const coverageText = `${s.keyCoverage}%`.padEnd(12);
    const countText = `${String(s.presentCount).padStart(5)} / ${s.totalCount}`;
    console.log(`${s.locale.padEnd(12)}${coverageText}${countText}`);
  });

  // --- Table 2: Translation Coverage ---
  console.log(
    chalk.bold(`\n\n🌐 Translation Coverage (Actual Translation Status) \n`)
  );
  console.log(
    "Locale".padEnd(12) + "Coverage".padEnd(12) + "Translated / Total"
  );
  console.log("-".repeat(45));

  let cumulativeTranslated = 0;
  let cumulativeTotal = 0;

  stats.forEach((s) => {
    let coverageText;
    let displayCount = s.translatedCount;

    if (s.isIdenticalAllowed) {
      coverageText = chalk.dim("(identical)").padEnd(12);
      displayCount = s.presentCount; // For display, show present keys
      cumulativeTranslated += s.presentCount;
      cumulativeTotal += s.totalCount;
    } else {
      const transColor =
        s.translationCoverage >= 95
          ? chalk.green
          : s.translationCoverage >= 80
            ? chalk.yellow
            : chalk.red;
      coverageText = transColor(`${s.translationCoverage}%`).padEnd(22); // Padding for color
      cumulativeTranslated += s.translatedCount;
      cumulativeTotal += s.totalCount;
    }
    const countText = `${String(displayCount).padStart(5)} / ${s.totalCount}`;
    console.log(`${s.locale.padEnd(12)}${coverageText}${countText}`);
  });

  // --- Cumulative Summary ---
  const overallCoverage =
    cumulativeTotal === 0
      ? 100
      : (cumulativeTranslated / cumulativeTotal) * 100;

  console.log(chalk.bold(`\n\nOverall Translation Status:`));
  console.log(`  - Total Keys Required:   ${cumulativeTotal}`);
  console.log(`  - Keys Covered:          ${cumulativeTranslated}`);
  console.log(`  - Overall Coverage:      ${overallCoverage.toFixed(1)}%`);
}
