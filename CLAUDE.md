# vadelio-site (proje özeti)

> Son güncelleme: 2026-11-04

https://vadelio.com.tr sitesinin yayın deposu (herkese açık). Cloudflare Pages `vadelio-site` projesi `public/`
klasörünü yayınlar; **`main`'e push = otomatik yayın**. Derleme adımı yok, düz HTML. Asıl kaynak bu depo.

- `public/index.html`: Vadelio tanıtım (TR) · `public/privacy/`: gizlilik politikası
- `public/shots/`: uygulama ekranları · `public/og.png`: paylaşım görseli
- `public/kredi-hesaplama/`, `public/mevduat-hesaplama/`: ücretsiz web hesaplayıcıları (düz JS). Çekirdek
  `public/hesap/vadelio-hesap.js` uygulamadaki `lib/plan.dart`, `tarih.dart`, `mevduat.dart`'ın birebir karşılığı;
  uygulamada kural, bayram ya da stopaj değişirse burayı da güncelle. Mağaza bağlantıları `public/hesap/arayuz.js` `MAGAZA`.
- Doğrulama: `node --test tests/hesap.test.js` (Dart testlerindeki örnekler) ve
  `cd tests/dart-karsilastir && dart run dart_uret.dart > /tmp/d.json && node js_karsilastir.js ../../public/hesap/vadelio-hesap.js /tmp/d.json`
  (800 rastgele örnekte Dart ile JS'i karşılaştırır; `~/Desktop/ilk_uygulamam` gerekir).
- www.vadelio.com.tr → vadelio.com.tr yönlendirmesi Cloudflare'de (Redirect Rule), depoda değil.
- Eski adresler: vitrinly.app/vadelio/ → buraya 301 (vitrinly-site `_redirects`).
  Gizlilik metninin eski kopyası `mahsunse-maker/kredi-finansman-gizlilik-politikasi` (GitHub Pages) yerinde
  kalır, çünkü uygulama `oranlar.json`'u oradan indirir ve mağazalarda o adres kayıtlı; metni ikisinde aynı tut.

Doğrulamayı vadelio.com.tr üzerinden yap (Türkiye ağından *.pages.dev açılmayabilir).
Uyarı: Pages projesini asla özel uygulama deposuna (kredi-finansman-hesaplama) bağlama.

Proje listesi: `~/.claude/CLAUDE.md`.
