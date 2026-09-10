package emailtemplates

import (
  "bytes"
  "encoding/json"
  "html"
  "html/template"
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestSupabaseEmailTemplates(t *testing.T) {
  path := "supabase-email-templates/templates.json"
  if _, err := os.Stat(path); err != nil { path = filepath.Join("..", path) }
  raw, err := os.ReadFile(path)
  if err != nil { t.Fatal(err) }
  var catalog []struct { Key, Subject, Body string }
  if err := json.Unmarshal(raw, &catalog); err != nil { t.Fatal(err) }
  if len(catalog) != 8 { t.Fatal("faltan plantillas") }
  url := "https://example.supabase.co/auth/v1/verify?token=one-time&type=recovery&redirect_to=https%3A%2F%2Fmrmaa.com"
  cases := []struct { name string; data any; lang string }{
    {"es", map[string]any{"language":"es"}, "es"},
    {"en", map[string]any{"language":"en"}, "en"},
    {"fr", map[string]any{"language":"fr"}, "fr"},
    {"old_profile", map[string]any{}, "es"},
    {"null_metadata", nil, "es"},
    {"unsupported", map[string]any{"language":"de"}, "es"},
    {"null_language", map[string]any{"language":nil}, "es"},
    {"invalid_type", map[string]any{"language":map[string]any{"role":"admin"}}, "es"},
    {"html", map[string]any{"language":"<script>unsafe()</script>","full_name":"<script>unsafe()</script>"}, "es"},
  }
  expectedConfirm := map[string]string{"es":"Confirme su correo", "en":"Confirm your email", "fr":"Confirmez votre adresse e-mail"}
  expectedInvite := map[string]string{"es":"Invitación de acceso", "en":"Account invitation", "fr":"Invitation à rejoindre MRMAA"}
  expectedReset := map[string]string{"es":"Restablecer contraseña", "en":"Reset your password", "fr":"Réinitialisez votre mot de passe"}
  for _, item := range catalog {
    for _, tc := range cases {
      for _, redirect := range []string{"https://mrmaa.com/?reset=1", "https://mrmaa.com/?invite=1"} {
        t.Run(item.Key+"/"+tc.name+"/"+redirect, func(t *testing.T) {
          data := map[string]any{"Data":tc.data, "RedirectTo":redirect, "ConfirmationURL":url, "Token":"654321"}
          render := func(source string) string {
            temp, err := template.New("mail").Parse(source)
            if err != nil { t.Fatal(err) }
            var output bytes.Buffer
            if err := temp.Execute(&output, data); err != nil { t.Fatal(err) }
            return output.String()
          }
          // Supabase uses html/template for both the subject and HTML body.
          subject, body := render(item.Subject), render(item.Body)
          if !strings.HasPrefix(subject,"MRMAA | ") || strings.ContainsAny(subject,"\r\n") { t.Fatalf("asunto inválido: %q", subject) }
          if !strings.Contains(body, `lang="`+tc.lang+`"`) { t.Fatal("idioma incorrecto") }
          if strings.Contains(body,"{{") || strings.Contains(body,"unsafe()") { t.Fatal("plantilla o datos inseguros en el mensaje") }
          if !strings.Contains(body, "mailto:support@mrmaa.com") { t.Fatal("falta soporte") }
          isLink := item.Key != "reauthentication" && item.Key != "password_changed" && item.Key != "email_changed"
          if isLink && !strings.Contains(html.UnescapeString(body), `href="`+url+`"`) { t.Fatal("el enlace de Supabase cambió") }
          if item.Key == "reauthentication" && !strings.Contains(body,"654321") { t.Fatal("falta OTP") }
          if item.Key == "confirmation" && subject != "MRMAA | "+expectedConfirm[tc.lang] { t.Fatal("asunto de confirmación incorrecto") }
          if item.Key == "recovery" {
            expected := expectedReset[tc.lang]
            if strings.Contains(redirect,"invite=1") { expected = expectedInvite[tc.lang] }
            if subject != "MRMAA | "+expected { t.Fatalf("asunto de recuperación incorrecto: %q",subject) }
          }
        })
      }
    }
  }
}
