/* ============================================================================
   TraEngine v0.2 — "Lo strumento al lavoro" (La Mente e la Macchina, Appendice C)
   Autore: Marco Giuseppe Beozzi — framework AURA (Schema Memory M0/M1/M2)
   ----------------------------------------------------------------------------
   COSA CAMBIA RISPETTO ALLA v0.1
   Le domande non sono cablate. Il motore (1) MISURA la distanza cognitiva fra
   due schemi sopra un insieme di ancoraggi condivisi, e (2) su quella distanza
   TARA un prompt con cui interpellare un LLM perche' generi la domanda adeguata.
   La nota canonica del libro compare solo come benchmark dichiarato, mai come
   uscita cablata dello strumento.

   FONDAMENTO (dal libro, Cap. X «Le due incisioni»):
   - «quanto la sua geometria coincide con la nostra, e dove se ne allontana»:
     l'ambiguita' non e' una proprieta' di un elenco di parole (sarebbe il
     martello rosso applicato al lessico) ma della distanza fra due schemi
     sopra le parole presenti. L'insieme resta quindi APERTO.
   - «Se si esprimono entrambi gli spazi rispetto agli stessi ancoraggi ... le
     due geometrie collassano in un sistema di coordinate comune ... la distanza
     cognitiva ... acquista una sola metrica»: la distanza e' una misura reale
     su ancoraggi condivisi (rappresentazioni relative / RSA + allineamento).
   - Parole-caso citate dal libro oltre allo scenario SEPA: «urgente»,
     «approvato», «accettabile».
   ----------------------------------------------------------------------------
   INVARIANTI (ogni modifica deve preservarli):
   1. Non riscrive e non blocca. Rende visibile, non corregge.
   2. La nota/domanda e' rivolta a chi legge; non avverte il mittente.
   3. Nessuna inferenza di attributi demografici o culturali. Lo strato M1
      opera solo su RUOLI PROFESSIONALI DICHIARATI.
   4. Il modulo clinico stima uno scarto individuale IN QUESTO SCAMBIO, mai un
      tratto di gruppo.
   5. Non e' un motore di regole normative: non conosce soglie di legge, non decide.
   6. Lessico: "elabora", "stima", "misura", "rileva". Mai "comprende".
   ----------------------------------------------------------------------------
   ARCHITETTURA A TRE STRATI
   [1] SpazioSchemi + ModelloDistanza  -> misura la distanza cognitiva.
       ModelloDistanza e' sostituibile: 'dichiarato' (offline, ispezionabile)
       oppure 'embedding' (ancore condivise, cosine) — interfaccia pronta.
   [2] Interrogatore                    -> costruisce il PROMPT tarato sulla
       distanza; modalita' 'prompt' (offline, copia-incolla) o 'api' (endpoint
       fornito dall'utente). Fallback locale = compositore calibrato (NON il
       testo del libro).
   [3] riferimentoLibro                 -> testo canonico dell'Appendice C, solo
       come benchmark dichiarato di cosa una buona generazione dovrebbe produrre.
   ============================================================================ */
