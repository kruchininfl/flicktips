// Legacy helpers.pluralGender: the male / female / unknown form of a phrase.
export function pluralGender(gender: string | null | undefined, phrases: [string, string, string]): string {
  if (gender === 'male') return phrases[0];
  if (gender === 'female') return phrases[1];
  return phrases[2];
}
