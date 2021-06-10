---
title: Template:Write
tags:
- Card templates
---

<div class="card" data-type="vocabulary" data-children="object">
<div data-name="type" data-children="string">write</div>
<div data-name="from" data-children="string">{{{1|en}}}</div>
<div data-name="to" data-children="string">{{{2|is}}}</div>
<div data-name="icelandic" data-translate="true">{{{is|{{{icelandic|}}}}}}</span></div>
<div data-name="regex">{{{regex|}}}</div>
<div data-name="english">{{{en|{{{english|}}}}}}</div>
<div data-name="instructions">{{{instructions|}}}</div>
<div data-name="audio" data-children="string" class="hidden">{{filepath:{{{audio|}}}}}</div>
<div data-name="listen" data-children="boolean">{{{listen|}}}</div>
<div data-name="image" style="max-width:150px">{{#if: {{{image|}}} | [[{{trim|{{{image}}}}}{{!}}300px]] |}}</div>
</div>
{{/docs}}

