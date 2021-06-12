---
title: Template:Tweet
---

<div class="tweet">
<div class="tweet-header"><!--
--><Image src="{{{user_picture}}}" size="50px" caption="link=https://twitter.com/{{{handle}}}/status/{{{id}}}"/><!--
--><div class="tweet-author">
<div class="tweet-username">[https://twitter.com/{{{handle}}}/status/{{{id}}} {{{user_name}}}]</div>
<div class="tweet-handle">[https://twitter.com/{{{handle}}}/status/{{{id}}} @{{{handle}}}]</div>
</div>
</div>
<div class="tweet-text">{{translate-div|audio={{{audio|}}}|{{audio|{{{audio|}}}}}{{{text}}}}}</div><!--
--><div><!--
-->{{#if: {{{photo1|{{{photo|}}}}}}|<Image src="{{{photo1" position="{{{photo}}}}}}" size="300px"/>|}}<!--
-->{{#if: {{{photo2|}}}|<Image src="{{{photo2}}}" size="300px" caption="link=https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
-->{{#if: {{{photo3|}}}|<Image src="{{{photo3}}}" size="300px" caption="link=https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
-->{{#if: {{{photo4|}}}|<Image src="{{{photo4}}}" size="300px" caption="link=https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
--></div><!--
--></div>