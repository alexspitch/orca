// The desktop SavedQueriesMenu's names for the saved filter's fields Orca's list does not narrow by.

function unsupportedLabel(field: string): string {
  switch (field) {
    case 'jira':
      return 'not in Jira'
    case 'rootOnly':
      return 'top-level only'
    default:
      return field
  }
}

export const unsupportedText = (fields: readonly string[]): string =>
  `Orca’s list does not narrow by: ${fields.map(unsupportedLabel).join(', ')}`
