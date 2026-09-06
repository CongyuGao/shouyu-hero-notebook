# 原创美术素材

2026-09-06，内置 image_gen 模式，生成两张素材并原样复制到项目。没有使用CLI，也没有重绘任何游戏数值。类别图标是原创装饰，雕文的具体图标则使用腾讯文档原始卡片。

- 背景：`/Users/gaocongyu1/Documents/ChatGPT/无尽守御/public/arcane-sanctum.png`，1536×1024。
- 类别图集：`/Users/gaocongyu1/Documents/ChatGPT/无尽守御/public/game-icon-atlas.png`，1254×1254，透明PNG。请求1024×1024，工具实际返回1254×1254；采用等分四象限呈现。

## 图集提示词

Use case: stylized-concept.
Asset type: transparent PNG category-icon sprite atlas for a Chinese fantasy MOBA strategy-guide web UI.
Generate ONE original image at exactly 1024 x 1024 pixels, with a genuine transparent alpha background. This is a strict 2 x 2 sprite atlas with four equal 512 x 512 square cells. NO visible grid, dividers, cell backgrounds or labels. Place one isolated icon exactly in the center of each cell: top-left center (256,256), top-right center (768,256), bottom-left center (256,768), bottom-right center (768,768). Each icon, including any tiny restrained glow, must fit entirely within a 340 x 340 pixel area around its center; preserve generous fully transparent margins in every cell. All four symbols must have matched visual scale and consistent premium art direction.
Top-left, core talent: a polished rose-magenta faceted magical crystal set within a restrained silver-gold hexagonal metal bezel.
Top-right, minor talent: a luminous violet elongated diamond crystal with a fine silver rim.
Bottom-left, glyph: an ornate antique-gold circular runic sigil or medallion with a blue magical center. Any decoration is abstract ornamental marks, never readable writing.
Bottom-right, inscriptions/runes: three small red, blue and green cut crystals arranged together as ONE cohesive triad emblem joined by an elegant gold connector.
Style: original premium East Asian fantasy MOBA inventory icons; dimensional bevels, rich gemstone refraction, crisp clean silhouettes legible at 40-60px, polished metal craftsmanship, controlled rim light, restrained halo. Render as finished high-quality game inventory art, front-facing, balanced and compact.
Constraints: these are generic original category icons, not official skill icons. Actual transparency is required: do not draw a checkerboard or any colored background. No text, letters, labels, game logos, characters, background panels, watermarks, excessive wispy smoke, cropping, overlap across cells, extra objects, or merged symbols between cells. Return a single transparent PNG atlas.

## 背景提示词

Use case: stylized-concept.
Asset type: original fantasy MOBA environment painting used as the decorative background of a strategy-guide website.
Primary request: create ONE landscape image, requested dimensions 1536 x 1024 pixels. Paint an imposing dark blue and indigo fantasy preparation sanctuary, with low-key ornamental stone-and-metal columns along the extreme left and right edges, subtle magical crystals, and very faint suspended stardust. In the lower distant background show a softly blurred circular preparation platform with subdued blue magic. Detailed premium East Asian fantasy game environment art, immersive rich craftsmanship and atmospheric depth, controlled blue-violet lighting.
Composition: keep the central 70 percent of the image dark, quiet, low contrast and mostly empty negative space so readable interface cards can later be placed over it. Concentrate visible architectural ornament and crystal magic at the outer edges. Avoid a bright center, major focal object in the center, spotlight beam, or busy high contrast textures through the middle.
Constraints: original generic environment, not official game art. This is a scenic environment painting, NOT a website mockup. Absolutely no people, characters, creatures, text, letters, labels, numbers, logos, watermarks, UI frames, cards, panels, buttons or interface elements. One finished background image only.
