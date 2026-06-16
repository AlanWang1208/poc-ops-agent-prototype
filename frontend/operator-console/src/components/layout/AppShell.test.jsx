import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appShellCss = readFileSync(
  "src/components/layout/AppShell.module.css",
  "utf8",
);
const appShellSource = readFileSync("src/components/layout/AppShell.jsx", "utf8");

describe("AppShell styles", () => {
  it("keeps the sidebar in a solid workbench style without glass effects", () => {
    expect(appShellCss).not.toContain("backdrop-filter");
    expect(appShellCss).not.toContain("nav-item-sheen");
    expect(appShellCss).not.toContain("filter: saturate");
    expect(appShellCss).not.toContain("blur(");
  });

  it("uses larger tactile navigation icons with refined symbol layers", () => {
    const linkRule = appShellCss.match(/[.]navLink\s*[{][^}]+[}]/u)?.[0] ?? "";
    const iconRule = appShellCss.match(/[.]navIcon\s*[{][^}]+[}]/u)?.[0] ?? "";
    const iconBeforeRule = appShellCss.match(/[.]navIcon::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const iconAfterRule =
      [...appShellCss.matchAll(/[.]navIcon::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ?? "";
    const symbolRule = appShellCss.match(/[.]navSymbol\s*[{][^}]+[}]/u)?.[0] ?? "";
    const symbolBeforeRule =
      appShellCss.match(/[.]navSymbol::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const symbolAfterRule =
      [...appShellCss.matchAll(/[.]navSymbol::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ?? "";
    const glyphRule = appShellCss.match(/[.]navGlyph\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(appShellSource).toContain("className={styles.navSymbol}");
    expect(linkRule).toContain("grid-template-columns: 54px minmax(0, 1fr) 12px");
    expect(iconRule).toContain("width: 44px");
    expect(iconRule).toContain("height: 44px");
    expect(iconRule).toContain("box-shadow:");
    expect(iconRule).toContain("inset 0 1px 0");
    expect(appShellCss).toContain(".navIcon::before,\n.navIcon::after");
    expect(appShellCss).toContain("content: \"\"");
    expect(iconBeforeRule).toContain("inset: 7px");
    expect(iconAfterRule).toContain("border-bottom-color");
    expect(symbolRule).toContain("width: 25px");
    expect(symbolRule).toContain("height: 25px");
    expect(symbolRule).toContain("background: var(--nav-mark)");
    expect(symbolBeforeRule).toContain("border:");
    expect(symbolAfterRule).toContain("box-shadow:");
    expect(appShellCss.match(/--nav-mark:/gu)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(glyphRule).toContain("width: 22px");
    expect(glyphRule).toContain("height: 22px");
    expect(glyphRule).toContain("z-index: 2");
  });

  it("keeps the sidebar footer signal preview animated", () => {
    const previewRule =
      appShellCss.match(/[.]sidebarPreview\s*[{][^}]+[}]/u)?.[0] ?? "";
    const previewFieldRule =
      appShellCss.match(/[.]sidebarPreview::before\s*[{][^}]+[}]/u)?.[0] ?? "";
    const previewSweepRule =
      [...appShellCss.matchAll(/[.]sidebarPreview::after\s*[{][^}]+[}]/gu)].at(-1)?.[0] ??
      "";
    const previewOrbitRule =
      appShellCss.match(/[.]sidebarPreviewOrbit\s*[{][^}]+[}]/u)?.[0] ?? "";
    const previewCoreRule =
      appShellCss.match(/[.]sidebarPreviewCore\s*[{][^}]+[}]/u)?.[0] ?? "";
    const previewMenuNodeRule =
      appShellCss.match(/[.]sidebarPreviewMenuNode\s*[{][^}]+[}]/u)?.[0] ?? "";
    const previewActiveNodeRule =
      appShellCss.match(/[.]sidebarPreviewMenuNodeActive\s*[{][^}]+[}]/u)?.[0] ?? "";

    expect(appShellSource).toContain("className={styles.sidebarPreview}");
    expect(appShellSource).toContain("className={styles.sidebarPreviewOrbit}");
    expect(appShellSource).toContain("className={styles.sidebarPreviewCore}");
    expect(appShellSource).toContain("styles.sidebarPreviewMenuNode");
    expect(appShellSource).toContain("styles.sidebarPreviewMenuNodeActive");
    expect(previewRule).toContain("display: grid");
    expect(previewRule).toContain("place-items: center");
    expect(previewRule).toContain("isolation: isolate");
    expect(previewRule).toContain("overflow: hidden");
    expect(previewRule).not.toContain("--preview-signal-start");
    expect(previewOrbitRule).toContain("grid-template-columns: repeat(7, 1fr)");
    expect(previewOrbitRule).toContain("animation: sidebar-orbit-drift");
    expect(previewCoreRule).toContain("animation: sidebar-core-breathe");
    expect(previewMenuNodeRule).toContain("background: color-mix(in srgb, var(--nav-color)");
    expect(previewMenuNodeRule).toContain("animation: sidebar-node-twinkle");
    expect(previewActiveNodeRule).toContain("animation: sidebar-active-node-breathe");
    expect(previewFieldRule).toContain("border-radius: 999px");
    expect(previewFieldRule).toContain("animation: sidebar-field-glow");
    expect(previewSweepRule).toContain("conic-gradient");
    expect(previewSweepRule).toContain("animation: sidebar-radar-sweep");
    expect(appShellCss).toContain("@keyframes sidebar-field-glow");
    expect(appShellCss).toContain("@keyframes sidebar-radar-sweep");
    expect(appShellCss).toContain("@keyframes sidebar-orbit-drift");
    expect(appShellCss).toContain("@keyframes sidebar-core-breathe");
    expect(appShellCss).toContain("@keyframes sidebar-node-twinkle");
    expect(appShellCss).toContain("@keyframes sidebar-active-node-breathe");
    expect(appShellCss).not.toContain("sidebarPreviewMenuRail");
    expect(appShellCss).not.toContain("sidebar-menu-sync");
  });
});
