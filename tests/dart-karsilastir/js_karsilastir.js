const V = require(process.argv[2]);
const d = JSON.parse(require('fs').readFileSync(process.argv[3], 'utf8'));
let hata = 0, sayi = 0;
const esit = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a)) : a === b;
function kontrol(etiket, a, b) { sayi++; if (!esit(a, b)) { hata++; if (hata < 20) console.log('FARK', etiket, 'dart=', a, 'js=', b); } }
const tarih = (x) => x ? V.utc(x[0], x[1], x[2]) : null;
d.kredi.forEach((k, i) => {
  const g = k.girdi;
  const p = V.krediHesapla({ tur: g.tur, tutar: g.tutar, oranYuzde: g.oranYuzde, vade: g.vade, odemesiz: g.odemesiz, finansmanTarihi: tarih(g.fin), ilkTaksitTarihi: tarih(g.ilk) });
  for (const a of ['taksit','toplam','netKarPayi','vergi','odemesizGun','toplamMaliyet','yillikKarPayiOrani','yillikMaliyetOrani','ortalamaVadeGun']) kontrol(`kredi#${i}.${a}`, k[a], p[a]);
  kontrol(`kredi#${i}.satirSayisi`, k.satirlar.length, p.satirlar.length);
  k.satirlar.forEach((s, j) => {
    const q = p.satirlar[j];
    const js = [q.no, q.taksit, q.anapara, q.karPayi, q.vergi, q.kalan, q.kalanKar, q.tarih ? V.tarihFormat(q.tarih) : null, q.gun];
    s.forEach((v, n) => kontrol(`kredi#${i}.satir${j}.${n}`, v, js[n]));
  });
});
d.mevduat.forEach((m, i) => {
  const g = m.girdi, b = tarih(g.b);
  const st = V.yasalStopaj(b, V.gunEkle(b, g.gun));
  const r = V.mevduatHesapla({ anapara: g.anapara, yillikOranYuzde: g.oran, stopajYuzde: st.oranYuzde, baslangic: b, gun: g.gun });
  kontrol(`mev#${i}.stopajYuzde`, m.stopajYuzde, st.oranYuzde);
  kontrol(`mev#${i}.gecerli`, m.gecerli, V.yasalStopajGecerli(b));
  for (const [a, x] of [['brut','brutGetiri'],['stopaj','stopaj'],['net','netGetiri'],['toplam','vadeSonuTutar'],['netYillik','netYillikOran'],['yenilemeli','yenilemeliYillikOran']]) kontrol(`mev#${i}.${a}`, m[a], r[x]);
  kontrol(`mev#${i}.vadeSonu`, m.vadeSonu, V.tarihFormat(r.vadeSonu));
  if (m.yt !== null) kontrol(`mev#${i}.yt`, m.yt, r.yenilemeliTutar(Math.floor(365 / g.gun)));
});
console.log(`${d.kredi.length} kredi, ${d.mevduat.length} mevduat örneği; ${sayi} değer karşılaştırıldı, ${hata} fark.`);
process.exit(hata ? 1 : 0);
