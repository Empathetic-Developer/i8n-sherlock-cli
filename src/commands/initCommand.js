import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

// --- INIT COMMAND ---
export async function initCommand() {
  const configFilename = ".i8n-sherlockrc.json";
  const defaultConfig = {
    baseLocale: "en",
    locales: ["es", "fr-ca"],
    path: "locales/{locale}/{namespace}.json",
    allowIdentical: ["en-ca"], //add this incase some of your locales have same language as base
  };

  try {
    await fs.access(path.join(process.cwd(), configFilename));
    console.log(chalk.yellow(`File ${configFilename} already exists.`));
    console.log(chalk.yellow(`Please customize it for your project.`));
  } catch {
    await fs.writeFile(
      path.join(process.cwd(), configFilename),
      JSON.stringify(defaultConfig, null, 2),
      "utf8"
    );
    console.log(
      chalk.green(
        `✅ Success! Created ${configFilename}. Please customize it for your project.`
      )
    );
  }
}