(function (root) {
  "use strict";

  /* ====================================================================== */
  /* Ruoli dichiarati (M1 ammesso: acquisito, dichiarato, pubblico)         */
  /* ====================================================================== */
  var RUOLI = {
    continuita_operativa: { label: "Continuità operativa", chi: "chi presidia la continuità" },
    conformita:           { label: "Conformità normativa", chi: "chi presidia la conformità" },
    it:                   { label: "IT / Sistemi",          chi: "chi presidia i sistemi" },
    business:             { label: "Business / Rete",       chi: "chi presidia la relazione col cliente" },
    risk:                 { label: "Risk Management",       chi: "chi presidia il rischio" },
    non_dichiarato:       { label: "Non dichiarato",        chi: "il mittente" }
  };

  /* ====================================================================== */
  /* [1a] ANCORAGGI CONDIVISI                                                */
  /* Insieme di ancore su cui i due schemi vengono espressi nello stesso    */
  /* sistema di coordinate. NON e' l'elenco chiuso delle "parole pericolose":*/
  /* e' il paesaggio comune rispetto a cui si misura la distanza. Chi rileva */
  /* i termini presenti puo' proporne di fuori-corpus (candidateExtractor).  */
  /* valenza per ruolo: +1 rassicurante / -1 attivante / 0 neutra nel ruolo. */
  /* ====================================================================== */
  var ANCORE = [
    {
      id: "rientrata", citazione: "rientrata", pattern: /\brientrat[oaie]\b/gi, peso: 1.0,
      letture: {
        continuita_operativa: { v: +1, glossa: "il servizio è di nuovo operativo: l'evento è concluso" },
        conformita:           { v: -1, glossa: "al ripristino comincia la vita regolamentare dell'evento" },
        it:                   { v: +1, glossa: "il sistema è tornato in esercizio" }
      }
    },
    {
      id: "contenuto", citazione: "contenuta", pattern: /\bcontenut[oaie]\b/gi, peso: 0.8,
      letture: {
        continuita_operativa: { v: +1, glossa: "l'impatto è stato piccolo" },
        conformita:           { v: -1, glossa: "impatto piccolo non riduce l'obbligo: lo rende più facile da omettere" }
      }
    },
    {
      id: "chiusa", citazione: "chiusa", pattern: /\bchius[oaie](\s+in\s+fretta)?\b/gi, peso: 0.8,
      letture: {
        continuita_operativa: { v: +1, glossa: "la cosa si è risolta presto" },
        conformita:           { v: -1, glossa: "la rapidità di archiviazione non cancella l'evento dai conteggi" },
        it:                   { v: +1, glossa: "il ticket è stato risolto" }
      }
    },
    {
      id: "derubricare", citazione: "derubricarla", pattern: /\bderubricar\w*\b/gi, peso: 1.4, archiviazione: true,
      letture: {
        continuita_operativa: { v: +1, glossa: "non formalizzare: nessun danno, nessun allarme necessario" },
        conformita:           { v: -1, glossa: "sottrarre un evento a una statistica che va comunicata" }
      }
    },
    /* --- parole-caso citate esplicitamente dal libro (Cap. X) --- */
    {
      id: "approvato", citazione: "approvato", pattern: /\bapprovat[oaie]\b/gi, peso: 0.9,
      letture: {
        business:   { v: +1, glossa: "via libera: si può procedere con il cliente" },
        risk:       { v: -1, glossa: "approvato entro condizioni e limiti: fuori da quelli decade" },
        conformita: { v: -1, glossa: "approvato nel merito non equivale a conforme negli adempimenti" },
        it:         { v: +1, glossa: "change autorizzato: si può rilasciare" }
      }
    },
    {
      id: "accettabile", citazione: "accettabile", pattern: /\baccettabil[ei]\b/gi, peso: 0.9,
      letture: {
        business:   { v: +1, glossa: "buono abbastanza per chiudere" },
        risk:       { v: -1, glossa: "entro tolleranza dichiarata, non privo di rischio" },
        conformita: { v: -1, glossa: "tollerato non significa dovuto o documentato" }
      }
    },
    {
      id: "urgente", citazione: "urgente", pattern: /\burgent[ei]\b/gi, peso: 0.6,
      letture: {
        it:                   { v: -1, glossa: "richiede intervento immediato" },
        continuita_operativa: { v: -1, glossa: "richiede intervento immediato" },
        conformita:           { v: -1, glossa: "richiede presa in carico immediata" },
        business:             { v: -1, glossa: "il cliente attende una risposta rapida" }
      }
    },
    {
      id: "critico", citazione: "critico", pattern: /\bcritic[oaie]\b/gi, peso: 0.6,
      letture: {
        it:                   { v: -1, glossa: "componente essenziale a rischio" },
        continuita_operativa: { v: -1, glossa: "servizio essenziale a rischio" },
        conformita:           { v: -1, glossa: "evento con possibile rilievo di segnalazione" }
      }
    },
    {
      id: "preso_in_carico", citazione: "preso in carico", pattern: /\bpres[oa]\s+in\s+carico\b/gi, peso: 0.7,
      letture: {
        it:       { v: +1, glossa: "il ticket è assegnato ed entra in coda di lavorazione" },
        business: { v: -1, glossa: "qualcuno ci sta lavorando adesso e l'esito è vicino" }
      }
    }
  ];

  /* Amplificatori: configurazioni del testo che trasformano la divergenza   */
  /* in rischio di omissione (contesto, non nuove "parole pericolose").      */
  var AMPLIFICATORI = [
    { id: "incident_non_aperto", pattern: /non\s+ho\s+aperto\s+(un\s+)?incident/i, descrizione: "mancata formalizzazione dichiarata" },
    { id: "lasciamo_perdere",    pattern: /lasciamo\s+perdere/i,                    descrizione: "proposta esplicita di archiviazione" },
    { id: "archiviazione",       pattern: /\b(archiviar\w*|derubricar\w*)\b/i,      descrizione: "proposta di archiviazione" }
  ];

  /* Context pack: conoscenza di dominio DICHIARATA (statuto: riferimenti reali). */
  var contextPacks = [
    {
      id: "sepa_instant_antifrode", versione: "1.0",
      etichetta: "Pagamenti istantanei / filtro antifrode",
      riferimento: "Reg. (UE) 2024/886 (Instant Payments Regulation): reportistica periodica alle autorità nazionali competenti dei tassi di rifiuto e di blocco sui pagamenti istantanei (dal 9 aprile 2026).",
      /* euristica dichiarata: un filtro antifrode nominato insieme a pagamenti/
         transazioni è il contesto SEPA-instant antifrode. Si aggancia alla
         lingua effettiva del messaggio, non alla narrazione del libro. */
      match: function (t) { return /filtro\s+antifrode/i.test(t) && /(SEPA|istantane\w*|pagament\w*|transazion\w*)/i.test(t); },
      coppia: { mittente: "continuita_operativa", destinatario: "conformita" }
    }
  ];

  /* ====================================================================== */
  /* [1b] MODELLO DI DISTANZA — sostituibile                                 */
  /* Interfaccia: valenza(voce, ruolo) -> {v:-1|0|+1, glossa} | null          */
  /* ====================================================================== */
  var ModelloDichiarato = {
    tipo: "dichiarato",
    descrizione: "Valenze dichiarate per ruolo sugli ancoraggi. Offline, deterministico, ispezionabile. Misura ciò che è stato dichiarato: è la linea di base trasparente, non una stima semantica.",
    valenza: function (voce, ruolo) {
      var l = voce.letture[ruolo];
      return l ? { v: l.v, glossa: l.glossa } : null;
    }
  };

  /* Seam per lo stimatore semantico: rappresentazioni relative su ancore     */
  /* condivise (embedding role-conditioned, distanza coseno). Non spedito qui */
  /* (nessun modello locale); stessa interfaccia e stessa forma d'uscita,     */
  /* cosi' e' sostituibile senza toccare il resto. È lo strato in cui la      */
  /* distanza si MISURA anziche' leggersi.                                    */
  var ModelloEmbedding = null; // { tipo:'embedding', valenza(voce,ruolo), disponibile:false }
  function modelloAttivo() { return ModelloEmbedding && ModelloEmbedding.disponibile ? ModelloEmbedding : ModelloDichiarato; }

  /* candidateExtractor: di default rileva gli ancoraggi noti nel testo.      */
  /* Sostituibile con un estrattore semantico che proponga anche termini      */
  /* fuori-corpus (l'insieme e' aperto). Ritorna [{voce, occorrenze}].        */
  function estraiCandidatiDaCorpus(testo) {
    var out = [];
    ANCORE.forEach(function (voce) {
      voce.pattern.lastIndex = 0;
      var m = testo.match(voce.pattern);
      if (m) out.push({ voce: voce, occorrenze: m.length });
    });
    return out;
  }
  var candidateExtractor = estraiCandidatiDaCorpus;

  /* ====================================================================== */
  /* [1c] MISURA DELLA DISTANZA COGNITIVA                                     */
  /* distanza = Σ w(t)·|v_mitt(t) − v_dest(t)|/2  /  Σ w(t)   ∈ [0,1]         */
  /* ribaltamento(t)  ⇔  v_mitt(t)·v_dest(t) < 0                              */
  /* ====================================================================== */
  var SOGLIE = { media: 0.34, alta: 0.67 };

  function banda(distanza, ribaltamenti) {
    if (ribaltamenti >= 1 && distanza >= 0.5) return "alta";
    if (distanza >= SOGLIE.alta) return "alta";
    if (distanza >= SOGLIE.media || ribaltamenti >= 1) return "media";
    return "bassa";
  }

  function misuraDistanza(input) {
    var testo = input.testo || "";
    var rm = input.ruoloMittente || "non_dichiarato";
    var rd = input.ruoloDestinatario || "non_dichiarato";
    var mod = modelloAttivo();

    var esito = {
      versioneMotore: "0.2", modelloDistanza: mod.tipo,
      ruoloMittente: rm, ruoloDestinatario: rd,
      coppiaDichiarata: rm !== "non_dichiarato" && rd !== "non_dichiarato",
      termini: [], nonValutabili: [], amplificatori: [],
      distanza: 0, ribaltamenti: 0, banda: "bassa", contesto: null
    };

    if (!esito.coppiaDichiarata) {
      candidateExtractor(testo).forEach(function (c) {
        esito.nonValutabili.push({ id: c.voce.id, citazione: c.voce.citazione, occorrenze: c.occorrenze,
          motivo: "ruoli non dichiarati (M1 non si inferisce)" });
      });
      return esito;
    }

    var sommaPesi = 0, sommaPesata = 0;
    candidateExtractor(testo).forEach(function (c) {
      var voce = c.voce;
      var a = mod.valenza(voce, rm), b = mod.valenza(voce, rd);
      if (!a || !b) {
        esito.nonValutabili.push({ id: voce.id, citazione: voce.citazione, occorrenze: c.occorrenze,
          motivo: "coppia di ruoli non coperta dal modello per questo ancoraggio" });
        return;
      }
      var d = Math.abs(a.v - b.v) / 2;
      var ribalta = (a.v * b.v) < 0;
      if (ribalta) esito.ribaltamenti += 1;
      sommaPesi += voce.peso; sommaPesata += voce.peso * d;
      esito.termini.push({
        id: voce.id, citazione: voce.citazione, occorrenze: c.occorrenze,
        letturaMittente: a.glossa, letturaDestinatario: b.glossa,
        vMittente: a.v, vDestinatario: b.v,
        d: +d.toFixed(2), contributo: +(voce.peso * d).toFixed(3),
        ribaltamento: ribalta, archiviazione: !!voce.archiviazione
      });
    });

    AMPLIFICATORI.forEach(function (x) { if (x.pattern.test(testo)) esito.amplificatori.push({ id: x.id, descrizione: x.descrizione }); });

    esito.distanza = sommaPesi > 0 ? +(sommaPesata / sommaPesi).toFixed(2) : 0;
    esito.banda = banda(esito.distanza, esito.ribaltamenti);

    for (var i = 0; i < contextPacks.length; i++) {
      var p = contextPacks[i];
      if (p.match(testo) && p.coppia.mittente === rm && p.coppia.destinatario === rd) {
        esito.contesto = { id: p.id, etichetta: p.etichetta, riferimento: p.riferimento, versione: p.versione }; break;
      }
    }
    return esito;
  }

  /* ====================================================================== */
  /* [2] INTERROGATORE — costruisce il prompt tarato sulla distanza          */
  /* ====================================================================== */
  var INTENTO_BANDA = {
    bassa: "Le letture dei due ruoli quasi coincidono. Probabilmente non serve alcuna domanda; se proprio, una sola riga che conferma il significato condiviso.",
    media: "Le letture divergono su un termine. Serve una domanda mirata che porti l'altro a esplicitare in che senso sta usando quel termine, senza suggerirgli la risposta.",
    alta:  "Le letture si ribaltano: lo stesso termine è rassicurante per l'uno e attivante per l'altro. Serve una domanda di RESTITUZIONE — non 'hai capito?' (a cui si risponde sempre di sì), ma una domanda che chieda all'altro di ridire con parole proprie ciò che farà o come intende, così che la divergenza diventi visibile."
  };

  var REGOLE_STRUMENTO = [
    "Non riscrivere il messaggio e non dire al mittente che ha sbagliato: non ha sbagliato, nel suo dominio ha ragione.",
    "La nota è rivolta a CHI LEGGE (il destinatario), non al mittente.",
    "Non decidere al posto suo e non affermare che una cosa vada fatta: non conosci le soglie di legge, non sei un motore di regole.",
    "Non inferire nulla su cultura, provenienza o tratti della persona: usa solo i ruoli professionali dichiarati.",
    "Rendi visibile la distanza, non abolirla: correggi l'errore con cui uno stima la distanza dall'altro."
  ];

  function frase(lista) { return lista.map(function (s, i) { return (i + 1) + ". " + s; }).join("\n"); }
  function _terminiRibaltati(m) { return m.termini.filter(function (t) { return t.ribaltamento; }); }

  function costruisciPromptMessaggio(m, opzioni) {
    opzioni = opzioni || {};
    var lm = RUOLI[m.ruoloMittente].label, ld = RUOLI[m.ruoloDestinatario].label;
    var rib = _terminiRibaltati(m);
    var elencoTermini = m.termini.map(function (t) {
      return "- «" + t.citazione + "»: per " + lm + " = " + t.letturaMittente +
             "; per " + ld + " = " + t.letturaDestinatario +
             " (distanza " + t.d.toFixed(2) + (t.ribaltamento ? ", SI RIBALTA" : "") + ").";
    }).join("\n");
    var ctx = m.contesto ? ("\nContesto di dominio dichiarato: " + m.contesto.etichetta + ". " + m.contesto.riferimento) : "";
    var ampl = m.amplificatori.length ? ("\nNel testo è presente: " + m.amplificatori.map(function (a) { return a.descrizione; }).join("; ") + ".") : "";

    var sistema =
      "Sei un componente che, in una comunicazione professionale, rende visibile a chi legge la distanza fra la propria lettura di una parola e quella di chi l'ha scritta. " +
      "Rispetti queste regole senza eccezioni:\n" + frase(REGOLE_STRUMENTO);

    var utente =
      "MITTENTE (ruolo dichiarato): " + lm + " — " + RUOLI[m.ruoloMittente].chi + ".\n" +
      "DESTINATARIO / chi legge (ruolo dichiarato): " + ld + " — " + RUOLI[m.ruoloDestinatario].chi + ".\n\n" +
      "MESSAGGIO RICEVUTO:\n«" + (opzioni.testoMessaggio || "").trim() + "»\n\n" +
      "DISTANZA COGNITIVA MISURATA fra i due ruoli su questo messaggio: " + m.distanza.toFixed(2) + " su 1 (banda «" + m.banda + "»), " +
      m.ribaltamenti + (m.ribaltamenti === 1 ? " termine si ribalta" : " termini si ribaltano") + ".\n" +
      "Termini rilevanti e loro doppia lettura:\n" + elencoTermini + ctx + ampl + "\n\n" +
      "CALIBRAZIONE RICHIESTA (dettata dalla distanza): " + INTENTO_BANDA[m.banda] + "\n\n" +
      "COMPITO: scrivi UNA nota in italiano, breve (max ~70 parole), rivolta a chi legge, da apporre in coda al messaggio. " +
      "La nota deve: (a) dire in una riga che cosa il mittente intende con " +
      (rib.length ? rib.map(function (t) { return "«" + t.citazione + "»"; }).join(", ") : "quei termini") +
      " nella sua funzione; (b) dire che dal lato di chi legge la stessa parola potrebbe attivare l'altra lettura; " +
      (m.banda === "alta"
        ? "(c) chiudere con una domanda di RESTITUZIONE da rivolgere al mittente, che chieda di ridire con parole proprie cosa intende o farà — non una domanda a cui si risponda sì/no."
        : m.banda === "media"
          ? "(c) chiudere con una domanda mirata che porti il mittente a esplicitare in che senso usa quel termine."
          : "(c) se la distanza è davvero minima, puoi concludere che non serve intervenire.") +
      " Non usare la parola «intuizione». Non affermare che l'evento vada riportato o archiviato: dì solo che le due letture potrebbero non coincidere e che vale la pena verificarlo" +
      (opzioni.finestra ? " " + opzioni.finestra : "") + ".";

    return {
      modalita: "prompt", banda: m.banda,
      testo: "### ISTRUZIONI DI SISTEMA\n" + sistema + "\n\n### RICHIESTA\n" + utente,
      messaggiApi: [{ role: "system", content: sistema }, { role: "user", content: utente }]
    };
  }

  /* Fallback locale calibrato: NON e' il testo del libro. Compone una nota    */
  /* del tipo dettato dalla banda, dalle glosse, quando nessun LLM e'          */
  /* raggiungibile.                                                            */
  function fallbackLocale(m, opzioni) {
    opzioni = opzioni || {};
    if (m.banda === "bassa") return null;
    var rib = _terminiRibaltati(m);
    var base = rib.length ? rib : m.termini;
    if (!base.length) return null;
    var lm = RUOLI[m.ruoloMittente].chi;
    var termini = base.map(function (t) { return "«" + t.citazione + "»"; }).join(", ");
    var t = "* Nota per chi legge: quando " + lm + " scrive " + termini + ", nella sua funzione intende che " +
      base[0].letturaMittente + ". Dal tuo lato, " + base.map(function (x) { return x.letturaDestinatario; }).join("; ") + ".";
    if (m.amplificatori.length) t += " È presente una proposta di archiviazione che dà per scontato che le due letture coincidano.";
    if (m.banda === "alta")
      t += " Non chiedergli «è tutto chiaro?»: chiedigli di ridirti con parole sue che cosa considera concluso e che cosa no" + (opzioni.finestra ? ", " + opzioni.finestra : "") + ".";
    else
      t += " Vale la pena chiedergli in che senso lo intende" + (opzioni.finestra ? ", " + opzioni.finestra : "") + ".";
    return { origine: "fallback-locale", testo: t };
  }

  /* Chiamata API opzionale. endpoint fornito dall'utente (nessuna chiave nel  */
  /* client: si punta a un proprio proxy). Ritorna Promise<string>.           */
  function chiamaApi(prompt, config) {
    config = config || {};
    if (!config.endpoint) return Promise.reject(new Error("Nessun endpoint configurato. Usa la modalità prompt (copia-incolla) oppure imposta un endpoint proprio."));
    var body = config.buildBody ? config.buildBody(prompt.messaggiApi)
      : { messages: prompt.messaggiApi, max_tokens: 220, temperature: 0.4 };
    return fetch(config.endpoint, {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, config.headers || {}),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error("Endpoint ha risposto " + r.status);
      return r.json();
    }).then(function (j) {
      return config.extract ? config.extract(j)
        : (j.text || (j.content && j.content[0] && j.content[0].text) || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || JSON.stringify(j));
    });
  }

  /* ====================================================================== */
  /* [3] RIFERIMENTO DAL LIBRO — benchmark dichiarato, NON uscita cablata     */
  /* ====================================================================== */
  var riferimentoLibro = {
    sepa_instant_antifrode:
      "«* Una nota prima che tu chiuda il portatile: quando lui scrive \u201Crientrata\u201D, \u201Ccontenuta\u201D, \u201Cchiusa\u201D, intende che il servizio \u00E8 tornato e i clienti non ne hanno risentito. Dal tuo lato, la stessa intermittenza del filtro antifrode potrebbe essere un evento che va contato nella reportistica sui blocchi dovuta all\u2019autorit\u00E0. La proposta di \u201Cderubricarla\u201D d\u00E0 per scontato che le due cose coincidano. Potrebbero non coincidere: vale la pena verificarlo prima del weekend, non luned\u00EC.»",
    clinico:
      "«* Nota: questo \u201Cs\u00EC, grazie dottore\u201D potrebbe essere una conferma di comprensione, oppure un segno di rispetto verso di lei che non implica comprensione. La differenza, con una posologia che cambia dopo sette giorni, \u00E8 clinica. Se vuole esserne certo, non chieda di nuovo \u201Cha capito?\u201D \u2014 a cui la risposta sar\u00E0 ancora s\u00EC: le chieda di ripeterle lei come prender\u00E0 le compresse domani, e dopodomani.»"
  };

  function finestraTemporale(dateISO) {
    if (!dateISO) return "prima di archiviare";
    var d = new Date(dateISO);
    if (isNaN(d.getTime())) return "prima di archiviare";
    if (d.getDay() === 5 && d.getHours() >= 13) return "prima del weekend, non lunedì";
    return "prima di archiviare";
  }

  function analizzaMessaggio(input) {
    var m = misuraDistanza(input);
    var opzioni = { testoMessaggio: input.testo, finestra: finestraTemporale(input.dateISO) };
    m.prompt = m.coppiaDichiarata && m.termini.length ? costruisciPromptMessaggio(m, opzioni) : null;
    m.fallback = m.coppiaDichiarata ? fallbackLocale(m, opzioni) : null;
    m.riferimentoLibro = (m.contesto && riferimentoLibro[m.contesto.id]) ? riferimentoLibro[m.contesto.id] : null;
    return m;
  }

  /* ====================================================================== */
  /* MODULO CLINICO — la distanza fra due letture dell'assenso               */
  /* ====================================================================== */
  function complessitaPosologia(pos) {
    var fattori = [], righe = pos.righe || [], cambioDopoGiorni = null;
    for (var i = 1; i < righe.length; i++) {
      if (righe[i].dose !== righe[i - 1].dose || righe[i].momento !== righe[i - 1].momento) {
        fattori.push("il regime cambia dal giorno " + righe[i].dalGiorno + " (da " + righe[i - 1].dose + " a " + righe[i].dose + " al " + righe[i].momento + ")");
        if (cambioDopoGiorni === null) cambioDopoGiorni = righe[i].dalGiorno - 1;
      }
    }
    if ((pos.divieti || []).length) fattori.push("vincolo orario: mai la " + pos.divieti.map(function (d) { return d.momento; }).join(", "));
    if (pos.sospensione && pos.sospensione.condizione) fattori.push("sospensione condizionale: se compare «" + pos.sospensione.condizione + "»");
    return { score: fattori.length, fattori: fattori, cambioDopoGiorni: cambioDopoGiorni };
  }

  var FORMULA_CORTESIA = /^(va\s+bene[\s,!.]*)?(s[i\u00EC][\s,!.]*)+(va\s+bene[\s,!.]*)?(grazie[\s,!.]*)?(dottor\w*|dott\.?|dottoress\w*)?[\s,!.]*$/i;
  var PAROLE_CONTENUTO = /(compress\w*|pastigli\w*|mattin\w*|sera\w*|giorn\w*|ottav\w*|settim\w*|sospend\w*|smett\w*|interromp\w*|\bun[oa]?\b|\bdue\b|\btre\b|\b[0-9]+\b)/i;

  function analizzaAssenso(testo, domandaTipo) {
    var t = (testo || "").trim();
    var cortesia = FORMULA_CORTESIA.test(t);
    var contenuto = PAROLE_CONTENUTO.test(t);
    var breve = t.split(/\s+/).filter(Boolean).length <= 8;
    return {
      forma: (cortesia || (breve && !contenuto)) ? "cortesia" : "restituzione",
      prontezza: breve ? "immediata" : "articolata",
      contenutoPosologico: contenuto,
      domanda: domandaTipo || "nessuna"
    };
  }

  function distanzaAssenso(assenso, comp) {
    var deferenza = assenso.forma === "cortesia" ? 0.8 : 0.2;
    if (assenso.contenutoPosologico) deferenza -= 0.3;
    if (assenso.domanda === "restituzione") deferenza -= 0.3;
    deferenza = Math.max(0, Math.min(1, deferenza));
    var costo = Math.max(0, Math.min(1, comp.score / 3));
    return +(deferenza * (0.5 + 0.5 * costo)).toFixed(2);
  }

  function costruisciPromptClinico(ctx) {
    var comp = ctx.complessita, assenso = ctx.assenso, d = ctx.distanza;
    var dopo = comp.cambioDopoGiorni ? comp.cambioDopoGiorni + " giorni" : "pochi giorni";
    var posTxt = (ctx.posologia.righe || []).map(function (r) {
      return "- " + r.dose + " al " + r.momento + (r.alGiorno ? " nei giorni " + r.dalGiorno + "–" + r.alGiorno : " dal giorno " + r.dalGiorno);
    }).join("\n");
    if ((ctx.posologia.divieti || []).length) posTxt += "\n- mai la " + ctx.posologia.divieti.map(function (x) { return x.momento; }).join(", ");
    if (ctx.posologia.sospensione && ctx.posologia.sospensione.condizione) posTxt += "\n- sospendere se compare: " + ctx.posologia.sospensione.condizione;

    var sistema =
      "Sei un componente che, al momento in cui un medico registra l'assenso di un paziente, rende visibile al medico la distanza che quell'assenso potrebbe nascondere. Regole senza eccezioni:\n" +
      "1. Non affermare che il paziente non ha capito: non lo sai. Stima solo che la FORMA di questo assenso è compatibile anche con la deferenza.\n" +
      "2. Non inferire nulla dalla provenienza o cultura del paziente: lavora solo sulla forma osservabile dell'assenso e sulla complessità della posologia in questo scambio.\n" +
      "3. Non ridurre il paziente: la domanda che proponi deve ridargli il posto per dire, senza mancare di rispetto, ciò che non ha capito.\n" +
      "4. Non sostituirti al medico e non dare istruzioni cliniche.";

    var utente =
      "POSOLOGIA REDATTA:\n" + posTxt + "\n(La posologia cambia dopo " + dopo + ": " + comp.score + " elementi di complessità.)\n\n" +
      "ASSENSO REGISTRATO: forma «" + assenso.forma + "», " + assenso.prontezza +
      (assenso.contenutoPosologico ? ", con elementi della posologia" : ", senza contenuto posologico") +
      "; la verifica posta dal medico è di tipo «" + assenso.domanda + "».\n" +
      "DISTANZA INTERPRETATIVA MISURATA: " + d.toFixed(2) + " su 1 (più è alta, più la forma dell'assenso è compatibile con la deferenza a fronte di una posologia il cui errore ha costo clinico).\n\n" +
      "CALIBRAZIONE: " +
      (d >= 0.5
        ? "la distanza è alta: NON proporre di richiedere «ha capito?» (a cui la risposta sarà ancora sì). Proponi una domanda di RESTITUZIONE che chieda al paziente di ridire con parole proprie come prenderà la terapia nei prossimi giorni, in modo che la comprensione o ci sia e si veda, o non ci sia e si veda."
        : "la distanza è contenuta: una verifica leggera può bastare; non appesantire.") + "\n\n" +
      "COMPITO: scrivi UNA nota in italiano (max ~70 parole) rivolta al medico, che (a) dica che questo assenso potrebbe essere comprensione oppure rispetto che non implica comprensione; (b) ricordi che con una posologia che cambia dopo " + dopo + " la differenza è clinica; (c) proponga, se la distanza è alta, la domanda di restituzione esatta da rivolgere al paziente. Non usare la parola «intuizione».";

    return {
      modalita: "prompt", banda: d >= 0.5 ? "alta" : "media",
      testo: "### ISTRUZIONI DI SISTEMA\n" + sistema + "\n\n### RICHIESTA\n" + utente,
      messaggiApi: [{ role: "system", content: sistema }, { role: "user", content: utente }]
    };
  }

  function fallbackClinicoLocale(ctx) {
    if (ctx.distanza < 0.5) return null;
    var dopo = ctx.complessita.cambioDopoGiorni ? ctx.complessita.cambioDopoGiorni + " giorni" : "pochi giorni";
    return {
      origine: "fallback-locale",
      testo: "* Nota per il medico: questo assenso potrebbe essere una conferma di comprensione, oppure un segno di rispetto che non la implica. Con una posologia che cambia dopo " + dopo + ", la differenza è clinica. Non chieda di nuovo «ha capito?»: chieda al paziente di ripeterle lui come prenderà le compresse nei prossimi giorni."
    };
  }

  function analizzaRedazione(input) {
    var pos = input.posologia || { righe: [] };
    var colloquio = input.colloquio || {};
    var comp = complessitaPosologia(pos);
    var assenso = analizzaAssenso(colloquio.risposta, colloquio.domanda);
    var d = distanzaAssenso(assenso, comp);
    var ctx = { posologia: pos, complessita: comp, assenso: assenso, distanza: d };
    var fire = d >= 0.5;
    return {
      versioneMotore: "0.2",
      complessita: comp, assenso: assenso, distanza: d,
      banda: fire ? "alta" : (d >= 0.34 ? "media" : "bassa"),
      prompt: costruisciPromptClinico(ctx),
      fallback: fallbackClinicoLocale(ctx),
      riferimentoLibro: riferimentoLibro.clinico,
      motivazione: fire
        ? ["Forma dell'assenso compatibile con la deferenza (" + assenso.prontezza + ", senza restituzione) a fronte di posologia con " + comp.score + " elementi di complessità: distanza interpretativa " + d.toFixed(2) + ". Lo strumento non afferma che manchi comprensione: stima che la differenza, qui, sia clinica."]
        : ["Distanza interpretativa " + d.toFixed(2) + ": la forma dell'assenso o il basso costo della posologia non giustificano un intervento pesante."]
    };
  }

  var NUM_PAROLE = { un: 1, una: 1, uno: 1, due: 2, tre: 3, quattro: 4 };
  function numeriNelTesto(t) {
    var out = [];
    (t.match(/\b(un[oa]?|due|tre|quattro|[0-9]+)\b/gi) || []).forEach(function (w) {
      var n = NUM_PAROLE[w.toLowerCase()] || parseInt(w, 10); if (!isNaN(n)) out.push(n);
    });
    return out;
  }
  function valutaRestituzione(input) {
    var pos = input.posologia || { righe: [] };
    var t = (input.testo || "").toLowerCase();
    var numeri = numeriNelTesto(t), elementi = [];
    (pos.righe || []).forEach(function (r, i) {
      var doseOk = numeri.indexOf(r.dose) !== -1;
      var momentoOk = t.indexOf(r.momento.toLowerCase()) !== -1;
      var faseOk = true;
      if (i > 0) faseOk = /(ottav|giorno\s*8|dall.?\s*8|dopo\s+(i\s+)?(primi\s+)?sette|seconda\s+settimana)/i.test(t);
      else if ((pos.righe || []).length > 1) faseOk = /(primi|prima|fino|sette|settim|iniz|domani)/i.test(t);
      elementi.push({ etichetta: "Fase " + (i + 1) + ": " + r.dose + " al " + r.momento + (r.alGiorno ? " (giorni " + r.dalGiorno + "–" + r.alGiorno + ")" : " (dal giorno " + r.dalGiorno + ")"), coperto: doseOk && momentoOk && faseOk });
    });
    (pos.divieti || []).forEach(function (dv) {
      elementi.push({ etichetta: "Vincolo: mai la " + dv.momento, coperto: new RegExp("(mai|non)[^.]{0,25}" + dv.momento, "i").test(t) });
    });
    if (pos.sospensione && pos.sospensione.condizione)
      elementi.push({ etichetta: "Sospensione se: " + pos.sospensione.condizione, coperto: /(sospend|smett|interromp|non\s+(le|la|li)?\s*prend|chiam)/i.test(t) });
    var coperti = elementi.filter(function (e) { return e.coperto; }).length;
    return { elementi: elementi, copertura: elementi.length ? +(coperti / elementi.length).toFixed(2) : 0, completa: coperti === elementi.length && elementi.length > 0 };
  }

  var rubricaDemo = {
    "continuita.operativa@banca-demo.example": "continuita_operativa",
    "conformita@banca-demo.example": "conformita",
    "it.sistemi@banca-demo.example": "it",
    "rete.commerciale@banca-demo.example": "business"
  };

  root.TraEngine = {
    versione: "0.2",
    RUOLI: RUOLI, ANCORE: ANCORE, contextPacks: contextPacks,
    SOGLIE: SOGLIE, banda: banda,
    ModelloDichiarato: ModelloDichiarato,
    iniettaModelloEmbedding: function (m) { ModelloEmbedding = m; },
    impostaCandidateExtractor: function (fn) { candidateExtractor = fn || estraiCandidatiDaCorpus; },
    modelloAttivo: modelloAttivo,
    misuraDistanza: misuraDistanza,
    analizzaMessaggio: analizzaMessaggio,
    costruisciPromptMessaggio: costruisciPromptMessaggio,
    chiamaApi: chiamaApi,
    riferimentoLibro: riferimentoLibro,
    finestraTemporale: finestraTemporale,
    clinica: {
      analizzaRedazione: analizzaRedazione,
      valutaRestituzione: valutaRestituzione,
      complessitaPosologia: complessitaPosologia,
      distanzaAssenso: distanzaAssenso
    },
    rubricaDemo: rubricaDemo,
    analyzeMessage: function (input) {
      var m = analizzaMessaggio(input);
      m.stimatore = m.modelloDistanza;
      m.nota = null; m.notaBreve = null; m.motivazione = [];
      return m;
    }
  };

})(typeof window !== "undefined" ? window : globalThis);
