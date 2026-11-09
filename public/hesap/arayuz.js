/* Hesaplayıcı sayfalarının ortak arayüz yardımcıları. */
(function () {
  "use strict";
  const V = window.Vadelio;

  // Mağaza bağlantıları: uygulama yayına girince yalnızca burayı doldurun.
  const MAGAZA = {
    play: "https://play.google.com/store/apps/details?id=com.mahsunse.kredifinansmanhesaplama",
    appStore: "https://apps.apple.com/tr/app/vadelio-kredi-%C3%A7ek-hesaplama/id6828172101",
  };

  const SIMGE = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1Zm11.3 11.3 2.6 2.6-11.9 6.8 9.3-9.4Zm3.9-3.9 2.7 1.6c.8.5.8 1.7 0 2.2l-2.7 1.6-2.9-2.6 2.9-2.8ZM5.6 1.5l11.9 6.8-2.6 2.6-9.3-9.4Z"/></svg>',
    appStore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9-1.7 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.3-.9-2.3-3.7ZM14 5.2c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4Z"/></svg>',
  };

  function magazaDugmeleri(kap) {
    kap.innerHTML = "";
    for (const [anahtar, ad] of [["play", "Google Play"], ["appStore", "App Store"]]) {
      const a = document.createElement("a");
      a.className = "store";
      const url = MAGAZA[anahtar];
      if (url) {
        a.href = url;
        a.rel = "noopener";
      } else {
        a.href = "/";
        a.setAttribute("aria-disabled", "true");
        a.addEventListener("click", (e) => e.preventDefault());
      }
      a.innerHTML = SIMGE[anahtar] + "<span><small>" + (url ? "İndir" : "Yakında") + "</small>" + ad + "</span>";
      kap.appendChild(a);
    }
  }

  /** "100.000" → 100000; boşsa null. */
  function tutarOku(metin) {
    const r = String(metin).replace(/\D/g, "");
    return r ? Number(r) : null;
  }
  /** "3,5" ya da "3.5" → 3.5; boşsa null. */
  function oranOku(metin) {
    const t = String(metin).trim().replace(",", ".");
    if (!t || t === ".") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  /** Tutar alanını yazarken binlik ayraçla biçimler, imleci korur. */
  function tutarAlani(input, onChange) {
    input.addEventListener("input", () => {
      const imlec = input.selectionStart ?? input.value.length;
      const oncekiRakam = input.value.slice(0, imlec).replace(/\D/g, "").length;
      const rakamlar = input.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 12);
      input.value = V.binlikAyir(rakamlar);
      let yeni = 0, sayac = 0;
      while (yeni < input.value.length && sayac < oncekiRakam) {
        if (/\d/.test(input.value[yeni])) sayac++;
        yeni++;
      }
      try { input.setSelectionRange(yeni, yeni); } catch (e) { /* bazı türlerde yok */ }
      onChange();
    });
  }
  /** Oran alanı: rakam ve tek ondalık ayracı, en fazla 2 ondalık. */
  function oranAlani(input, onChange) {
    input.addEventListener("input", () => {
      let t = input.value.replace(/\./g, ",").replace(/[^\d,]/g, "");
      const i = t.indexOf(",");
      if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/,/g, "").slice(0, 2);
      if (t !== input.value) input.value = t;
      onChange();
    });
  }
  function tamSayiAlani(input, enFazlaHane, onChange) {
    input.addEventListener("input", () => {
      const t = input.value.replace(/\D/g, "").slice(0, enFazlaHane);
      if (t !== input.value) input.value = t;
      onChange();
    });
  }

  function bugun() {
    const n = new Date();
    return V.utc(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }
  function tarihDegeri(t) {
    return t.toISOString().slice(0, 10);
  }
  function tarihOku(deger) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deger || "");
    return m ? V.utc(+m[1], +m[2], +m[3]) : null;
  }

  /** TCMB referans oranları: önce son kayıt, sonra güncel dosya. */
  function referansYukle(geriCagir) {
    const ANAHTAR = "vadelio-referans";
    try {
      const k = localStorage.getItem(ANAHTAR);
      if (k) geriCagir(V.referansCoz(JSON.parse(k)));
    } catch (e) { /* depolama kapalı olabilir */ }
    const kontrol = typeof AbortController !== "undefined" ? new AbortController() : null;
    const zaman = setTimeout(() => kontrol && kontrol.abort(), 12000);
    fetch(V.REFERANS_ADRESI, { cache: "no-cache", signal: kontrol ? kontrol.signal : undefined })
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((metin) => {
        geriCagir(V.referansCoz(JSON.parse(metin)));
        try { localStorage.setItem(ANAHTAR, metin); } catch (e) { /* yok say */ }
      })
      .catch(() => { /* çevrimdışı: son bilinen değerler kalır */ })
      .finally(() => clearTimeout(zaman));
  }

  function el(etiket, sinif, metin) {
    const e = document.createElement(etiket);
    if (sinif) e.className = sinif;
    if (metin != null) e.textContent = metin;
    return e;
  }
  function bilgiSatiri(etiket, deger, { vurgu = false, nokta = null } = {}) {
    const d = el("div", "bilgi" + (vurgu ? " vurgu" : ""));
    const s = el("span");
    if (nokta) {
      const n = el("i", "nokta");
      n.style.background = nokta;
      s.appendChild(n);
    }
    s.appendChild(document.createTextNode(etiket));
    d.appendChild(s);
    d.appendChild(el("span", null, deger));
    return d;
  }

  window.VadelioArayuz = {
    MAGAZA, magazaDugmeleri, tutarOku, oranOku, tutarAlani, oranAlani, tamSayiAlani,
    bugun, tarihDegeri, tarihOku, referansYukle, el, bilgiSatiri,
  };
  document.querySelectorAll("[data-magaza]").forEach(magazaDugmeleri);
})();
