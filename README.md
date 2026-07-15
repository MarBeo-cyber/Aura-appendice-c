# Lo strumento al lavoro — demo dell'Appendice C

Due dimostratori del software descritto nell'Appendice C di *La Mente e la Macchina*
(«Lo strumento al lavoro: una parola che si ribalta»). Illustrano, su casi costruiti,
la stessa idea del Capitolo X «Le due incisioni»: la comprensione fra due menti non si
decide per introspezione ma si **misura** come distanza fra due geometrie riferite a
ancoraggi condivisi; e lo strumento non corregge chi parla, **rende visibile a chi legge**
la distanza fra la propria lettura di una parola e quella di chi l'ha scritta.

Le persone e gli episodi sono costruiti. Nessun dato lascia il browser.

## Le due superfici

| Superficie | Scenario | Cartella |
|---|---|---|
| Simulatore di posta (stile Outlook) | Banca: intermittenza del filtro antifrode su pagamenti istantanei, venerdì pomeriggio; quattro parole si ribaltano fra continuità operativa e conformità | `simulatore/index.html` |
| Innesto nella redazione della ricetta | Ambulatorio: un «sì, grazie dottore» che può essere comprensione o deferenza, con una posologia che cambia dopo sette giorni | `medico/index.html` |
| Add-in Outlook (sideload) | La stessa logica come riquadro di lettura reale in Outlook | `outlook/` |

Entrambi i file `index.html` sono **autonomi**: il motore è inlineato, si aprono con doppio clic.

## Il punto: le domande non sono cablate

La versione ingenua di questo strumento conterrebbe un elenco di parole pericolose e, per
ciascuna, la domanda giusta già scritta. Sarebbe il **martello rosso** applicato al lessico —
e contraddirebbe la tesi del libro, «i mezzi qualificano il fine»: lo strumento *reciterebbe*
la conclusione invece di *condurre* a essa. Qui, invece:

1. **La distanza si misura.** Ogni schema (ruolo) è espresso come lettura degli stessi
   ancoraggi; la distanza cognitiva è una metrica su [0,1], con un termine che «si ribalta»
   quando la sua valenza è opposta per i due ruoli. È l'operazionalizzazione delle
   *rappresentazioni relative* citate nel libro (RSA + allineamento su ancore condivise).
2. **La domanda si genera.** Sulla banda di distanza (bassa / media / alta) lo strumento
   **costruisce un prompt** e con quello interpella un LLM. La banda seleziona l'*intento*:
   distanza alta ⇒ domanda di **restituzione** (non «hai capito?», ma «ridimmi con parole tue»).
   Il software prepara la richiesta; la domanda non è dentro il software.
3. **Il set è aperto.** Il corpus di ancoraggi (incluse le parole-caso del libro: *urgente*,
   *approvato*, *accettabile*, oltre a *rientrata/contenuto/chiuso/derubricare*) è una linea
   di base ispezionabile, non un dizionario chiuso: uno stimatore semantico può proporre
   termini fuori-corpus.

La nota canonica dell'Appendice C compare solo come **benchmark dichiarato** («confronta con
la nota del libro»), mai come uscita cablata.

## Come interpellare il modello

Tre modalità, in ordine di dipendenza infrastrutturale:

- **Prompt (predefinita, offline).** Lo strumento mostra il prompt pronto: lo si copia in un
  qualunque LLM e si reincolla la risposta, che viene resa in tipografia del libro. Nessuna
  chiave, nessun server: adatta a GitHub Pages e al sideload.
- **API (opzionale).** Se si configura un `apiConfig.endpoint`, lo strumento fa il POST e
  mostra la risposta. L'endpoint deve essere **un proxy proprio**: una pagina statica non può
  custodire una chiave API, quindi il client non ne contiene alcuna.
- **Fallback locale (etichettato).** Se nessun modello è a portata, un compositore calibrato
  sulla distanza genera una nota del tipo dettato dalla banda — dichiaratamente *non* il testo
  del libro.

## Architettura (tre strati)

```
[1] SpazioSchemi + ModelloDistanza   -> misura la distanza cognitiva
    ModelloDichiarato  (offline, valenze dichiarate per ruolo, ispezionabile)
    ModelloEmbedding   (seam: embedding role-conditioned, distanza coseno)  <-- upgrade
    candidateExtractor (seam: insieme aperto, termini fuori-corpus)         <-- upgrade
[2] Interrogatore                     -> costruisce il prompt tarato sulla banda
    modalità 'prompt' (copia-incolla) | 'api' (endpoint proprio) | fallback locale
[3] riferimentoLibro                  -> nota canonica come benchmark dichiarato
```

Metrica: `distanza = Σ w(t)·|v_mitt(t) − v_dest(t)|/2 / Σ w(t)`, con `w(t)` peso dell'ancora.
Bande: bassa < 0.34 ≤ media < 0.67 ≤ alta (o alta se ≥1 ribaltamento e distanza ≥ 0.5).
Le soglie sono costanti dichiarate e documentate in `engine/tra_engine.js` (`SOGLIE`).

## Invarianti (preservati in ogni superficie)

1. Non riscrive e non blocca: rende visibile.
2. La nota è rivolta a chi legge, mai al mittente.
3. Nessuna inferenza demografica o culturale: lo strato M1 opera solo su **ruoli dichiarati**.
4. Nel modulo clinico, lo strumento stima uno scarto **individuale in questo scambio** (forma
   dell'assenso × costo clinico della posologia), mai un tratto di gruppo. Non deduce
   «paziente straniero ⇒ deferenza».
5. Non è un motore di regole normative: non conosce soglie di legge, non decide.
6. Lessico: «elabora / stima / misura / rileva», mai «comprende».

## Struttura dei file

```
engine/tra_engine.js         motore v0.2 (misura distanza + Interrogatore + modulo clinico)
outlook/pane_ui.js           riquadro (distanza + prompt + incolla/API/fallback + benchmark)
outlook/taskpane.*           add-in Outlook (manifest, HTML, CSS, adapter Office)
outlook/caso_illustrativo.eml email canonica da trascinare in Outlook
simulatore/index.html        simulatore di posta autonomo (build)
simulatore/index.template.html sorgente con placeholder /*__ENGINE__*/ /*__PANEUI__*/
medico/index.html            demo clinica autonoma (build)
medico/index.template.html   sorgente con placeholder /*__ENGINE__*/
```

Per ricostruire i `build`: sostituire i placeholder con il contenuto dei rispettivi file
sorgente (i template inlineano `engine/` e, per il simulatore, `outlook/pane_ui.js`).

## Statuto

Illustrazioni a fini dimostrativi. Riferimento normativo citato nel context pack bancario:
Reg. (UE) 2024/886 (Instant Payments Regulation), reportistica dei tassi di blocco alle
autorità competenti. Lo strumento non verifica soglie e non stabilisce se un evento vada
segnalato: mostra soltanto che due letture della stessa parola potrebbero non coincidere.
