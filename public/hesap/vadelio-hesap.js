/*
 * Vadelio hesaplama çekirdeği (web).
 * Uygulamadaki Dart kodunun birebir karşılığıdır:
 *   lib/plan.dart (KrediPlani.hesapla), lib/tarih.dart, lib/mevduat.dart,
 *   lib/referans_oranlar.dart.
 * Kural değişirse önce uygulamada, sonra burada güncelleyin; tests/ altındaki
 * karşılaştırma testi iki tarafın aynı sonucu verdiğini denetler.
 */
(function (kok) {
  "use strict";

  const GUN_MS = 86400000;

  // ---------- Yuvarlama (Dart'taki round(): yarımda sıfırdan uzağa) ----------
  function dartRound(x) {
    return x < 0 ? -Math.round(-x) : Math.round(x);
  }
  function kurus(x) {
    return dartRound((x + 1e-9) * 100) / 100;
  }

  // ---------- Tarih (lib/tarih.dart) ----------
  // Tüm tarihler UTC gece yarısı Date nesneleridir.
  function utc(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d));
  }
  function gunTarihi(t) {
    return utc(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function gunEkle(t, gun) {
    return new Date(t.getTime() + gun * GUN_MS);
  }
  function gunFarki(bas, son) {
    return Math.round((son.getTime() - bas.getTime()) / GUN_MS);
  }
  function ayEkle(t, ay, gun) {
    const toplamAy = t.getUTCMonth() + ay;
    const yil = t.getUTCFullYear() + Math.floor(toplamAy / 12);
    const yeniAy = (((toplamAy % 12) + 12) % 12) + 1;
    const sonGun = new Date(Date.UTC(yil, yeniAy, 0)).getUTCDate();
    const g = gun == null ? t.getUTCDate() : gun;
    return utc(yil, yeniAy, g > sonGun ? sonGun : g);
  }
  function ayFarki(bas, son) {
    let fark =
      (son.getUTCFullYear() - bas.getUTCFullYear()) * 12 +
      son.getUTCMonth() -
      bas.getUTCMonth();
    if (son.getUTCDate() < bas.getUTCDate()) fark--;
    return fark;
  }

  const SABIT_TATILLER = new Set([
    "1-1", // Yılbaşı
    "4-23", // Ulusal Egemenlik ve Çocuk Bayramı
    "5-1", // Emek ve Dayanışma Günü
    "5-19", // Atatürk'ü Anma, Gençlik ve Spor Bayramı
    "7-15", // Demokrasi ve Millî Birlik Günü
    "8-30", // Zafer Bayramı
    "10-29", // Cumhuriyet Bayramı
  ]);

  // Ramazan ve Kurban Bayramı günleri (arife hariç); uygulamayla aynı liste.
  const DINI_BAYRAMLAR = new Set();
  [
    [2026, 3, 20, 3], [2026, 5, 27, 4],
    [2027, 3, 9, 3], [2027, 5, 16, 4],
    [2028, 2, 26, 3], [2028, 5, 4, 4],
    [2029, 2, 14, 3], [2029, 4, 23, 4],
    [2030, 2, 4, 3], [2030, 4, 13, 4],
  ].forEach(([y, m, d, n]) => {
    for (let i = 0; i < n; i++) DINI_BAYRAMLAR.add(utc(y, m, d + i).getTime());
  });

  function isGunuMu(t) {
    const hg = t.getUTCDay();
    if (hg === 0 || hg === 6) return false;
    if (SABIT_TATILLER.has(t.getUTCMonth() + 1 + "-" + t.getUTCDate())) return false;
    return !DINI_BAYRAMLAR.has(gunTarihi(t).getTime());
  }
  function sonrakiIsGunu(t) {
    let g = gunTarihi(t);
    while (!isGunuMu(g)) g = gunEkle(g, 1);
    return g;
  }

  // ---------- Kredi (lib/plan.dart) ----------
  const MAKSIMUM_VADE = 360;
  const KREDI_TURLERI = ["Bireysel Kredi", "Konut Kredisi", "Taşıt Kredisi", "Ticari Kredi"];

  /** KKDF ve BSMV oranları. */
  function vergiOranlari(tur) {
    switch (tur) {
      case "Bireysel Kredi":
      case "Taşıt Kredisi":
        return [0.15, 0.15];
      case "Ticari Kredi":
        return [0.0, 0.05];
      default:
        return [0.0, 0.0];
    }
  }

  /**
   * Ticari kredide kâr payı gerçek gün sayısıyla işler. Bireysel, konut ve
   * taşıt kredisinde klasik eşit taksit geçerlidir: her ay 30 gün sayılır.
   */
  function gunSayiliTur(tur) {
    return tur === "Ticari Kredi";
  }

  /** Klasik yöntemde ilk dönem: her tam ay 30 gün, artan günler olduğu gibi. */
  function ilkDonemGunu(fin, ilk) {
    let ay = ayFarki(fin, ilk);
    if (ayEkle(fin, ay + 1).getTime() === ilk.getTime()) ay++;
    return 30 * ay + gunFarki(ayEkle(fin, ay), ilk);
  }

  /**
   * Eşit taksitli geri ödeme planı (KrediPlani.hesapla).
   * finansmanTarihi verilmezse her ay 30 gün sayılır.
   */
  function krediHesapla({ tur, tutar, oranYuzde, vade, odemesiz = 0, finansmanTarihi = null, ilkTaksitTarihi = null }) {
    const [kkdf, bsmv] = vergiOranlari(tur);
    const vergiCarpani = 1 + kkdf + bsmv;
    const gunlukOran = oranYuzde / 100 / 30;

    const tarihler = [];
    const gunler = [];
    let odemesizGun = 30 * odemesiz;
    let ilkNominal = null;
    if (finansmanTarihi == null) {
      for (let i = 0; i < vade; i++) {
        tarihler.push(null);
        gunler.push(i === 0 ? 30 * (odemesiz + 1) : 30);
      }
    } else {
      const fin = gunTarihi(finansmanTarihi);
      const ilk = gunTarihi(ilkTaksitTarihi || ayEkle(fin, odemesiz + 1));
      ilkNominal = ilk;
      odemesiz = Math.max(0, ayFarki(fin, ilk) - 1);
      odemesizGun = Math.max(0, gunFarki(ayEkle(fin, 1), ilk));
      let onceki = fin;
      for (let i = 0; i < vade; i++) {
        const t = sonrakiIsGunu(ayEkle(ilk, i, ilk.getUTCDate()));
        tarihler.push(t);
        gunler.push(gunSayiliTur(tur) ? gunFarki(onceki, t) : i === 0 ? ilkDonemGunu(fin, ilk) : 30);
        onceki = t;
      }
    }

    function planla(taksit, satirlar) {
      let anaparaBakiye = tutar, birikenKar = 0;
      for (let i = 0; i < vade; i++) {
        birikenKar = kurus(birikenKar + anaparaBakiye * gunlukOran * gunler[i]);
        const sonTaksit = satirlar != null && i === vade - 1;
        let kar, vergi, anapara, odenen = taksit;
        if (sonTaksit || taksit >= kurus(birikenKar * vergiCarpani)) {
          kar = birikenKar;
          vergi = kurus(kar * kkdf) + kurus(kar * bsmv);
          anapara = sonTaksit ? anaparaBakiye : kurus(taksit - kar - vergi);
          if (sonTaksit) odenen = kurus(anapara + kar + vergi);
          birikenKar = 0;
        } else {
          kar = kurus(taksit / vergiCarpani);
          vergi = kurus(taksit - kar);
          anapara = 0;
          birikenKar = kurus(birikenKar - kar);
        }
        anaparaBakiye = kurus(anaparaBakiye - anapara);
        if (satirlar) {
          satirlar.push({
            no: i + 1,
            taksit: odenen,
            anapara,
            karPayi: kar,
            vergi,
            kalan: kurus(anaparaBakiye + birikenKar),
            kalanKar: birikenKar,
            tarih: tarihler[i],
            gun: gunler[i],
          });
        }
      }
      return anaparaBakiye;
    }

    let alt = 0;
    let ust = Math.ceil(tutar * (1 + vergiCarpani * gunlukOran * 30 * (odemesiz + vade)) * 100);
    while (ust - alt > 1) {
      const orta = Math.floor((alt + ust) / 2);
      if (planla(orta / 100) > 0) alt = orta;
      else ust = orta;
    }
    const taksit = planla(ust / 100) === 0 ? ust / 100 : (ust - 1) / 100;
    const satirlar = [];
    planla(taksit, satirlar);

    const topla = (f) => kurus(satirlar.reduce((a, s) => a + f(s), 0));
    const toplam = topla((s) => s.taksit);

    const plan = {
      tur, tutar, oranYuzde, vade, odemesizGun, kkdf, bsmv, taksit, satirlar,
      toplam,
      netKarPayi: topla((s) => s.karPayi),
      vergi: topla((s) => s.vergi),
      finansmanTarihi: finansmanTarihi == null ? null : gunTarihi(finansmanTarihi),
      ilkTaksitNominal: ilkNominal,
      ilkTaksitTarihi: satirlar[0].tarih,
      sonTaksitTarihi: satirlar[satirlar.length - 1].tarih,
      toplamMaliyet: kurus(toplam - tutar),
      yillikKarPayiOrani: Math.pow(1 + oranYuzde / 100, 12) - 1,
    };
    plan.yillikMaliyetOrani = yillikMaliyetOrani(plan);
    plan.ortalamaVadeGun = ortalamaVadeGun(plan);
    return plan;
  }

  function yillikMaliyetOrani(plan) {
    function bugunkuDeger(m) {
      let t = 0, gecen = 0;
      for (const s of plan.satirlar) {
        gecen += s.gun;
        t += s.taksit / Math.pow(1 + m, gecen / 30);
      }
      return t;
    }
    if (bugunkuDeger(0) <= plan.tutar) return 0;
    let alt = 0, ust = 1;
    for (let i = 0; i < 100; i++) {
      const orta = (alt + ust) / 2;
      if (bugunkuDeger(orta) > plan.tutar) alt = orta;
      else ust = orta;
    }
    return Math.pow(1 + alt, 12) - 1;
  }

  function ortalamaVadeGun(plan) {
    let agirlikli = 0, toplamAnapara = 0, gecen = 0;
    for (const s of plan.satirlar) {
      gecen += s.gun;
      agirlikli += s.anapara * gecen;
      toplamAnapara += s.anapara;
    }
    return dartRound(agirlikli / toplamAnapara);
  }

  // ---------- Mevduat (lib/mevduat.dart) ----------
  function mevduatHesapla({ anapara, yillikOranYuzde, stopajYuzde, baslangic, gun }) {
    const bas = gunTarihi(baslangic);
    const vadeSonu = gunEkle(bas, gun);
    const brutGetiri = kurus((((anapara * yillikOranYuzde) / 100) * gun) / 365);
    const stopaj = kurus((brutGetiri * stopajYuzde) / 100);
    const netGetiri = kurus(brutGetiri - stopaj);
    return {
      anapara, yillikOranYuzde, stopajYuzde, baslangic: bas, vadeSonu, gun,
      brutGetiri, stopaj, netGetiri,
      vadeSonuTutar: kurus(anapara + netGetiri),
      netYillikOran: anapara === 0 || gun === 0 ? 0 : ((netGetiri / anapara) * 365) / gun,
      yenilemeliYillikOran: gun === 0 ? 0 : Math.pow(1 + netGetiri / anapara, 365 / gun) - 1,
      yenilemeliTutar: (donem) => kurus(anapara * Math.pow(1 + netGetiri / anapara, donem)),
    };
  }

  // 11444 sayılı Cumhurbaşkanı Kararı (RG 20.06.2026) ile 31.12.2026'ya uzatıldı.
  const YASAL_STOPAJ_KAYNAGI = "11444 sayılı Cumhurbaşkanı Kararı";
  const YASAL_STOPAJ_GECERLILIK = utc(2026, 12, 31);

  function yasalStopaj(baslangic, vadeSonu) {
    const b = gunTarihi(baslangic), v = gunTarihi(vadeSonu);
    if (v.getTime() <= ayEkle(b, 6).getTime()) return { oranYuzde: 17.5, vadeAraligi: "6 aya kadar" };
    if (v.getTime() <= ayEkle(b, 12).getTime()) return { oranYuzde: 15, vadeAraligi: "1 yıla kadar" };
    return { oranYuzde: 10, vadeAraligi: "1 yıldan uzun" };
  }
  function yasalStopajGecerli(baslangic) {
    return gunTarihi(baslangic).getTime() <= YASAL_STOPAJ_GECERLILIK.getTime();
  }

  // ---------- Referans oranlar (lib/referans_oranlar.dart) ----------
  const REFERANS_ADRESI = "https://mahsunse-maker.github.io/kredi-finansman-gizlilik-politikasi/oranlar.json";
  const KREDI_ANAHTARI = {
    "Bireysel Kredi": "ihtiyac",
    "Konut Kredisi": "konut",
    "Taşıt Kredisi": "tasit",
    "Ticari Kredi": "ticari",
  };

  function referansTarih(t) {
    const m = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(String(t));
    return m ? utc(+m[3], +m[2], +m[1]) : null;
  }
  function referansBolum(b) {
    const sonuc = {};
    if (b && typeof b === "object") {
      for (const [k, v] of Object.entries(b)) {
        if (v && typeof v.oran === "number") sonuc[k] = { yillik: v.oran, tarih: referansTarih(v.tarih) };
      }
    }
    return sonuc;
  }
  function referansCoz(json) {
    return { kredi: referansBolum(json.kredi), mevduat: referansBolum(json.mevduat) };
  }
  /** Kredi türünün piyasa ortalaması: efektif yıllık oranın aylık karşılığı. */
  function referansKredi(ref, tur) {
    const r = ref && ref.kredi[KREDI_ANAHTARI[tur]];
    if (!r) return null;
    return { aylik: (Math.pow(1 + r.yillik / 100, 1 / 12) - 1) * 100, yillik: r.yillik, tarih: r.tarih };
  }
  /** Vade dilimine göre mevduat ortalaması, basit yıllık karşılığı. */
  function referansMevduat(ref, gun) {
    if (!ref || !(gun > 0)) return null;
    const dilim = gun <= 31 ? "1ay" : gun <= 92 ? "3ay" : gun <= 183 ? "6ay" : gun <= 366 ? "1yil" : "1yiluzun";
    const r = ref.mevduat[dilim];
    if (!r) return null;
    const basit = ((Math.pow(1 + r.yillik / 100, gun / 365) - 1) * 365) / gun * 100;
    return { basit, bilesik: r.yillik, tarih: r.tarih };
  }

  // ---------- Biçimleme ----------
  function binlikAyir(rakamlar) {
    let s = "";
    for (let i = 0; i < rakamlar.length; i++) {
      if (i > 0 && (rakamlar.length - i) % 3 === 0) s += ".";
      s += rakamlar[i];
    }
    return s;
  }
  function paraFormat(d, ondalik = 0, birim = true) {
    const [h, k] = Math.abs(d).toFixed(ondalik).split(".");
    const isaret = d < 0 && Math.abs(d) >= 0.5 / Math.pow(10, ondalik) ? "-" : "";
    const govde = isaret + binlikAyir(h) + (ondalik > 0 ? "," + k : "");
    return birim ? govde + " TL" : govde;
  }
  function yuzdeFormat(oran, ondalik = 2) {
    return "%" + (oran * 100).toFixed(ondalik).replace(".", ",");
  }
  function oranYaz(oran) {
    return oran.toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
  }
  function tarihFormat(t) {
    const iki = (n) => String(n).padStart(2, "0");
    return iki(t.getUTCDate()) + "." + iki(t.getUTCMonth() + 1) + "." + t.getUTCFullYear();
  }

  const V = {
    kurus, utc, gunTarihi, gunEkle, gunFarki, ayEkle, ayFarki, isGunuMu, sonrakiIsGunu,
    MAKSIMUM_VADE, KREDI_TURLERI, vergiOranlari, gunSayiliTur, krediHesapla,
    mevduatHesapla, yasalStopaj, yasalStopajGecerli, YASAL_STOPAJ_KAYNAGI, YASAL_STOPAJ_GECERLILIK,
    REFERANS_ADRESI, referansCoz, referansKredi, referansMevduat,
    binlikAyir, paraFormat, yuzdeFormat, oranYaz, tarihFormat,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = V;
  else kok.Vadelio = V;
})(typeof self !== "undefined" ? self : this);
