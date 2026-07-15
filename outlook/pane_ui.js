/* ============================================================================
   PaneUI v0.2 — rendering del riquadro dello strumento (host-agnostico).
   Novità: il riquadro non mostra una nota cablata. Mostra
     (1) la DISTANZA COGNITIVA misurata fra i due schemi;
     (2) il PROMPT generato, tarato sulla banda di distanza, con cui interpellare
         un LLM; l'utente può copiarlo, incollare la risposta (che viene resa in
         tipografia del libro e apposta in coda al messaggio), oppure lanciare una
         chiamata API se ha configurato un endpoint proprio;
     (3) un fallback locale calibrato (etichettato: NON è il testo del libro);
     (4) la nota canonica del libro come BENCHMARK dichiarato, separata.

   adapter = {
     appendNote(testo) -> appende la nota in coda al messaggio (se l'host può)
     banner(breve)     -> banner informativo breve (se l'host può)
     log(evento)       -> registro locale (consenso bilaterale)
     apiConfig         -> { endpoint, headers?, buildBody?, extract? } | null
     capacita: { appendNote: bool, banner: bool }
   }
   ============================================================================ */
(function (root) {
  "use strict";

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var RUOLI = function () { return root.TraEngine.RUOLI; };

  /* Linea del tra: la distanza resa visibile sul segmento fra i due capi.    */
  function lineaDelTra(r) {
    var W = 300, H = 84, pad = 26, y = 46;
    var xDist = pad + (W - 2 * pad) * r.distanza;
    var punti = r.termini.map(function (t) {
      var x = pad + (W - 2 * pad) * t.d;
      return '<g><circle cx="' + x + '" cy="' + y + '" r="5" class="tra-punto' + (t.ribaltamento ? " tra-ribalta" : "") + '"></circle>' +
        '<text x="' + x + '" y="' + (y - 10) + '" class="tra-term">' + esc(t.citazione) + "</text>" +
        (t.ribaltamento ? '<text x="' + x + '" y="' + (y + 21) + '" class="tra-glifo">\u21C5</text>' : "") + "</g>";
    }).join("");
    var lm = RUOLI()[r.ruoloMittente].label, ld = RUOLI()[r.ruoloDestinatario].label;
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="tra-svg" role="img" aria-label="Distanza cognitiva stimata fra i due ruoli">' +
      '<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" class="tra-linea"></line>' +
      '<line x1="' + pad + '" y1="' + y + '" x2="' + xDist + '" y2="' + y + '" class="tra-linea-mis"></line>' +
      '<circle cx="' + pad + '" cy="' + y + '" r="4" class="tra-capo"></circle>' +
      '<circle cx="' + (W - pad) + '" cy="' + y + '" r="4" class="tra-capo"></circle>' +
      '<text x="' + pad + '" y="' + (y + 24) + '" class="tra-ruolo" text-anchor="start">' + esc(lm) + "</text>" +
      '<text x="' + (W - pad) + '" y="' + (y + 24) + '" class="tra-ruolo" text-anchor="end">' + esc(ld) + "</text>" +
      punti + "</svg>";
  }

  function bloccoNota(testo, origine) {
    var eyebrow = origine === "libro" ? "Riferimento dal libro (Appendice C) — benchmark, non generato"
                : origine === "fallback" ? "Composizione locale (offline) — calibrata sulla distanza, non dal libro"
                : origine === "llm" ? "Risposta del modello, resa in tipografia del libro"
                : "In coda al messaggio, una riga rivolta a chi legge";
    var b = el("div", "nota-libro");
    b.appendChild(el("div", "nota-eyebrow", eyebrow));
    b.appendChild(el("div", "nota-testo", esc(testo)));
    return b;
  }

  function render(container, r, adapter) {
    container.innerHTML = "";

    var head = el("div", "pane-head");
    head.appendChild(el("div", "pane-titolo", "Lo strumento"));
    head.appendChild(el("div", "pane-sotto", "Misura la distanza fra due letture di ruolo \u00B7 modello " + esc(r.modelloDistanza)));
    container.appendChild(head);

    if (!r.coppiaDichiarata) {
      var avv = el("div", "pane-vuoto");
      avv.appendChild(el("div", "pane-vuoto-titolo", "Ruoli non dichiarati"));
      avv.appendChild(el("div", "pane-motivo", "Lo strumento non stima letture su ruoli inferiti: M1 opera solo su ruoli dichiarati. Dichiara i ruoli per procedere."));
      container.appendChild(avv);
      return;
    }

    /* Distanza misurata */
    var boxTra = el("div", "pane-tra");
    if (r.termini.length) boxTra.innerHTML = lineaDelTra(r);
    var bandaCls = "banda-" + r.banda;
    boxTra.appendChild(el("div", "pane-misura " + bandaCls,
      'distanza cognitiva <strong>' + r.distanza.toFixed(2) + "</strong> / 1 \u00B7 banda <strong>" + esc(r.banda) + "</strong>" +
      (r.ribaltamenti ? " \u00B7 " + r.ribaltamenti + (r.ribaltamenti === 1 ? " termine si ribalta" : " termini si ribaltano") : "")));
    container.appendChild(boxTra);

    /* Termini: doppia lettura */
    if (r.termini.length) {
      var lista = el("div", "pane-termini");
      r.termini.forEach(function (t) {
        var card = el("div", "termine" + (t.ribaltamento ? " termine-ribalta" : ""));
        card.appendChild(el("div", "termine-nome", "\u201C" + esc(t.citazione) + "\u201D" + (t.ribaltamento ? ' <span class="glifo" title="le letture si ribaltano">\u21C5</span>' : "") + ' <span class="termine-d">d ' + t.d.toFixed(2) + "</span>"));
        var due = el("div", "termine-letture");
        due.appendChild(el("div", "lettura-riga", '<span class="lettura-chi">' + esc(RUOLI()[r.ruoloMittente].label) + "</span>" + esc(t.letturaMittente)));
        due.appendChild(el("div", "lettura-riga", '<span class="lettura-chi">' + esc(RUOLI()[r.ruoloDestinatario].label) + "</span>" + esc(t.letturaDestinatario)));
        card.appendChild(due);
        lista.appendChild(card);
      });
      container.appendChild(lista);
    }

    if (r.amplificatori.length) container.appendChild(el("div", "pane-riga", "Rilevato: " + r.amplificatori.map(function (a) { return esc(a.descrizione); }).join("; ") + "."));
    if (r.contesto) container.appendChild(el("div", "pane-riga pane-contesto", "Contesto dichiarato: " + esc(r.contesto.etichetta) + ' <span class="rif">' + esc(r.contesto.riferimento) + "</span>"));

    /* Nessun prompt: distanza bassa o nessun termine */
    if (!r.prompt) {
      var vuoto = el("div", "pane-vuoto");
      vuoto.appendChild(el("div", "pane-vuoto-titolo", r.termini.length ? "Letture concordanti" : "Nessun termine del corpus rilevato"));
      vuoto.appendChild(el("div", "pane-motivo", r.termini.length
        ? "La stessa parola attiva la stessa lettura nei due ruoli: la distanza \u00E8 bassa. Il rischio non \u00E8 nella parola."
        : "Nessun ancoraggio noto in questo testo. L'insieme resta aperto: uno stimatore semantico potrebbe proporne altri."));
      container.appendChild(vuoto);
      return;
    }

    /* ---- Interrogatore: il prompt generato, tarato sulla distanza ---- */
    var inter = el("div", "pane-interrogatore");
    inter.appendChild(el("div", "inter-eyebrow", "La domanda non \u00E8 nel software. Lo strumento prepara la richiesta, tarata sulla distanza (banda \u201C" + esc(r.prompt.banda) + "\u201D):"));

    var pre = el("pre", "inter-prompt");
    pre.textContent = r.prompt.testo;
    inter.appendChild(pre);

    var barra = el("div", "inter-barra");
    var bCopia = el("button", "btn btn-quieto", "Copia il prompt");
    bCopia.onclick = function () {
      var done = function () { bCopia.textContent = "Prompt copiato"; setTimeout(function () { bCopia.textContent = "Copia il prompt"; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.prompt.testo).then(done, done);
      else { pre.focus(); done(); }
      adapter.log({ evento: "prompt_copiato", banda: r.prompt.banda });
    };
    barra.appendChild(bCopia);

    if (adapter.apiConfig && adapter.apiConfig.endpoint) {
      var bApi = el("button", "btn btn-primario", "Genera con l'endpoint");
      bApi.onclick = function () {
        bApi.disabled = true; bApi.textContent = "Generazione\u2026";
        root.TraEngine.chiamaApi(r.prompt, adapter.apiConfig).then(function (txt) {
          mostraGenerata(txt, "llm");
          bApi.disabled = false; bApi.textContent = "Genera con l'endpoint";
          adapter.log({ evento: "api_ok", banda: r.prompt.banda });
        }, function (err) {
          esitoGen.innerHTML = ""; esitoGen.appendChild(el("div", "inter-errore", "Endpoint non raggiungibile: " + esc(err.message) + ". Usa la modalit\u00E0 copia-incolla."));
          bApi.disabled = false; bApi.textContent = "Genera con l'endpoint";
          adapter.log({ evento: "api_errore" });
        });
      };
      barra.appendChild(bApi);
    }
    inter.appendChild(barra);

    /* Incolla la risposta del modello */
    var incolla = el("div", "inter-incolla");
    incolla.appendChild(el("label", "inter-label", "Incolla qui la risposta del modello (verr\u00E0 resa in tipografia del libro e apposta in coda):"));
    var ta = el("textarea", "inter-textarea");
    ta.setAttribute("rows", "3");
    ta.setAttribute("placeholder", "Incolla la nota generata dal modello\u2026");
    incolla.appendChild(ta);
    var bUsa = el("button", "btn btn-primario", "Usa questa nota");
    bUsa.onclick = function () {
      var v = ta.value.trim();
      if (v) { mostraGenerata(v, "llm"); adapter.log({ evento: "risposta_incollata" }); }
    };
    incolla.appendChild(bUsa);
    inter.appendChild(incolla);
    container.appendChild(inter);

    /* Esito generato + fallback + benchmark */
    var esitoGen = el("div", "pane-esito");
    container.appendChild(esitoGen);

    function mostraGenerata(testo, origine) {
      esitoGen.innerHTML = "";
      esitoGen.appendChild(bloccoNota(testo, origine));
      var az = el("div", "pane-azioni");
      if (adapter.capacita.appendNote) {
        var bApp = el("button", "btn btn-primario", "Apponi in coda al messaggio");
        bApp.onclick = function () {
          adapter.appendNote(testo);
          if (adapter.capacita.banner) adapter.banner("Nota dello strumento apposta in coda al messaggio.");
          bApp.disabled = true; bApp.textContent = "Nota apposta in coda";
          adapter.log({ evento: "nota_apposta", origine: origine });
        };
        az.appendChild(bApp);
      }
      var fb = el("div", "pane-feedback");
      fb.appendChild(el("span", "fb-label", "Per chi legge, la nota \u00E8:"));
      ["pertinente", "non pertinente"].forEach(function (val) {
        var b = el("button", "btn btn-quieto", val);
        b.onclick = function () { adapter.log({ evento: "feedback", valore: val, origine: origine }); fb.innerHTML = '<span class="fb-label">Registrato: nota giudicata ' + esc(val) + ". Il giudizio resta a chi legge.</span>"; };
        fb.appendChild(b);
      });
      az.appendChild(fb);
      esitoGen.appendChild(az);
    }

    /* Riga di servizio: fallback locale + benchmark dal libro (disclosure) */
    var servizio = el("div", "pane-servizio");
    if (r.fallback) {
      var bFall = el("button", "btn btn-testo", "Nessun modello a portata? Componi una nota in locale");
      bFall.onclick = function () { mostraGenerata(r.fallback.testo, "fallback"); adapter.log({ evento: "fallback_usato" }); };
      servizio.appendChild(bFall);
    }
    if (r.riferimentoLibro) {
      var det = el("details", "pane-benchmark");
      var sum = el("summary", null, "Confronta con la nota del libro (benchmark)");
      det.appendChild(sum);
      det.appendChild(bloccoNota(r.riferimentoLibro, "libro"));
      servizio.appendChild(det);
    }
    container.appendChild(servizio);

    container.appendChild(el("div", "pane-piede",
      "Lo strumento non riscrive, non blocca, non decide. Misura la distanza in locale; i ruoli sono dichiarati, mai inferiti; la domanda \u00E8 generata, non cablata."));
  }

  root.PaneUI = { render: render, bloccoNota: bloccoNota };
})(typeof window !== "undefined" ? window : globalThis);
