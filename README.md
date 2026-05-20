# Saziņas forma

Neliela kontaktformas lietotne ar lokālu Node.js backendu. Serveris pieņem `POST /submit` iesniegumus, saglabā tos `data/submissions.jsonl` un saglabā pielikumus `data/uploads/`.

## Palaišana

```sh
npm start
```

Pēc palaišanas forma ir pieejama `http://127.0.0.1:3000`.

## Automātiskais e-pasts

Pēc veiksmīgas formas saglabāšanas serveris mēģina nosūtīt apstiprinājuma e-pastu uz iesniedzēja norādīto adresi. E-pasts tiek sūtīts tikai tad, ja forma jau ir izgājusi e-pasta validāciju. Ja SMTP sūtīšana neizdodas, iesniegums paliek saglabāts un kļūda tiek ielogota servera konsolē.

Projekts lasa konfigurāciju no `process.env`. Konfigurē SMTP mainīgos servera vidē:

```sh
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=lietotajs@example.com
SMTP_PASSWORD=parole
SMTP_FROM_EMAIL=no-reply@example.com
SMTP_SECURE=false
PROJECT_NAME=Saziņas forma
```

`SMTP_SECURE=true` izmanto tiešu TLS savienojumu, parasti portam `465`. Ja izmanto portu `587`, atstāj `SMTP_SECURE=false`; serveris mēģinās `STARTTLS`.
