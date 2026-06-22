# Stream Voting Tool

Ein Live-Voting-Tool für deinen Twitch-Stream mit drei Spielmodi:
- 🔥 **Hot for no reason**
- 🚩 **Red / Green Flag**
- ⚖️ **Entweder Oder**

Der Chat stimmt einfach mit `1` oder `2` ab. Es zählt immer die **letzte** Stimme
pro Person, und es läuft ein Timer (Standard 60 Sekunden), den du frei einstellen kannst.

---

## Wie es aufgebaut ist

Es gibt zwei Webseiten:

1. **Steuerung** (`/control/`) – die siehst nur DU. Hier legst du Runden an, startest
   sie, siehst den Chat live mitlaufen und kannst Runden verlängern/abbrechen.
2. **Overlay** (`/overlay/`) – das packst du als Browser-Quelle in OBS. Transparenter
   Hintergrund, zeigt die Frage, Live-Balken und Countdown.

Ein kleiner Server im Hintergrund verbindet beides und liest nebenbei deinen
Twitch-Chat mit (rein lesend – deine Zuschauer müssen sich nirgends einloggen).

---

## Teil 1: Lokal testen (auf deinem eigenen PC)

Das machen wir zuerst, damit du siehst, dass alles funktioniert, bevor wir es
online stellen.

### Schritt 1: Node.js installieren

Falls noch nicht installiert: geh auf https://nodejs.org und lade die
**LTS-Version** runter, installier sie ganz normal (einfach "Weiter" klicken).

Prüfen, ob es geklappt hat: öffne ein Terminal (Windows: "Eingabeaufforderung"
oder "PowerShell", Mac: "Terminal") und tippe:

```
node --version
```

Es sollte eine Versionsnummer wie `v20.x.x` erscheinen.

### Schritt 2: Projekt öffnen und Pakete installieren

Entpacke den Projektordner irgendwo auf deinem PC, öffne dann ein Terminal
**in genau diesem Ordner** (Tipp: im Datei-Explorer in den Ordner navigieren,
dann oben in die Adresszeile `cmd` eintippen und Enter drücken – das öffnet
ein Terminal direkt im richtigen Ordner).

Dann tippe:

```
npm install
```

Das lädt alle benötigten Bausteine herunter (dauert ein bis zwei Minuten).

### Schritt 3: Server starten

```
npm start
```

Du solltest sehen: `Server laeuft auf Port 3000`

### Schritt 4: Ausprobieren

- Steuerung öffnen: http://localhost:3000/control/
- Overlay öffnen (in einem zweiten Browser-Tab): http://localhost:3000/overlay/

Trag in der Steuerung oben deinen Twitch-Kanalnamen ein und klick "Verbinden".
Leg dann eine Test-Runde an und klick "Sofort starten" – im Overlay-Tab sollte
sofort die Frage mit Timer erscheinen. Schreib in deinem eigenen Twitch-Chat
(oder lass jemanden anderen schreiben) `1` oder `2` und schau, wie sich der
Balken bewegt.

Zum Beenden: im Terminal `Strg + C` drücken.

---

## Teil 2: Online stellen (damit es überall erreichbar ist)

Lokal laufen reicht nicht, wenn du willst, dass der Server durchgehend läuft
und das Overlay zuverlässig in OBS erreichbar ist. Dafür empfehle ich
**Render** (kostenlos zum Start, keine Kreditkarte für den Gratis-Plan nötig).

### Schritt 1: Projekt auf GitHub hochladen

GitHub ist quasi ein Online-Speicher für Code-Projekte.

1. Erstelle einen Account auf https://github.com (falls noch nicht vorhanden)
2. Klicke oben rechts auf das `+` → "New repository"
3. Gib einen Namen ein, z.B. `stream-voting` → "Create repository"
4. Auf der nächsten Seite siehst du Anweisungen unter "…or push an existing
   repository from the command line". Öffne dein Terminal **im Projektordner**
   und führe folgende Befehle nacheinander aus (ersetze die URL mit der, die
   GitHub dir zeigt):

```
git init
git add .
git commit -m "Erste Version"
git branch -M main
git remote add origin https://github.com/DEIN-NUTZERNAME/stream-voting.git
git push -u origin main
```

