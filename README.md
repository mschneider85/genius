# Genius – Die Sternenakademie 🪐

Ein Mathe-Weltraumabenteuer für Grundschulkinder (Klasse 1–4) – besonders für Kinder, denen der Schulstoff zu leicht ist.
Läuft komplett im Browser, offline-fähig und als App installierbar (PWA). Keine Konten, keine Werbung, kein Tracking.

## Spielidee

Der Chaos-Nebel hat die Galaxie **Numeria** durcheinandergewirbelt. Als Kadett der Sternenakademie steuert das Kind sein eigenes Raumschiff frei durchs All – gedrückt halten zum Fliegen, Planet antippen für den Autopiloten oder Pfeiltasten/WASD. Planeten, die Werft-Station, die Festung des Bösewichts und später ein Sternentor liegen im Weltall; wer nah genug ist, landet (Zoom-Animation) und steht dann auf der Planetenoberfläche. Funksprüche kommen beim Anfliegen, Knobel-Kometen fängt man im Flug, Professor Pi zeigt mit einem Pfeil das nächste Ziel, eine Minikarte hilft bei der Orientierung.

**Musik:** wird live im Browser erzeugt (WebAudio, keine Audiodateien): ruhiges Ambient im All, beschwingt auf Planeten, treibend im Bosskampf, mit sanften Übergängen. Im Weltall per 🎵 und im Elternbereich abschaltbar.

**Planetenlandschaften:** Hinter den Rätseln liegt die Landschaft des Planeten (eigene Silhouetten, Wahrzeichen, Himmel und Partikel je Planet und Galaxie, Festung im Finale). Zu Missionsbeginn liegen Wahrzeichen umgestürzt im Chaos-Nebel; jedes gelöste Rätsel richtet eines wieder auf und lichtet den Nebel – wie weit der Planet schon gerettet ist, sieht man schon beim Betreten. Über dem Rätsel stehen Bewohner und Widersacher mit einer „Chaos-Energie“-Leiste: Bei Fehlern lacht der Bösewicht, bei Erfolgen trifft ihn ein Energiestrahl, am Ende flieht er.

Jeder Planet ist ein eigenes Rätselspiel mit einem Thema, das weit über den Lehrplan hinausgehen kann:

| Planet | Thema | Freischaltung |
|---|---|---|
| 🔺 Pyramidia | Zahlenpyramiden (vorwärts und rückwärts rechnen) | sofort |
| ☄️ Code-Komet | Zahlenfolgen: Fibonacci, Quadrat-, Kubik-, Primzahlen … | sofort |
| 🪨 Asteroiden-Gürtel | Teilbarkeit und Primfaktorzerlegung | sofort |
| ⚖️ Waagen-Mond | Gleichungen, auch mit zwei Unbekannten (Vor-Algebra) | 3 ⭐ |
| 🤖 Binärion | Binärzahlen – die Sprache der Computer | 6 ⭐ |
| 🔮 Magica | Magische Quadrate | 9 ⭐ |
| 🍕 Bruchstation | Brüche: Anteile, Gleichwertigkeit, Vergleich, Addition | 12 ⭐ |
| 🏗️ Geometra | Fläche und Umfang (freies Bauen auf dem Raster) | 15 ⭐ |
| 👾 Chaos-Kern | Boss-Kampf: Blitz-Kopfrechnen gegen die Uhr | 20 ⭐ |

## Geschichte

**Professor Pi** 🦉 begleitet das Kind. Er erzählt die Geschichte und meldet sich mit Tipps, sobald in einem Rätsel zwei Fehler passiert sind.

1. **Prolog:** Graf Wirrwarr 🦹 hat Numeria durcheinandergewirbelt. Beim ersten Besuch eines Planeten meldet sich dessen Bewohner per **Funkspruch**.
2. **Kapitel:** Jeder Planet wird über Rettungspunkte gerettet (fehlerfreies Rätsel = 2, sonst 1). Bei 10 Punkten ist er *repariert*, bei 25 *strahlend*. Den Zustand zeigt die Karte an. Jede Stufe endet mit einer kurzen Szene.
3. **Geheimbotschaften:** Nach jeder Reparatur schickt der Bösewicht eine verschlüsselte Botschaft. Jeder Buchstabe versteckt sich hinter einer Rechenaufgabe zum Thema des Planeten (A=1 … Z=26). Jede geknackte Botschaft liefert ein Koordinaten-Stück.
4. **Finale:** Mit allen 8 Stücken öffnet sich die Festung. Dort warten 4 Planetenrätsel und danach ein Endkampf gegen den Bösewicht. Es folgen Schlussszene und Abspann.
5. **Galaxie 2 – Infinitas:** Neue Planetennamen, neue Bewohner, eine neue Gegenspielerin (Königin Nulla 🌑), Wirrwarr als Verbündeter. Alle Planeten beginnen dort mindestens auf Stufe 15. Am Ende steht der Titel „Genius“.

