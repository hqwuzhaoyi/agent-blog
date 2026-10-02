# Official component reuse checks

2026-10-03, isolated local preview. These screenshots show fixture content, not production publication.

- [Desktop official RangeSlider](player-desktop.png), 1440×1000.
- [Mobile official RangeSlider](player-mobile.png), 390×844; both slider targets measured 44px tall, no horizontal overflow.
- [Mobile official Input](archive-mobile.png), 390×844; keyword/month controls both measured 44px tall.

Input and RangeSlider preserve the complete registry implementations. Only aliases/layout composition were adapted. Slider pointer/click/keyboard/media-time and mobile Sheet checks passed in `test/public-slider-browser.mjs`; no speculative change to the upstream spring was needed. Public route/history/audio regression and admin state/Tabs regression also passed. Browser mobile viewport testing does not replace physical-device touch testing.
