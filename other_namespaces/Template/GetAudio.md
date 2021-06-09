title = Template:GetAudio
redirects =
---

{{#if:{{{1|}}}
|{{#get_web_data:url=https://ylhyra.is/api/GetOneAudioFile?text={{urlencode:{{{1|}}}|QUERY}}|format=JSON|data=file=file}}
{{#external_value:file}}
|}}<noinclude>
Use: <nowiki>{{GetAudio|texti}}</nowiki>
</noinclude>