Falls `git` nicht erkannt wird: installiere Git von https://git-scm.com (auch
hier einfach "Weiter" klicken) und versuche es erneut.

### Schritt 2: Render-Account erstellen und verbinden

1. Geh auf https://render.com und erstelle einen Account (geht auch direkt
   mit deinem GitHub-Account, das ist am einfachsten)
2. Klick auf "New +" → "Web Service"
3. Wähle dein GitHub-Repository (`stream-voting`) aus
4. Render erkennt automatisch, dass es ein Node.js-Projekt ist. Folgende
   Einstellungen solltest du sehen/setzen:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Klick "Create Web Service"

Render baut jetzt dein Projekt (dauert 1-3 Minuten). Danach bekommst du eine
Adresse wie `https://stream-voting-xyz.onrender.com`.

**Wichtig beim kostenlosen Plan:** Render "schläft" den Service nach ein paar
Minuten Inaktivität ein und braucht beim nächsten Aufruf ein paar Sekunden zum
Aufwachen. Für den Stream-Einsatz: ruf einfach kurz vorher die Steuerungsseite
auf, bevor du live gehst, dann ist der Server schon wach.

### Schritt 3: Deine Adressen

- Steuerung: `https://DEIN-PROJEKT-NAME.onrender.com/control/`
- Overlay für OBS: `https://DEIN-PROJEKT-NAME.onrender.com/overlay/`

Die Steuerungsseite zeigt dir den fertigen Overlay-Link übrigens auch direkt
an (unten, mit Kopier-Button).

---

## Teil 3: In OBS einbinden

1. In OBS: Quelle hinzufügen → **Browser-Quelle**
2. URL: deine Overlay-Adresse (siehe oben)
3. Breite: `700`, Höhe: `500` (kannst du später anpassen/skalieren)
4. Häkchen bei "Shutdown source when not visible" **entfernen**, damit der
   Live-Stand nicht verloren geht, wenn du die Szene wechselst
5. Fertig – der Hintergrund ist transparent, du kannst die Quelle frei
   platzieren und in der Größe anpassen

---

## Bedienung im Stream

1. Auf der Steuerungsseite oben deinen Twitch-Kanalnamen eintragen → "Verbinden"
   (das musst du pro Server-Neustart einmal machen)
2. Links den gewünschten Modus auswählen (Hot for no reason / Red-Green-Flag /
   Entweder-Oder)
3. Entweder:
   - Eine neue Runde eintippen (Text, optional Bild hochladen) → "Sofort starten"
   - Oder: "In Bibliothek speichern", um sie für später vorzubereiten, und
     später einfach in der Liste auf "Starten" klicken
4. Der Chat stimmt mit `1` oder `2` ab, der Timer läuft automatisch runter
5. Nach Ablauf zeigt das Overlay automatisch das Ergebnis an
6. Du kannst jederzeit "+10 Sek" geben oder die Runde abbrechen

---

## Häufige Stolpersteine

- **"Verbinden" zeigt weiter "Nicht verbunden"**: Prüfe, ob der Kanalname
  exakt wie in deiner Twitch-URL geschrieben ist (klein geschrieben, ohne
  Leerzeichen, ohne "twitch.tv/").
- **Stimmen werden nicht gezählt**: Nur exakt `1` oder `2` als alleinige
  Nachricht zählt (bewusst so gewählt, damit es eindeutig bleibt – `Option 1`
  oder `1!` zählen nicht).
- **Render-Service antwortet erst nach ein paar Sekunden**: siehe Hinweis zum
  kostenlosen Plan oben – einfach kurz vorher aufrufen.
- **Bilder verschwinden nach Render-Neustart**: Beim kostenlosen Plan wird der
  Dateispeicher bei jedem Neustart zurückgesetzt. Für den Anfang okay, falls
  dich das später stört, sag Bescheid – dann bauen wir externen Bildspeicher
  (z.B. Cloudinary) ein.

---

## Was später noch ausgebaut werden könnte

- Eigener Twitch-Login, damit z.B. nur Follower/Subs voten dürfen
- Speicherung der Bilder extern (übersteht dann auch Server-Neustarts)
- Auswertungs-Historie ("welche Runde hatte die meisten Stimmen")
- Sound-Effekte beim Rundenstart/-ende

Sag einfach Bescheid, wenn du eines davon willst.
