/** The steps editor's text, one step per line, as the console takes them. */
export function stepsOfLines(text: string): { text: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ text: line }))
}
