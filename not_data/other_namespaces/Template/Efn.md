---
title: Template:Efn
---

<includeonly>{{#if:{{{name|}}}
 |{{#tag:ref|{{{1|{{{reference|{{{content|{{{text|}}}}}}}}}}}}|name={{{name|}}}|group={{#switch: {{{group|}}}
    | note
    | upper-alpha
    | upper-roman
    | lower-alpha
    | lower-greek
    | lower-roman = {{{group|}}}
    | #default = lower-alpha
   }}
 }}
 |{{#tag:ref|{{{1|{{{reference|{{{content|{{{text|}}}}}}}}}}}}|group={{#switch: {{{group|}}}
    | note
    | upper-alpha
    | upper-roman
    | lower-alpha
    | lower-greek
    | lower-roman = {{{group|}}}
    | #default = lower-alpha
   }}
 }}
}}</includeonly>