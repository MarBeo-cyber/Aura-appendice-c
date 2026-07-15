# Componente aggiuntivo Outlook — «Lo strumento» (scenario banca)

Superficie: **sola lettura del messaggio** (MessageRead), riquadro ancorabile.
Scelta derivata dal testo dell'appendice: la nota è rivolta a chi legge; il
mittente non ha sbagliato e non va avvertito. Nessuna superficie di
composizione, per principio e non per limite tecnico.

## Pubblicazione (una volta sola)

I componenti Outlook richiedono file serviti in HTTPS. Percorso minimo con
GitHub Pages sull'account `MarBeo-cyber`:

1. Creare il repository **`aura-appendice-c`** e caricarvi l'intera cartella
   del progetto (servono `outlook/` **ed** `engine/`, perché il riquadro carica
   `../engine/tra_engine.js`).
2. Settings → Pages → Deploy from a branch → `main`, cartella `/ (root)`.
3. Verificare che risponda:
   `https://marbeo-cyber.github.io/aura-appendice-c/outlook/taskpane.html`
   (aperto nel browser mostra la **modalità anteprima** con il caso canonico).

Se il nome del repository fosse diverso, sostituire in `manifest.xml` tutte le
occorrenze di `aura-appendice-c` con il nome scelto.

## Sideload

- **Outlook sul web / nuovo Outlook**: Ottieni componenti aggiuntivi →
  I miei componenti aggiuntivi → Aggiungi da file → `manifest.xml`.
- In alternativa (aka.ms/olksideload) si apre la stessa finestra.

Il pulsante «Lo strumento» compare nella barra del messaggio in lettura; il
riquadro è ancorabile (resta aperto passando da un messaggio all'altro).

## Provare il caso canonico

Trascinare `caso_illustrativo.eml` in una cartella di Outlook (o inviarsi il
testo dell'email del libro) e aprirlo. La rubrica dimostrativa dichiara i ruoli
per gli indirizzi `@banca-demo.example`; per mittenti reali il ruolo va
dichiarato nel riquadro (mai inferito). Il proprio ruolo di lettura è
persistito in locale.

## Limiti di piattaforma, dichiarati

- In lettura Outlook **non consente di modificare il corpo** del messaggio
  ricevuto: la resa fedele di «in coda al messaggio» è il riquadro ancorabile
  più un banner informativo (`notificationMessages`, limite 150 caratteri).
  Il simulatore autonomo, non avendo questo vincolo, appende la nota
  letteralmente in coda al corpo, come nel libro.
- Il registro locale (ruoli dichiarati, note mostrate, giudizi
  pertinente/non pertinente) usa `localStorage` del riquadro: resta sulla
  macchina.

## Nota sul flusso (v0.2)

Il riquadro non mostra una domanda cablata: misura la distanza fra il ruolo del
mittente (dedotto dalla rubrica dimostrativa, non inferito da tratti personali) e
quello di chi legge, e su quella distanza costruisce un **prompt** da copiare in un
LLM. La risposta reincollata viene resa in tipografia del libro. In sola lettura la
nota non può essere apposta nel corpo del messaggio (limite reale di Outlook): compare
nel riquadro, con il banner informativo. Il testo canonico dell'appendice è disponibile
solo come benchmark («confronta con la nota del libro»).

Per provare la superficie completa (nota apposta in coda, tre casi a confronto) usare il
simulatore in `../simulatore/index.html`.
