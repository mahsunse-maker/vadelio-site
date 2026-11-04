// Uygulamanın Dart testlerindeki (test/plan_test.dart, test/mevduat_test.dart)
// örneklerin web çekirdeğinde de aynı çıktığını denetler.
// Çalıştırma: node --test tests/hesap.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../public/hesap/vadelio-hesap.js");

const hesapla = ({ tur = "Konut Kredisi", tutar = 100000, oran = 2, vade = 12, odemesiz = 0, finansman = null, ilkTaksit = null } = {}) =>
  V.krediHesapla({ tur, tutar, oranYuzde: oran, vade, odemesiz, finansmanTarihi: finansman, ilkTaksitTarihi: ilkTaksit });
const yakin = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b} (±${tol})`);
const topla = (d) => d.reduce((a, b) => a + b, 0);

test("30 günlük ay: standart, vergili ve sıfır oranlı taksit", () => {
  yakin(hesapla().taksit, 9455.96, 0.01);
  const b = hesapla({ tur: "Bireysel Kredi", oran: 3.5 });
  assert.equal(b.taksit, 10998.0);
  yakin(b.vergi, b.netKarPayi * 0.3, 0.05);
  const s = hesapla({ oran: 0, vade: 10 });
  assert.equal(s.taksit, 10000);
  assert.equal(s.toplam, 100000);
});

test("ödemesiz dönem kâr payı ilk taksitten tahsil edilir", () => {
  const p = hesapla({ tur: "Bireysel Kredi", vade: 12, odemesiz: 3 });
  assert.equal(p.satirlar.length, 12);
  assert.equal(p.satirlar[0].gun, 120);
  assert.equal(p.odemesizGun, 90);
  yakin(p.satirlar[0].karPayi, 100000 * 0.02 * 4, 0.01);
  yakin(topla(p.satirlar.map((s) => s.anapara)), p.tutar, 0.01);
  assert.equal(hesapla({ oran: 0, vade: 3, odemesiz: 2 }).ortalamaVadeGun, 120);
});

test("katılım bankası planıyla kuruşu kuruşuna aynıdır", () => {
  const banka = hesapla({ tur: "Ticari Kredi", tutar: 1000000, oran: 4, vade: 12, odemesiz: 3, finansman: V.utc(2026, 10, 28) });
  assert.deepEqual(banka.satirlar.map((s) => V.tarihFormat(s.tarih)), [
    "01.03.2027", "29.03.2027", "28.04.2027", "28.05.2027", "28.06.2027", "28.07.2027",
    "31.08.2027", "28.09.2027", "28.10.2027", "29.11.2027", "28.12.2027", "28.01.2028",
  ]);
  assert.deepEqual(banka.satirlar.map((s) => s.gun), [124, 28, 30, 30, 31, 30, 34, 28, 30, 32, 29, 31]);
  assert.equal(banka.odemesizGun, 92);
  assert.equal(banka.taksit, 121232.22);
  assert.equal(banka.satirlar[11].taksit, 121232.34);
  assert.equal(banka.toplam, 1454786.76);
  assert.equal(banka.netKarPayi, 433130.25);
  assert.equal(banka.vergi, 21656.51);
  assert.deepEqual(banka.satirlar.map((s) => s.anapara), [
    0.0, 29664.45, 80478.13, 83858.2, 86251.86, 91002.84,
    91303.99, 100164.55, 102866.63, 106250.68, 111968.97, 116189.7,
  ]);
  assert.deepEqual(banka.satirlar.map((s) => s.karPayi), [
    115459.26, 87207.4, 38813.42, 35594.3, 33314.63, 28789.89,
    28503.08, 20064.45, 17491.04, 14268.13, 8822.14, 4802.51,
  ]);
  assert.deepEqual(banka.satirlar.map((s) => s.vergi), [
    5772.96, 4360.37, 1940.67, 1779.72, 1665.73, 1439.49,
    1425.15, 1003.22, 874.55, 713.41, 441.11, 240.13,
  ]);
  assert.deepEqual(banka.satirlar.map((s) => s.kalan), [
    1049874.07, 970335.55, 889857.42, 805999.22, 719747.36, 628744.52,
    537440.53, 437275.98, 334409.35, 228158.67, 116189.7, 0.0,
  ]);
});

test("ilk taksit tarihi elle seçilebilir", () => {
  const p = hesapla({ vade: 6, finansman: V.utc(2026, 10, 28), ilkTaksit: V.utc(2026, 12, 15) });
  assert.equal(V.tarihFormat(p.ilkTaksitTarihi), "15.12.2026");
  assert.equal(p.satirlar[0].gun, 48);
  assert.equal(p.odemesizGun, 17);
  const q = hesapla({ vade: 6, finansman: V.utc(2026, 10, 28), ilkTaksit: V.utc(2026, 11, 20) });
  assert.equal(q.odemesizGun, 0);
  assert.equal(q.satirlar[0].gun, 23);
});

test("yıllık oranlar", () => {
  const p = hesapla();
  yakin(p.yillikKarPayiOrani, 0.26824, 0.00001);
  yakin(p.yillikMaliyetOrani, p.yillikKarPayiOrani, 0.0005);
  assert.ok(hesapla({ tur: "Bireysel Kredi" }).yillikMaliyetOrani > hesapla({ tur: "Bireysel Kredi" }).yillikKarPayiOrani + 0.05);
  assert.equal(hesapla({ oran: 0 }).yillikMaliyetOrani, 0);
});

test("tarih yardımcıları", () => {
  assert.equal(V.tarihFormat(V.ayEkle(V.utc(2027, 1, 31), 1)), "28.02.2027");
  assert.equal(V.tarihFormat(V.ayEkle(V.utc(2028, 1, 31), 1)), "29.02.2028");
  assert.equal(V.tarihFormat(V.ayEkle(V.utc(2027, 11, 15), 3)), "15.02.2028");
  assert.equal(V.isGunuMu(V.utc(2027, 10, 29)), false);
  assert.equal(V.isGunuMu(V.utc(2027, 3, 1)), true);
  assert.equal(V.tarihFormat(V.sonrakiIsGunu(V.utc(2027, 2, 28))), "01.03.2027");
});

test("mevduat getirisi ve yasal stopaj", () => {
  const m = V.mevduatHesapla({ anapara: 100000, yillikOranYuzde: 40, stopajYuzde: 15, baslangic: V.utc(2026, 10, 28), gun: 32 });
  assert.equal(m.brutGetiri, 3506.85);
  assert.equal(m.stopaj, 526.03);
  assert.equal(m.netGetiri, 2980.82);
  assert.equal(m.vadeSonuTutar, 102980.82);
  assert.equal(V.tarihFormat(m.vadeSonu), "29.11.2026");
  yakin(m.netYillikOran, 0.34, 0.0001);
  assert.equal(m.yenilemeliTutar(1), m.vadeSonuTutar);

  const b = V.utc(2026, 10, 28);
  const oran = (gun) => V.yasalStopaj(b, V.gunEkle(b, gun)).oranYuzde;
  assert.deepEqual([32, 181, 182, 183, 365, 366].map(oran), [17.5, 17.5, 17.5, 15, 15, 10]);
  assert.equal(V.yasalStopajGecerli(V.utc(2026, 12, 31)), true);
  assert.equal(V.yasalStopajGecerli(V.utc(2027, 1, 1)), false);
});

test("para biçimi", () => {
  assert.equal(V.paraFormat(1234567.891, 2), "1.234.567,89 TL");
  assert.equal(V.paraFormat(100000), "100.000 TL");
  assert.equal(V.paraFormat(0, 2), "0,00 TL");
});