Im **📜 Logbuch** lassen sich alle bereits gesehenen Szenen erneut abspielen. Die Story-Texte stehen in `js/story.js`.

## Knobel-Kometen (Bonus)

Einmal am Tag und zufällig nach Missionen (35 %) fliegt ein ☄️ Komet über die Karte. Darin steckt ein freiwilliges Logikrätsel, das es auf keinem Planeten gibt:

- **Zahlen-Detektiv:** Hinweise wie „Meine Quersumme ist 9“, „Ich bin keine Primzahl“. Genau eine Zahl passt zu allen; die Hinweise werden so lange gekürzt, bis keiner mehr überflüssig ist.
- **Rechen-Käfige (KenKen):** 3×3 bis 5×5, Operationen wachsen von + bis ×/÷. Ein Löser prüft, dass es genau eine Lösung gibt.
- **Streichholzrätsel:** Genau ein Streichholz umlegen, damit die Rechnung stimmt. Jede richtige Lösung wird akzeptiert.

Es gibt keinen Zeitdruck und keine Strafe, aber drei gestufte Tipps von Professor Pi; „Auflösen“ zeigt die Lösung. Kometen haben eine eigene, mitwachsende Stufe. Belohnung: 🌟 Goldsterne (zählen nicht für die Geschichte), 30 💎, drei Kometen-Zahlenwesen (bei 2, 5 und 10 🌟) und das Schiff „Kometenreiter“ (bei 7 🌟). Code: `js/comets.js`.

