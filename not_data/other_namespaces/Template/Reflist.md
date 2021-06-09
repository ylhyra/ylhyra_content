title = Template:Reflist
redirects =
>>>>

<div data-translate="no" class="reflist <!--
 -->{{#if: {{{1|}}} {{{colwidth|}}}
    | columns references-column-width
	}}" style="<!--
 -->{{#if: {{{1|}}}
    | {{#iferror: {{#ifexpr: {{{1|1}}} > 1 }}
      | {{column-width|1={{{1}}}}}
      | {{#switch:{{{1|}}}|1=|2={{column-width|1=30em}}|#default={{column-width|1=25em}}}} }}
    | {{#if: {{{colwidth|}}}
      | {{column-width|1={{{colwidth}}}}} }} }} list-style-type: <!--
 -->{{{liststyle|{{#switch: {{{group|}}}
    | upper-alpha
    | upper-roman
    | lower-alpha
    | lower-greek
    | lower-roman = {{{group}}}
    | #default = decimal}}}}};">
{{#tag:references|{{{refs|}}}|group={{{group|}}}|responsive={{#if:{{{1|}}}{{{colwidth|}}}|0|1}}}}</div>