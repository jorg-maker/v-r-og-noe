# Vær akkurat nå

En enkel, responsiv værnettside med stedsøk og posisjonstjenester. Stedssøk bruker
Open-Meteo Geocoding API, mens selve værvarselet hentes fra MET Norway / Yr
Locationforecast API. Alt kjører med Python sitt standardbibliotek; ingen
Python-pakker må installeres.

## Start på Windows med HTTPS

1. Installer Python 3 hvis det ikke allerede er installert.
2. Åpne PowerShell i mappen med `app.py`, og opprett et lokalt HTTPS-sertifikat:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup-https.ps1
   ```

   Skriptet lager et sertifikat for `localhost` og legger det i sertifikatlageret
   for din Windows-bruker, slik at nettleseren kan stole på HTTPS lokalt. Denne
   kommandoen omgår en eventuell skriptbegrensning kun for denne kjøringen; den
   endrer ikke PowerShells kjørepolicy. Sertifikatet er kun for lokal utvikling.
3. Start nettsiden:

   ```powershell
   python app.py
   ```

4. Åpne [https://localhost:8000](https://localhost:8000) i nettleseren.

Trykk `Ctrl+C` i terminalen for å stoppe serveren. Du kan endre porten med
miljøvariabelen `PORT`. Sertifikat- og nøkkelfil kan ved behov angis med
`HTTPS_CERT_FILE` og `HTTPS_KEY_FILE`. MET Norway ber om en identifiserende
User-Agent; sett
gjerne `WEATHER_USER_AGENT` til et appnavn med kontaktinformasjon før du deler
eller publiserer tjenesten.

Værdata krever internettilgang. Posisjonsknappen krever at nettleseren gir
tilgang til posisjonen din. Sertifikatet fra `setup-https.ps1` er ikke for en
offentlig nettside. For publisering må du bruke et domene med et gyldig
HTTPS-sertifikat, vanligvis gjennom vertsleverandøren eller en reverse proxy.
For raskere gjentatte søk mellomlagrer serveren stedsresultater i opptil ett
døgn og værprognoser i opptil 10 minutter. Mellomlageret slettes når serveren
stoppes.
For å fjerne sertifikatet fra Windows-brukerens klarerte rotsertifikater kan du
kjøre `Remove-Item Cert:\CurrentUser\Root\<fingeravtrykk>` i PowerShell; bruk
fingeravtrykket som skriptet skrev ut.
