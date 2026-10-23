// schema.org data for search engines: a <script> that doesn't change the visible page.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // "<" is escaped so no text of the data can close the script element
  const json = JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
