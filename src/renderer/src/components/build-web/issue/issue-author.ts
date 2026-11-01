import type { BuildWebTester } from '../../../../../shared/build-web-types'
import { isPerson } from './issue-tester'

// IS-349: whom the card's «Author» and «Extra recipients» offer, after build-web's AuthorField and
// RecipientsField. No renderer aliases: mobile imports it.

type Choice = { value: string; label: string }

function sortedChoices(logins: Iterable<string>, label: (who: string) => string): Choice[] {
  return [...new Set(logins)]
    .map((value) => ({ value, label: label(value) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Anybody the console knows, a person from Jira too, and the current author. */
export function authorChoices(
  author: string,
  people: readonly BuildWebTester[],
  label: (who: string) => string
): Choice[] {
  return sortedChoices([...people.map((p) => p.email), ...(author ? [author] : [])], label)
}

/** People only — a Jira account has no address — and whoever is picked already. */
export function recipientChoices(
  picked: readonly string[],
  people: readonly BuildWebTester[],
  label: (who: string) => string
): Choice[] {
  return sortedChoices([...people.map((p) => p.email).filter(isPerson), ...picked], label)
}

/** The picked list with `who` ticked or unticked, in the order picked. */
export function toggledRecipient(picked: readonly string[], who: string): string[] {
  return picked.includes(who) ? picked.filter((p) => p !== who) : [...picked, who]
}

export function sameRecipients(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((who) => b.includes(who))
}
