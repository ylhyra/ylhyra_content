---
title: Template:Image
---

<a href="{{#if: {{{link|}}} | {{fullurl:{{{link|}}}}} | {{filepath:{{{1|}}}}} }}">
<picture>
<source media="(max-width: 400px)" srcset="{{filepath:{{{1|}}}|400|nowiki}} 1x, {{filepath:{{{1|}}}|800|nowiki}} 2x">
<source media="(max-width: 800px)" srcset="{{filepath:{{{1|}}}|800|nowiki}} 1x, {{filepath:{{{1|}}}|1200|nowiki}} 2x">
<source media="(max-width: 1200px)" srcset="{{filepath:{{{1|}}}|1200|nowiki}} 1x, {{filepath:{{{1|}}}|2400|nowiki}} 2x">
<source media="(min-width: 1200px)" srcset="{{filepath:{{{1|}}}|2400|nowiki}} 1x, {{filepath:{{{1|}}}|2400|nowiki}} 2x">
<img src="{{filepath:{{{1|}}}|800|nowiki}}">
</picture>
</a>