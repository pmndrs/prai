export const NewLine = `\n`

export function lines(...lines: Array<string>): string {
  return lines.join(NewLine)
}
