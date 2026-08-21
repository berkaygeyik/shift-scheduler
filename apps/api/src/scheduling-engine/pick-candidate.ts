export function pickCandidate(
  candidateIds: string[],
  random: () => number = Math.random,
): string | null {
  if (candidateIds.length === 0) {
    return null;
  }
  const index = Math.floor(random() * candidateIds.length);
  return candidateIds[index];
}
