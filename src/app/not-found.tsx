// Safety-net 404 for any request that somehow lands outside the
// [locale] segment (the middleware matcher normally prevents this).
export default function GlobalNotFound() {
  return (
    <html lang="nl">
      <body style={{ fontFamily: "sans-serif", padding: "4rem", textAlign: "center" }}>
        <h1>404 — Pagina niet gevonden</h1>
        <p>
          <a href="/">Terug naar de homepage</a>
        </p>
      </body>
    </html>
  );
}
