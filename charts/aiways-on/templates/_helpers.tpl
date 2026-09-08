{{- define "aiways-on.image" -}}
{{- $reg := .root.Values.image.registry -}}
{{- if $reg -}}{{ $reg }}/{{ end }}{{ .repository }}:{{ .root.Values.image.tag }}
{{- end -}}

{{- define "aiways-on.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/part-of: aiways-on
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- end -}}
