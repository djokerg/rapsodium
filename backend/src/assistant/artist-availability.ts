/**
 * Builds the natural-language note appended to the assistant's reply when one or
 * more requested artists aren't in the catalogue. Pure + testable; the actual
 * catalogue lookup lives in AssistantService (it needs the DB).
 */
export function formatUnavailableArtistsNote(unknown: string[]): string {
  if (unknown.length === 0) return '';
  return `I couldn't find ${joinWithAnd(unknown)} in the library, so here's something with a similar vibe instead.`;
}

function joinWithAnd(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}
