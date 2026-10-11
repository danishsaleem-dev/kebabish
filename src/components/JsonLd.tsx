/**
 * One JSON-LD `<script>`, serialised safely.
 *
 * `JSON.stringify` alone is not enough inside a `<script>`: a string that
 * contains `</script>` ends the block early and whatever follows is parsed as
 * HTML. Several of our strings are typed by hand in /admin (dish names and
 * descriptions, category text), so `<` is escaped to its JSON `<` form —
 * identical to a parser, harmless to the page.
 *
 * The line/paragraph separators (U+2028, U+2029) are escaped as well: they are
 * legal in JSON but were line terminators in older JS engines. They are written
 * as escapes below rather than as the characters themselves, which would break
 * the regex literal.
 *
 * Every structured-data component renders through this, so none of them has
 * to remember.
 */
const LINE_SEPARATOR = new RegExp("\\u2028", "g");
const PARAGRAPH_SEPARATOR = new RegExp("\\u2029", "g");

export default function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
