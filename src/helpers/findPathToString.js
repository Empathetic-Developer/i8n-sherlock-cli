export default function findPathToString(obj, textToFind) {
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