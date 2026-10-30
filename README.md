# Vær akkurat nå

En enkel, responsiv værnettside med stedsøk og posisjonstjenester. Stedssøk bruker
Open-Meteo Geocoding API, mens selve værvarselet hentes fra MET Norway / Yr
Locationforecast API. Frontend henter værdata direkte fra disse API-ene, slik
at den også kan publiseres som en statisk nettside uten Python-server.

## Publiser på GitHub Pages

GitHub Pages-nettsiden kan oppdateres ved å erstatte `index.html` og `app.js`
i repoet og committe endringene til samme branch som Pages allerede publiseres
fra. GitHub Pages bygger da siden på nytt automatisk.

Åpne adressen GitHub Pages viser, vanligvis
`https://<brukernavn>.github.io/<repo-navn>/`. Repoets vanlige GitHub-adresse
(`github.com/...`) viser kildekoden, ikke nettstedet.

Repoets vanlige GitHub-adresse (`github.com/...`) viser kildekoden, ikke
nettstedet. GitHub Pages-nettadressen er den publiserte nettsiden.

## Lokal kjøring med Python og HTTPS

1. Installer Python 3, og åpne PowerShell i mappen med `app.py`.
2. Opprett et lokalt sertifikat:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup-https.ps1
   ```

3. Start serveren med `python app.py`, og åpne
   [https://localhost:8000](https://localhost:8000).

Trykk `Ctrl+C` for å stoppe serveren. Nettleseren henter værdata direkte fra
API-ene både lokalt og på GitHub Pages. Python-serverens API-er har i tillegg
mellomlagring dersom du bruker dem direkte. Sertifikatet fra skriptet er kun
for lokal utvikling, ikke for offentlig publisering.
