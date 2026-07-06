export const FREE_EMAIL_DOMAINS: Set<string> = new Set([
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
]);

/**
 * Matches recipient email addresses to client_ids by domain, except free-mail
 * domains (D-09) where only an exact address match counts — otherwise one
 * client's gmail.com correspondence could domain-match an unrelated client.
 */
export function matchClientsForRecipients(
  recipientEmails: string[],
  clients: { id: string; email: string | null }[],
): string[] {
  const recipients = recipientEmails.map((r) => r.toLowerCase());
  const matched = new Set<string>();

  for (const client of clients) {
    if (!client.email) continue;
    const clientEmail = client.email.toLowerCase();
    const clientDomain = clientEmail.split('@')[1];

    for (const recipient of recipients) {
      const recipientDomain = recipient.split('@')[1];
      const isMatch = FREE_EMAIL_DOMAINS.has(clientDomain)
        ? recipient === clientEmail
        : recipientDomain === clientDomain;
      if (isMatch) {
        matched.add(client.id);
        break;
      }
    }
  }

  return Array.from(matched);
}
