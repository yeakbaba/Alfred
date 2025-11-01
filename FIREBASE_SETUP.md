# Firebase Setup for Android Push Notifications

Android'de push notification çalışması için Firebase Cloud Messaging (FCM) kurulumu yapılması gerekiyor.

## Adımlar:

### 1. Firebase Console'da Proje Oluştur
- https://console.firebase.google.com/ adresine git
- "Add project" veya mevcut projeyi seç
- Proje adı: `Alfred` (veya istediğin ad)

### 2. Android App Ekle
- Firebase Console'da projeye Android app ekle
- **Android package name:** `com.mosaic.alfredapp`
  (Bu `app.json` dosyasındaki `android.package` değeriyle aynı olmalı)
- App nickname (opsiyonel): Alfred App
- Debug signing certificate SHA-1 (şimdilik boş bırakılabilir)

### 3. google-services.json İndir
- Firebase Console'dan `google-services.json` dosyasını indir
- Bu dosyayı projenin **root dizinine** kopyala:
  ```
  /Users/yunusakbaba/Projects/Antler/Alfred/AlfredApp/google-services.json
  ```

### 4. app.json'a Ekleme Yap
- `app.json` dosyasını aç
- `android` bölümüne şunu ekle:
  ```json
  "android": {
    "googleServicesFile": "./google-services.json",
    // ... diğer ayarlar
  }
  ```

### 5. Expo Uygulamayı Yeniden Başlat
```bash
npx expo start --clear
```

### 6. Test Et
- Fiziksel Android cihazda Expo Go ile test et
- Push token başarıyla oluşturulmalı
- Console'da şunu göreceksin: `✅ Push token retrieved: ExponentPushToken[...]`

## Alternatif: EAS Build Kullanarak

Eğer EAS Build kullanıyorsan:

```bash
eas build:configure
eas credentials
```

EAS otomatik olarak Firebase credentials'ları yönetebilir.

## Sorun Giderme

**Hata:** `Default FirebaseApp is not initialized`
- `google-services.json` dosyasının root dizinde olduğundan emin ol
- `app.json` içinde `googleServicesFile` path'inin doğru olduğundan emin ol
- Cache'i temizle: `npx expo start --clear`

**Hata:** `An error occurred while running npx expo prebuild`
- `npx expo prebuild --clean` çalıştır
- Ardından tekrar `npx expo start --clear`

## Şimdilik (Development)

Şu anda kod, Firebase setup yoksa mock token oluşturuyor:
```
ExponentPushToken[ANDROID-MOCK-timestamp]
```

Bu, database entegrasyonunu test etmek için yeterli. Ancak **gerçek push notification** göndermek için Firebase setup **şart**.

## iOS için

iOS için Firebase gerekmez. APNs (Apple Push Notification Service) otomatik olarak çalışır. Sadece fiziksel iOS cihazda test etmen yeterli.
