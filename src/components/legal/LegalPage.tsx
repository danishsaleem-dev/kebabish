type LegalSection = {
  heading: string;
  body: string[];
  list?: string[];
  footer?: string;
};

/**
 * Shared renderer for /privacy and /terms — both are the same shape
 * (title, last-updated line, intro paragraph, a list of headed sections),
 * sourced entirely from messages/*.json rather than hardcoded here.
 */
export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="bg-cream-200">
      <div className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
          {title}
        </p>
        <h1 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight text-charcoal-600 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-ink/50">{updated}</p>
        <p className="mt-6 text-pretty text-base leading-relaxed text-ink/75">{intro}</p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-charcoal-600">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-pretty text-[0.95rem] leading-relaxed text-ink/75">
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.list && (
                <ul className="mt-3 space-y-2 border-l-2 border-ember-600/25 pl-5">
                  {section.list.map((item, i) => (
                    <li key={i} className="text-[0.95rem] leading-relaxed text-ink/75">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              {section.footer && (
                <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/75">
                  {section.footer}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
