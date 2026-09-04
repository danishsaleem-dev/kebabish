import { Fragment } from "react";

/**
 * Splits a headline into per-word clipping boxes so each word can ride up
 * into view. Rendered on the server, so the full sentence is still present
 * in the HTML for crawlers and screen readers — real whitespace text nodes
 * are kept between the words so the line still wraps normally on mobile.
 *
 * The parent element carries `data-reveal-mask`; Motion animates its
 * grandchildren.
 */
export default function MaskedWords({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);

  return (
    <>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="line-mask">
            <span className="inline-block">{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
