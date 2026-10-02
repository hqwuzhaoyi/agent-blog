# beUI upstream source and adaptations

MIT source from starc007/ui-components at commit `9f19813a3ea19ce167da9920fba5658b392e4e7f`, retrieved via GitHub API on 2026-10-02. Full original MIT license is adjacent in LICENSE.

| Local source | Upstream source | Retained behavior | Project changes |
| --- | --- | --- | --- |
| button.tsx | components/motion/button/base.tsx | Button and ButtonLink APIs, variants/sizes, pill shapes, hover-capability hook, SPRING_PRESS, optional pointer ripple | Local helper imports, visible keyboard focus, default button height 44px; Motion SPRING_PRESS at 0.97 press / 1.015 fine-pointer hover; keyboard/reduced-motion immediate, opt-in ripple capped at 280ms |
| tabs.tsx | components/motion/tabs.tsx | Compound context API, pill/underline/segment variants, scroll measurement/reveal, projected indicator and clipped duplicate labels, shared frame geometry pass, TabsContent | Root named CompoundTabs; controlled Tabs convenience wrapper used by archive; localized arrows/list label; roving focus/arrow/Home/End keys; 44px pill target |
| bottom-sheet.tsx | components/motion/bottom-sheet.tsx | Portal, snap points, velocity/distance gesture decisions, dragControls with dragListener=false, body-fixed iOS scroll lock, PresenceGate exit gating, scrim, native content scrolling | Focus trap/restore, explicit localized close button, 44px close target and larger handle hit area, dvh/safe-area, 240ms drawer transition; tinted scrim without backdrop blur |
| lib/ease.ts, lib/use-hover-capable.ts, lib/presence-gate.tsx, lib/touch.ts, lib/utils.ts | Corresponding upstream lib sources (hover hook originally lib/hooks/use-hover-capable.ts) | Original motion tokens, hover detection, exit interaction gating, touch helpers and cn(clsx/twMerge) | Relocated files only |

The earlier minimal button/tab/sheet implementations were replaced by these complete upstream component sources. The site's editorial page composition and single audio controller are project code; they are not an upstream beUI page template. No Pro components or proprietary assets are included.
