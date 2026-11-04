import 'dart:convert';
import 'dart:math';
import 'file:///Users/mahsunse/Desktop/ilk_uygulamam/lib/plan.dart';
import 'file:///Users/mahsunse/Desktop/ilk_uygulamam/lib/mevduat.dart';
import 'file:///Users/mahsunse/Desktop/ilk_uygulamam/lib/tarih.dart';

String? iso(DateTime? t) => t == null ? null : tarihFormat(t);

void main() {
  final r = Random(42);
  final kredi = [];
  for (int i = 0; i < 400; i++) {
    final tur = krediTurleri[r.nextInt(4)];
    final tutar = [1000.0, 50000.0, 100000.0, 1234567.0, 5000000.0, (r.nextInt(2000000) + 1000).toDouble()][r.nextInt(6)];
    final oran = [0.0, 1.0, 2.0, 3.5, 4.0, 4.79, (r.nextInt(800) / 100)][r.nextInt(7)];
    final vade = [1, 3, 6, 12, 24, 36, 60, 120, 240, 360, r.nextInt(360) + 1][r.nextInt(11)];
    final tarihli = r.nextInt(5) != 0;
    final fin = DateTime.utc(2026, 1, 1).add(Duration(days: r.nextInt(1500)));
    DateTime? ilk;
    int odemesiz = r.nextInt(4) == 0 ? r.nextInt(7) : 0;
    if (tarihli && r.nextInt(3) == 0) ilk = fin.add(Duration(days: 1 + r.nextInt(210)));
    final p = KrediPlani.hesapla(tur: tur, tutar: tutar, oranYuzde: oran, vade: vade, odemesiz: odemesiz,
        finansmanTarihi: tarihli ? fin : null, ilkTaksitTarihi: ilk);
    kredi.add({
      'girdi': {'tur': tur, 'tutar': tutar, 'oranYuzde': oran, 'vade': vade, 'odemesiz': odemesiz,
        'fin': tarihli ? [fin.year, fin.month, fin.day] : null, 'ilk': ilk == null ? null : [ilk.year, ilk.month, ilk.day]},
      'taksit': p.taksit, 'toplam': p.toplam, 'netKarPayi': p.netKarPayi, 'vergi': p.vergi,
      'odemesizGun': p.odemesizGun, 'toplamMaliyet': p.toplamMaliyet,
      'yillikKarPayiOrani': p.yillikKarPayiOrani, 'yillikMaliyetOrani': p.yillikMaliyetOrani,
      'ortalamaVadeGun': p.ortalamaVadeGun,
      'satirlar': [for (final s in p.satirlar) [s.no, s.taksit, s.anapara, s.karPayi, s.vergi, s.kalan, s.kalanKar, iso(s.tarih), s.gun]],
    });
  }
  final mevduat = [];
  for (int i = 0; i < 400; i++) {
    final b = DateTime.utc(2026, 1, 1).add(Duration(days: r.nextInt(900)));
    final gun = [1, 32, 92, 181, 182, 183, 365, 366, 730, r.nextInt(2000) + 1][r.nextInt(10)];
    final anapara = [1000.0, 100000.0, 2500000.0, (r.nextInt(5000000) + 1).toDouble()][r.nextInt(4)];
    final oran = [0.0, 36.5, 40.0, 45.75, r.nextInt(6000) / 100][r.nextInt(5)];
    final st = yasalStopaj(b, b.add(Duration(days: gun)));
    final m = MevduatGetirisi(anapara: anapara, yillikOranYuzde: oran, stopajYuzde: st.oranYuzde, baslangic: b, gun: gun);
    mevduat.add({
      'girdi': {'anapara': anapara, 'oran': oran, 'b': [b.year, b.month, b.day], 'gun': gun},
      'stopajYuzde': st.oranYuzde, 'gecerli': yasalStopajGecerli(b),
      'brut': m.brutGetiri, 'stopaj': m.stopaj, 'net': m.netGetiri, 'toplam': m.vadeSonuTutar, 'vadeSonu': iso(m.vadeSonu),
      'netYillik': m.netYillikOran, 'yenilemeli': m.yenilemeliYillikOran,
      'yt': gun < 365 ? m.yenilemeliTutar(365 ~/ gun) : null,
    });
  }
  print(jsonEncode({'kredi': kredi, 'mevduat': mevduat}));
}
