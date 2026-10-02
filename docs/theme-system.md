# React Theme presentation

Agent Blog retains `quiet-minimal`, `night-shift`, and `signal-console`. The selected Theme, configured language and site identity are application preferences. They do not change content discovery or publication authority.

React routes prepare public content, stable URLs and translated labels. The shared Article wrapper resolves the Theme's ReviewArticle presentation slot and passes prepared content, locale and labels. The same wrapper is used by public reviews, authenticated reviewer previews and token-protected read-only previews. Each missing slot falls directly back to the shared default; Themes never inherit from one another. An unknown configured Theme fails explicitly.

Theme variables control surfaces, text, borders, typography and focus colors. Light/dark appearance is a browser preference and does not overwrite the operator's deployed Theme. Chinese and English reader labels follow configured language. Reviewer operations use the focused Chinese workbench.

Theme components render already-sanitized Markdown HTML and never query D1, discover content routes, read credentials or approve publication. SSR rendering tests cover complete prepared content for each supported Theme, override/default behavior and unknown IDs. Browser/runtime acceptance covers readable content, focus, small screens and private-draft isolation.

Use `npm run configure -- --list-themes` and the configuration command to select presentation; deploy application code for a deployed preference change. Dynamic site-settings persistence is outside the current release.
