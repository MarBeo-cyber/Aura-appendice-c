/* ============================================================================
   Adapter Outlook per "Lo strumento" (Appendice C).
   - Superficie: SOLO lettura del messaggio (MessageRead). Scelta derivata dal
     testo: la nota è rivolta a chi legge; il mittente non ha sbagliato.
   - Ruolo di chi legge: DICHIARATO nel riquadro e persistito in locale.
   - Ruolo del mittente: risolto da una rubrica dichiarata (mai inferito);
     se assente, va dichiarato manualmente per la sessione.
   - In lettura Outlook non consente di modificare il corpo ricevuto: la
     resa fedele di "in coda al messaggio" è il riquadro ancorabile + un
     banner informativo (limite piattaforma: 150 caratteri).
   ============================================================================ */
(function () {
  "use strict";

  var CHIAVE_RUOLO = "aura_tra_ruolo_lettore";

  function ruoloLettoreSalvato() {
    try { return localStorage.getItem(CHIAVE_RUOLO) || "conformita"; }
    catch (e) { return "conformita"; }
  }
  function salvaRuoloLettore(r) {
    try { localStorage.setItem(CHIAVE_RUOLO, r); } catch (e) { /* locale non disponibile */ }
  }
  function logLocale(evento) {
    try {
      var k = "aura_tra_log";
      var arr = JSON.parse(localStorage.getItem(k) || "[]");
      evento.t = new Date().toISOString();
      arr.push(evento);
      localStorage.setItem(k, JSON.stringify(arr));
    } catch (e) { /* il registro resta facoltativo */ }
  }

  function selettoreRuoli(id, valore, etichetta) {
    var opts = Object.keys(TraEngine.RUOLI).map(function (k) {
      return '<option value="' + k + '"' + (k === valore ? " selected" : "") + ">" +
        TraEngine.RUOLI[k].label + "</option>";
    }).join("");
    return '<div><label for="' + id + '">' + etichetta + '</label><select id="' + id + '">' + opts + "</select></div>";
  }

  function esegui(testo, meta, adapter) {
    var pane = document.getElementById("pane");
    var ruoloLettore = ruoloLettoreSalvato();
    var ruoloMittente = TraEngine.rubricaDemo[(meta.mittenteEmail || "").toLowerCase()] || "non_dichiarato";

    function ciclo() {
      var risultato = TraEngine.analyzeMessage({
        testo: testo,
        ruoloMittente: ruoloMittente,
        ruoloDestinatario: ruoloLettore,
        dateISO: meta.dataISO
      });
      pane.innerHTML = "";
      var controlli = document.createElement("div");
      controlli.className = "pane-controlli";
      controlli.innerHTML =
        selettoreRuoli("sel-mittente", ruoloMittente, "Ruolo del mittente (dichiarato)") +
        selettoreRuoli("sel-lettore", ruoloLettore, "Il tuo ruolo (dichiarato)");
      var corpo = document.createElement("div");
      PaneUI.render(corpo, risultato, adapter);
      pane.appendChild(controlli);
      pane.appendChild(corpo);
      document.getElementById("sel-mittente").onchange = function () {
        ruoloMittente = this.value; logLocale({ evento: "ruolo_mittente_dichiarato", valore: ruoloMittente }); ciclo();
      };
      document.getElementById("sel-lettore").onchange = function () {
        ruoloLettore = this.value; salvaRuoloLettore(ruoloLettore);
        logLocale({ evento: "ruolo_lettore_dichiarato", valore: ruoloLettore }); ciclo();
      };
    }
    ciclo();
  }

  /* ---------------------- Avvio dentro Outlook --------------------------- */
  function avvioOutlook() {
    var item = Office.context.mailbox.item;
    var adapter = {
      capacita: { appendNote: false, banner: true },
      apiConfig: null, /* superficie di lettura: nessun endpoint; il pane usa il prompt copia-incolla */
      appendNote: function () { /* non disponibile in lettura */ },
      banner: function (breve) {
        item.notificationMessages.replaceAsync("aura_tra_nota", {
          type: "informationalMessage",
          message: breve.substring(0, 150),
          icon: "icona16",
          persistent: false
        });
      },
      log: logLocale
    };
    item.body.getAsync(Office.CoercionType.Text, function (res) {
      var testo = (res.status === Office.AsyncResultStatus.Succeeded) ? res.value : "";
      var meta = {
        mittenteEmail: item.from ? item.from.emailAddress : "",
        dataISO: item.dateTimeCreated ? item.dateTimeCreated.toISOString() : null
      };
      esegui(testo, meta, adapter);
    });
  }

  /* ------------- Modalità anteprima (file aperto fuori da Outlook) ------- */
  function avvioAnteprima() {
    var testoCanonico = "Ciao, ti aggiorno sull\u2019intermittenza di oggi sul filtro antifrode. " +
      "Situazione rientrata: l\u2019impatto \u00E8 stato contenuto, i pagamenti trattenuti sono ripartiti " +
      "da soli al ripristino. Non ho aperto un incident formale perch\u00E9 la cosa si \u00E8 chiusa in " +
      "fretta e nessun cliente ne ha risentito \u2014 direi che possiamo derubricarla. Ti giro il log " +
      "per completezza. Buon weekend.";
    var adapter = {
      capacita: { appendNote: false, banner: false },
      apiConfig: null,
      appendNote: function () {}, banner: function () {}, log: logLocale
    };
    esegui(testoCanonico, {
      mittenteEmail: "continuita.operativa@banca-demo.example",
      dataISO: "2026-07-03T17:28:00+02:00"
    }, adapter);
    var sotto = document.querySelector(".pane-sotto");
    if (sotto) sotto.textContent += " \u00B7 anteprima fuori da Outlook (caso illustrativo)";
  }

  var avviato = false;
  if (typeof Office !== "undefined" && Office.onReady) {
    Office.onReady(function (info) {
      if (avviato) return;
      avviato = true;
      if (info && info.host === Office.HostType.Outlook) avvioOutlook();
      else avvioAnteprima();
    });
  }
  setTimeout(function () {
    if (!avviato) { avviato = true; avvioAnteprima(); }
  }, 2500);
})();
