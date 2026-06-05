# Gym Log

Tracker palestra mobile-first per iPhone. Include onboarding profilo, home iniziale, sessioni attive, progressi dedicati, "I tuoi allenamenti" per template modificabili, storico apribile, autocomplete sugli esercizi salvati e confronto progressivo tra sessioni per gli stessi esercizi.

## Avvio locale

```bash
python3 -m http.server 5174
```

Poi apri:

```text
http://127.0.0.1:5174
```

Su iPhone puoi aprirla da Safari e usare "Aggiungi alla schermata Home".

## Pubblicazione su GitHub Pages

1. Crea un repository GitHub vuoto.
2. Carica questi file nel repository.
3. In GitHub vai su `Settings` -> `Pages`.
4. In `Build and deployment`, scegli `GitHub Actions`.
5. Fai push sul branch `main`.

Quando il workflow finisce, apri l'URL di GitHub Pages da Safari su iPhone e usa "Aggiungi alla schermata Home".

L'app ha un service worker (`sw.js`) che mette in cache i file principali per usarla anche offline dopo il primo caricamento e controlla la rete prima della cache quando sei online.

## File

- `index.html`: struttura dell'app
- `styles.css`: interfaccia mobile-first
- `app.js`: salvataggio, storico e calcoli
- `manifest.webmanifest`: metadati PWA
- `sw.js`: cache offline
- `icon.svg`: icona dell'app
