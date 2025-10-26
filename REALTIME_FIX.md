# Supabase Realtime Sorunu Çözümü

## Problem
- Mesajlar real-time olarak gelmiyor
- Chats listesi güncellenmiyor
- Subscription'lar kurulu ama event'ler gelmiyor

## Çözüm Adımları

### 1. Supabase Dashboard'da Realtime'ı Aktif Et

**Adım 1:** Supabase Dashboard'a git
- https://supabase.com/dashboard → Projenizi seçin

**Adım 2:** Database Replication'ı Kontrol Et
- Sol menüden **Database** → **Replication** seçeneğine git
- `messages` tablosu için **enable** butonuna tıkla
- `chats` tablosu için **enable** butonuna tıkla
- `chat_participants` tablosu için **enable** butonuna tıkla (opsiyonel ama önerilir)

### 2. SQL Script ile Realtime'ı Etkinleştir

Alternatif olarak, `supabase_realtime_setup.sql` dosyasındaki SQL'i çalıştır:

**Adım 1:** Supabase Dashboard → **SQL Editor**
**Adım 2:** `supabase_realtime_setup.sql` içeriğini kopyala ve çalıştır

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_participants;
```

### 3. RLS (Row Level Security) Policy'lerini Kontrol Et

Realtime çalışması için kullanıcıların ilgili row'ları SELECT edebilmesi gerekir.

**Messages tablosu için:**
```sql
-- Kullanıcılar sadece kendi chat'lerindeki mesajları görebilmeli
CREATE POLICY "Users can view messages in their chats"
ON messages FOR SELECT
USING (
  chat_id IN (
    SELECT chat_id
    FROM chat_participants
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

**Chats tablosu için:**
```sql
-- Kullanıcılar sadece üye oldukları chat'leri görebilmeli
CREATE POLICY "Users can view their chats"
ON chats FOR SELECT
USING (
  id IN (
    SELECT chat_id
    FROM chat_participants
    WHERE user_id = auth.uid() AND is_active = true
  )
);
```

### 4. Uygulayı Test Et

Debug log'ları ekledik. Console'da şunları göreceksin:

```
[Realtime] Creating subscription: table-messages-1234567890
[Realtime] Subscription table-messages-1234567890 status: SUBSCRIBED
[Realtime] Message INSERT event received: { new: {...} }
```

**Eğer görmüyorsan:**
- Status `SUBSCRIBED` değilse → Realtime aktif değil (Adım 1 ve 2'yi yap)
- Status `SUBSCRIBED` ama event gelmiyor → RLS policy sorunu (Adım 3'ü yap)

### 5. Hızlı Test

Supabase SQL Editor'da bir test mesajı insert et:

```sql
INSERT INTO messages (chat_id, sender_id, content, sender_type, status)
VALUES (
  'YOUR_CHAT_ID',  -- Mevcut bir chat ID
  'YOUR_USER_ID',  -- Senin user ID'n
  'Test realtime message',
  'user',
  'sent'
);
```

Eğer uygulama açıksa, bu mesaj anında görünmeli.

## Önemli Notlar

1. **Realtime sadece authenticated user'lar için çalışır** - RLS policy'lerle korunuyor
2. **Her subscription için benzersiz channel name kullanıyoruz** - `Date.now()` ile
3. **Filter kullanıyoruz** - Sadece ilgili chat'in mesajlarını dinliyoruz
4. **Duplicate prevention var** - Aynı mesaj iki kez eklenmez (optimistic update + realtime)

## Daha Fazla Bilgi

Supabase Realtime Documentation:
https://supabase.com/docs/guides/realtime
