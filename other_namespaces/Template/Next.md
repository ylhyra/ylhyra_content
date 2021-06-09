title = Template:Next
redirects =
---

<div style="clear:both;">
<div style="float:left;">
{{#ifexist: {{BASEPAGENAME}}/{{#expr:{{SUBPAGENAME}}-1}} | {{button|[[{{BASEPAGENAME}}/{{#expr:{{SUBPAGENAME}}-1}}|Previous]]}} | }}
</div>
<div style="float:right;">
{{#ifexist: {{BASEPAGENAME}}/{{#expr:{{SUBPAGENAME}}+1}} | {{button|[[{{BASEPAGENAME}}/{{#expr:{{SUBPAGENAME}}+1}}|Next]]}} | }}
{{#if:{{{next|}}}|{{button|[[{{BASEPAGENAME}}/{{{next|}}}|Next]]}}|}}
</div>
</div><div style="clear:both;"></div><noinclude>



</noinclude>