**Motivationsschleife:** Missionen (5 Rätsel) → Sterne & Kristalle → neue Planeten, Ränge (Kadett … Genius), sammelbare **Zahlenwesen** (jedes erzählt eine echte mathematische Entdeckung, z. B. Gauß' Trick, Collatz-Vermutung, Kaprekar-Konstante) und Schiffe/Farben in der **Werft** – wo man beim Bezahlen selbst ausrechnen muss, was übrig bleibt. Die **Expedition** mischt alle freigeschalteten Planeten.

**Adaptiv:** Jeder Planet hat Stufen 1–40. Zwei fehlerfreie Rätsel in Folge heben die Stufe, eine fehlerfreie Mission gibt einen Extra-Sprung, viele Fehler senken sie. Mit „⚡ Zu leicht!“ springt das Kind jederzeit 3 Stufen nach oben. Alle Rätsel werden zufällig erzeugt.

## Spielsysteme

- **Duell mit Lebensbalken:** In jeder Mission stehen sich das Kind (mit Avatar) und der Widersacher gegenüber. Jede falsche Antwort kostet eigene Lebensenergie, jedes gelöste Rätsel schwächt den Gegner. Ist die Energie leer, ist die Mission verloren – mit „Nochmal versuchen“ geht es sofort mit voller Energie weiter.
- **Combo:** Fehlerfreie Rätsel in Folge zählen eine Combo hoch (Bonus-Kristalle, im Bosskampf Extra-Schaden).
- **Tagesaufträge & Abzeichen:** täglich 3 neue Ziele (+40 💎, alle drei: +100 💎 und ein Ei-Splitter) und 22 langfristige Abzeichen (`js/progress.js`).
- **Erkundung:** Das All ist 7200 × 5400 groß; die Planeten liegen in der Mitte, außen gibt es viel Raum mit Asteroidenfeldern. Täglich liegen dort 80 neue 💠 Sternensplitter und 5 versteckte Schatztruhen mit „Rechen-Schloss“ (3 Kopfrechenaufgaben) – die Truhen nur im Außenring, damit sich Erkunden lohnt.
- **Schiffs-Module (Werft):** Schutzschild (mehr Energie/Herzen), Zeitkristall (Boss lädt langsamer), Laser-Verstärker, Turbo-Triebwerk, Schatz-Scanner, Splitter-Magnet – Kristalle haben dadurch spielerischen Nutzen.

## Geräte

Das Weltall wird mit **WebGL** gezeichnet (`js/gl.js`, eigener kleiner Sprite-Renderer, keine Bibliothek). Planeten (Rausch-Oberflächen mit Licht, Atmosphäre, Ringen), Raumschiffe, Kometen, Nebel und die Bauwerke der Landschaften werden prozedural gemalt (`js/art.js`) – einmalig, in Leerlaufzeiten, und in der **Cache Storage** abgelegt, sodass spätere Starts sie nur noch laden. Sinkt die Bildrate unter ~40 fps, reduziert das Spiel automatisch die Auflösung und merkt sich das Gerät als „langsam“: Der **Sparmodus** schaltet dann Weichzeichner, Partikel und Dauer-Animationen ab (`js/perf.js`, im Elternbereich auch manuell wählbar). Geht der WebGL-Kontext verloren (z. B. wenn iPadOS die App im Hintergrund pausiert), wird alles neu hochgeladen. WebAssembly wird nicht benötigt: Die Rechenlast ist minimal (unter 1 ms pro Bild), Leistung kostet nur das Zeichnen.

**Planetenlandschaften:** Jede Landschaft besteht aus vier gemalten Tiefenebenen (Ferne → Vordergrund) mit Hanglicht, Gesteinskörnung, Dunst und Typ-Details (Schneekappen, Dünenrippel, Gesteinsschichten, Krater, Lavaspalten, Wälder, Skylines mit Fensterlichtern, Glaskuppeln). Darüber stehen ein gemalter Himmelskörper, Sonnenstrahlen oder Polarlichter, und die fernen Ebenen ziehen langsam für Tiefenwirkung. Gemalt wird pro Planet in ~15–35 ms beim Betreten. Über bewegten Hintergründen verzichtet das Spiel bewusst auf Weichzeichner-Glas (`backdrop-filter`), weil das die Bildrate im Test mehr als halbiert hat.

**Bedienung:** Jeder Bildschirm außerhalb des Alls hat oben links einen 🚀-Knopf zurück; das Planeten-Briefing zeigt den Start-Knopf immer ohne Scrollen; Professor Pis Infotafel klappt im All nach einigen Sekunden zur Eule ein, damit sie keine Planeten verdeckt.

| Gerät | Unterstützung |
|---|---|
| iPad ab iPadOS 15 (iPad 5, Air 2, mini 4 und neuer) | ✅ |
| iPad mit iOS 12 (iPad Air 1, mini 2/3) | ❌ – Browser zu alt (moderne JavaScript-Syntax) |
| Aktuelle Chrome/Edge/Firefox/Safari | ✅ |

Auf iPads startet die Musik nach dem ersten Antippen (Vorgabe von Safari).

## Lokal starten

ES-Module und Service Worker brauchen einen Webserver (nicht `file://`):

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Auf GitHub Pages veröffentlichen

1. Repository anlegen und diesen Ordner pushen.
2. *Settings → Pages → Build and deployment → Source: „Deploy from a branch“*, Branch `main`, Ordner `/ (root)`.
3. Nach ca. einer Minute läuft das Spiel unter `https://<benutzer>.github.io/<repo>/`.

Alle Pfade sind relativ, das Spiel funktioniert daher in jedem Unterordner. `.nojekyll` verhindert die Jekyll-Verarbeitung.

**Updates:** Nach Änderungen `VERSION` in `sw.js` erhöhen und neue Dateien in `ASSETS` eintragen. Installierte Apps holen sich die neue Version beim nächsten Start.

## Aufbau

```
index.html, manifest.webmanifest, sw.js
css/style.css
js/app.js        Screens, Missionen, Belohnungen, Finale, Logbuch, Werft, Elternbereich, Szenen/Musikwechsel
js/world.js      Frei fliegbare Weltraum-Welt: Steuerung, Landen, Kometen, Zielpfeil, Minikarte, adaptive Auflösung
js/gl.js         WebGL-Sprite-Renderer (Batching, Texturen, Kontextverlust)
js/scenery.js    Planetenlandschaften (SVG/CSS) und Begegnungs-Leiste mit Bewohner und Widersacher
js/art.js        Prozedurale Grafik (Planeten, Schiffe, Bauwerke, Nebel) + persistenter Textur-Cache
js/progress.js   Statistik, Tagesaufträge, Abzeichen, Schiffs-Module
js/perf.js       Sparmodus für ältere Geräte
js/music.js      Generative Hintergrundmusik (All, Planet, Boss)
js/story.js      Figuren, Texte beider Galaxien, Rettungsfortschritt, Szenen-Player, Professor Pi
js/decoder.js    Geheimbotschaften (Buchstaben als Rechenaufgaben)
js/comets.js     Knobel-Kometen: Zahlen-Detektiv, Rechen-Käfige, Streichholzrätsel
js/state.js      Spielstand (localStorage)
js/ui.js         Ziffernblock, Eingabefelder, Dialoge
js/games/*.js    ein Modul pro Planet: create(stage, level, api)
icons/           App-Icons
```

Ein neuer Planet ist ein Modul mit `{ id, name, topic, emoji, hue, unlock, rounds, intro, hint, create(stage, level, api) }`, eingetragen in `js/games/index.js` (und in `sw.js`). Soll er zur Geschichte gehören, braucht er zusätzlich Einträge in `js/story.js` (`STORY_PLANETS`, Bewohner, Texte, Botschaft) und eine Aufgabenart in `letterTask` (`js/decoder.js`).
