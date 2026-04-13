/**
 * Calculates the Levenshtein distance between two strings
 * representing the minimum number of single-character edits required to change one word into the other.
 */
function getLevenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

/**
 * Returns a ratio between 0.0 and 1.0 representing the similarity
 * 1.0 means exact match (case-insensitive if both strings are lowercased internally)
 */
export function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = String(str1).trim().toLowerCase();
  const s2 = String(str2).trim().toLowerCase();

  if (s1 === s2) return 1.0;

  const stepsToSame = getLevenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);

  // Return a score between 0.0 and 1.0
  return (maxLen - stepsToSame) / maxLen;
}
