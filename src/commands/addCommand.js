import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { loadLocaleData } from "../files.js";
import readline from "readline";
import { distance } from "fastest-levenshtein";
import inquirer from "inquirer";

function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

function hasNestedKey(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (
      current === undefined ||
      !Object.prototype.hasOwnProperty.call(current, key)
    ) {
      return false;
    }
    current = current[key];
  }
  return true;
}

function getNestedValue(obj, path) {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (
      current === undefined ||
      typeof current !== "object" ||
      current === null
    ) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function findPathToString(obj, textToFind) {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    if (
      typeof value === "string" &&
      value.toLowerCase() === textToFind.toLowerCase()
    ) {
      return key;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nestedPath = findPathToString(value, textToFind);
      if (nestedPath) {
        return `${key}.${nestedPath}`;
      }
    }
  }
  return null;
}

export async function updateJsonFile(filePath, key, value) {
  let content = {};
  try {
    await fs.access(filePath);
    const fileContent = await fs.readFile(filePath, "utf8");
    content = JSON.parse(fileContent);
  } catch (e) {
    if (e.code === "ENOENT") {
      // File doesn't exist, which is fine, content remains {}
    } else if (e.name === "SyntaxError") {
      console.error(
        chalk.red(`\n❌ Critical Error: Could not parse ${filePath}.`)
      );
      console.error(
        chalk.yellow("   Aborting update for this file to prevent data loss.")
      );
      return "error"; // Return an error signal
    }
  }

  setNestedValue(content, key, value);

  await fs.writeFile(filePath, JSON.stringify(content, null, 2) + "\n", "utf8");
  return "success";
}

// --- ADD COMMAND  ---
export async function addCommand(namespace, newKeyPath, textToAdd, config) {
  console.log(
    chalk.blue(
      `\n▶️ Starting 'add' command for namespace '${chalk.cyan(namespace)}'...`
    )
  );
  const allLocales = [config.baseLocale, ...config.locales];

  // --- Step 1: Load Base Data ---
  process.stdout.write(chalk.blue("  - Loading base language files... "));
  const { data: baseData } = await loadLocaleData(
    config.baseLocale,
    config.path
  );
  console.log(chalk.green("Done."));

  const namespaceData = baseData[namespace];
  if (!namespaceData) {
    console.error(
      chalk.red.bold(`\n❌ Error: Namespace '${namespace}' does not exist.`)
    );
    return;
  }

  // --- Step 2: Pre-flight Checks & Unified Duplicate Search ---
  process.stdout.write(
    chalk.blue("  - Checking for existing strings and keys... ")
  );
  if (hasNestedKey(namespaceData, newKeyPath)) {
    console.log(
      chalk.red.bold(
        `\n❌ Error: Key path '${newKeyPath}' already exists in namespace '${namespace}'.`
      )
    );
    return;
  }
  const foundInTarget = findPathToString(namespaceData, textToAdd);
  if (foundInTarget) {
    console.log(
      chalk.yellow.bold(
        `\n⚠️ This string already exists in the target namespace '${namespace}' with key path: ${foundInTarget}`
      )
    );
    return;
  }

  let foundInOther = null;
  for (const ns in baseData) {
    if (ns === namespace) continue;
    const foundPath = findPathToString(baseData[ns], textToAdd);
    if (foundPath) {
      foundInOther = { namespace: ns, keyPath: foundPath };
      break;
    }
  }
  console.log(chalk.green("Done."));

  // --- Step 3: Path Validation ("Did you mean...?") ---
  // This interactive step provides its own feedback.
  const pathSegments = newKeyPath.split(".");
  const finalKey = pathSegments.pop();
  let currentObject = namespaceData;
  let resolvedPath = [];
  for (const segment of pathSegments) {
    if (
      currentObject &&
      typeof currentObject === "object" &&
      currentObject.hasOwnProperty(segment)
    ) {
      // Path segment exists, so we can traverse into it
      currentObject = currentObject[segment];
      resolvedPath.push(segment);
    } else {
      // Path segment does NOT exist, check for typos
      const keys =
        currentObject && typeof currentObject === "object"
          ? Object.keys(currentObject)
          : [];
      const suggestions = keys.filter(
        (key) => distance(key.toLowerCase(), segment.toLowerCase()) <= 2
      ); // Levenshtein distance of 2 or less

      if (suggestions.length > 0) {
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: `Path segment '${chalk.red(segment)}' not found. Did you mean '${chalk.green(suggestions[0])}'?`,
            choices: [
              { name: `Yes, use '${suggestions[0]}'`, value: suggestions[0] },
              {
                name: `No, create a new object named '${segment}'`,
                value: segment,
              },
            ],
          },
        ]);

        const chosenSegment = action;
        // If we corrected the path, traverse into the corrected object
        if (currentObject && currentObject.hasOwnProperty(chosenSegment)) {
          currentObject = currentObject[chosenSegment];
        } else {
          currentObject = {}; // Otherwise, the new path is empty
        }
        resolvedPath.push(chosenSegment);
      } else {
        // No suggestions found, so we assume the user wants to create this new path
        currentObject = {};
        resolvedPath.push(segment);
      }
    }
  }
  const finalPath = [...resolvedPath, finalKey].join(".");

  if (finalPath !== newKeyPath) {
    console.log(
      chalk.cyan(`  - Path corrected to: ${chalk.yellow(finalPath)}`)
    );
  }

  // --- Step 4: Write Files ---
  console.log(chalk.blue(`\n✍️ Applying changes to all locales...`));
  let otherLocalesDataMap = null; // To store other locale data if needed

  if (foundInOther) {
    console.log(
      chalk.green(
        `  - Found string in namespace '${foundInOther.namespace}'. Reusing existing translations.`
      )
    );
    process.stdout.write(chalk.blue("    - Loading all other locale data... "));
    const otherLocalesResults = await Promise.all(
      config.locales.map((l) => loadLocaleData(l, config.path))
    );
    otherLocalesDataMap = config.locales.reduce((acc, locale, index) => {
      acc[locale] = otherLocalesResults[index].data;
      return acc;
    }, {});
    console.log(chalk.green("Done."));
  } else {
    console.log(
      chalk.green("  - String is new. Adding with placeholder text.")
    );
  }

  for (const locale of allLocales) {
    let valueToAdd = textToAdd; // Default to placeholder
    if (foundInOther && locale !== config.baseLocale) {
      const sourceNamespaceData = otherLocalesDataMap[locale];
      if (sourceNamespaceData) {
        valueToAdd =
          getNestedValue(
            sourceNamespaceData[foundInOther.namespace],
            foundInOther.keyPath
          ) || textToAdd;
      }
    }
    const outputPath = config.path
      .replace("{locale}", locale)
      .replace("{namespace}", namespace);
    await updateJsonFile(outputPath, finalPath, valueToAdd);
  }

  // --- Step 5: Final Success Message ---
  console.log(
    chalk.green.bold(
      `\n✅ Success! Added key '${finalPath}' to namespace '${namespace}' in all locales.`
    )
  );
  if (!foundInOther) {
    console.log(
      chalk.yellow(
        `   Placeholders were used. Run 'export-missing' to get a list for your translator.`
      )
    );
  }
}
