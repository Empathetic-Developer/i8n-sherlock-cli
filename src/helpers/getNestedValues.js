export default function getNestedValue(obj, path) {
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