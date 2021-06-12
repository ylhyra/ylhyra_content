---
title: Template:Tweet
---

<div class="tweet">
<div class="tweet-header"><!--
--><Image src="{{{user_picture}}}" width="50" link="https://twitter.com/{{{handle}}}/status/{{{id}}}"/><!--
--><div class="tweet-author">
<div class="tweet-username">[https://twitter.com/{{{handle}}}/status/{{{id}}} {{{user_name}}}]</div>
<div class="tweet-handle">[https://twitter.com/{{{handle}}}/status/{{{id}}} @{{{handle}}}]</div>
</div>
</div>
<div class="tweet-text">{{translate-div|audio={{{audio|}}}|{{audio|{{{audio|}}}}}{{{text}}}}}</div><!--
--><div><!--
-->{{#if: {{{photo1|{{{photo|}}}}}}|<Image src="{{{photo1" position="{{{photo}}}}}}" width="300"/>|}}<!--
-->{{#if: {{{photo2|}}}|<Image src="{{{photo2}}}" width="300" link="https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
-->{{#if: {{{photo3|}}}|<Image src="{{{photo3}}}" width="300" link="https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
-->{{#if: {{{photo4|}}}|<Image src="{{{photo4}}}" width="300" link="https://twitter.com/{{{handle}}}/status/{{{id}}}"/>|}}<!--
--></div><!--
--></div>