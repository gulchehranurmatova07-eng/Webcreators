// WEB-CREATORS admin panel. Loaded as an external file so the page can use a strict
// Content-Security-Policy (script-src 'self'). All data from the server is escaped with esc()
// before it is put into HTML.
(() => {
"use strict";

/* ------------------------------------------------------------------ i18n */
const I18N = {
  en: {
    adminPanel: "Admin panel", password: "Password", showPassword: "Show password", signIn: "Sign in",
    wrongPassword: "Incorrect sign-in details. Try again.", tooMany: "Too many attempts. Try again in {m} min.", netErr: "Can't reach the server. Check your connection.",
    mfaCode: "Authentication code", mfaHint: "6-digit code from your authenticator app, or a recovery code.", verify: "Verify", back: "Back",
    badCode: "That code didn't work. Check the time on your phone and try again.", mfaExpired: "Sign-in timed out. Enter your password again.",
    mfaSetupTitle: "Set up two-factor sign-in", mfaSetupText: "Two-factor authentication is required. Scan this QR code with Google Authenticator, Microsoft Authenticator or 1Password, then enter the 6-digit code it shows.",
    mfaManual: "Or enter this key manually", mfaEnterCode: "6-digit code", mfaTurnOn: "Turn on two-factor sign-in",
    recoveryText: "Save these one-time recovery codes somewhere safe (a password manager or on paper). Each one lets you sign in once if you lose your phone. They won't be shown again.",
    download: "Download", recoverySaved: "I saved my recovery codes", continue: "Continue",
    setupTitle: "Finish setup", openVercel: "Open Vercel dashboard", setupFoot: "After adding them, redeploy the project in Vercel.",
    setupStorage: "Database", setupStorageText: "Vercel → Storage → Create → Upstash Redis → connect it to this project.",
    setupPw: "Admin password", setupPwText: "Vercel → Settings → Environment Variables → add <code>ADMIN_PASSWORD</code>.",
    setupSecret: "Security key", setupSecretText: "Vercel → Settings → Environment Variables → add <code>AUTH_SECRET</code> (a random value of at least 32 characters).",
    overview: "Overview", orders: "Orders", board: "Board", security: "Security",
    overviewSub: "Everything happening with your website orders", ordersSub: "Every request sent from the website form", boardSub: "Drag cards between columns to update the status", securitySub: "Sign-in protection, notifications and the activity log",
    openSite: "Open website", logout: "Log out", search: "Search", searchPh: "Order #, name, phone, message…", refresh: "Refresh", export: "Export CSV",
    synced: "Live · updated {t}", offline: "Offline", justNow: "just now",
    kTotal: "Total orders", kNew: "New", kProgress: "In progress", kDone: "Completed", kCancelled: "Cancelled", kNotify: "Notification failures", kRevenue: "Revenue", kConv: "Conversion",
    kTotalHint: "{n} this week", kNewHint: "Waiting for a reply", kProgressHint: "Contacted, discussing, building", kDoneHint: "Finished websites", kCancelledHint: "Closed without a project", kNotifyHint: "Emails or Telegram messages to retry", kNotifyOk: "All notifications delivered", kRevenueHint: "From completed orders", kConvHint: "Orders → completed",
    chart30: "Orders · last 30 days", byBiz: "By business type", recent: "Latest orders", viewAll: "View all →",
    st: { new: "New", contacted: "Contacted", discussion: "In discussion", inProgress: "In progress", done: "Completed", cancelled: "Cancelled" },
    all: "All", allBiz: "All business types", from: "From", to: "To", failedOnly: "Notification failed", clear: "Clear",
    biz: { restaurant: "Restaurant / cafe", hotel: "Hotel", barber: "Barbershop / beauty", market: "Supermarket / store", clothing: "Clothing store", commerce: "E-commerce / delivery platform", other: "Other" },
    colOrder: "Order", colClient: "Client", colBiz: "Business", colBudget: "Budget", colMsg: "Message", colStatus: "Status", colNotify: "Notified", colDate: "Date",
    emptyTitle: "No orders yet", emptyText: "New requests from your website will appear here instantly.", noMatch: "Nothing matches your filters.",
    pageOf: "{a}–{b} of {n}", prev: "← Previous", next: "Next →",
    call: "Call", telegram: "Telegram", whatsapp: "WhatsApp", copy: "Copy", copied: "Copied",
    status: "Status", details: "Details", fBiz: "Business", fBudget: "Budget", fLang: "Language", fDate: "Received", fPage: "Page", fId: "Order ID", fNumber: "Order",
    message: "Message from client", price: "Agreed price", pricePh: "e.g. 650", notes: "Internal notes (team only)", notesPh: "Calls, deadlines, what the client wants…",
    history: "History", created: "Order received", save: "Save changes", saved: "Saved", delete: "Delete", cancel: "Cancel", close: "Close",
    deleteQ: "Delete this order?", deleteText: "This removes it permanently. This can't be undone. Consider downloading a backup first (Security → Backup).", deleted: "Order deleted",
    newOrder: "New order from {name}", saveErr: "Couldn't save. Try again.", sessionEnd: "Session expired — please sign in again.",
    notifications: "Notifications", nEmail: "Email", nTelegram: "Telegram", nb: { sent: "Sent", failed: "Failed", pending: "Pending", sending: "Sending", not_configured: "Not set up", "": "—" },
    nAttempts: "{n} attempt(s)", nNext: "next automatic retry {t}", nLegacy: "This order was received before delivery tracking was added.",
    retry: "Retry failed", resend: "Send again", resendQ: "Send the notification again?", resendText: "It was already sent. The team will receive a second copy.",
    retried: "Notification retried", alreadySending: "Already sending — try again in a moment.", notConfiguredHint: "Email isn't set up yet — see Security.",
    notifyBanner: "{n} order notification(s) failed to deliver.", review: "Review",
    hChanged: "Updated", hNotify: "Notification", hCreated: "Received",
    secMfa: "Two-factor sign-in", mfaOn: "On", mfaOff: "Off", mfaSince: "Turned on", recLeft: "Recovery codes left", mfaReset: "Set up a new phone", newCodes: "New recovery codes",
    askCode: "Enter a current 6-digit code", askCodeText: "Confirm with a code from your authenticator app (or a recovery code).",
    secSessions: "Active sessions", thisDevice: "This device", lastActive: "last active {t}", signOutOthers: "Sign out other sessions", signedOutN: "{n} session(s) signed out",
    sessionPolicy: "Sessions end after {i} min without activity and after {h} h in any case.",
    secEmail: "Email notifications", provider: "Provider", recipient: "Recipient", sender: "Sender", configured: "Configured", notConfigured: "Not configured", testEmail: "Send test email",
    testOk: "Accepted by the email provider. Check the inbox (and spam folder).", testFail: "Sending failed: {e}",
    secTelegram: "Telegram notifications", retryQueue: "Waiting for automatic retry", cronJob: "Daily retry job",
    secBackup: "Backup", backupText: "Download every order (with its notification status) as a JSON file. Keep it somewhere private.", backupBtn: "Download backup",
    secAlerts: "Recent security alerts", noAlerts: "No alerts.", secAudit: "Activity log", noAudit: "No activity yet.",
    codesTitle: "New recovery codes", codesText: "Save these now — they replace the old codes and won't be shown again."
  },
  ru: {
    adminPanel: "Админ-панель", password: "Пароль", showPassword: "Показать пароль", signIn: "Войти",
    wrongPassword: "Неверные данные для входа. Попробуйте ещё раз.", tooMany: "Слишком много попыток. Повторите через {m} мин.", netErr: "Нет связи с сервером. Проверьте интернет.",
    mfaCode: "Код подтверждения", mfaHint: "6-значный код из приложения-аутентификатора или резервный код.", verify: "Подтвердить", back: "Назад",
    badCode: "Код не подошёл. Проверьте время на телефоне и попробуйте снова.", mfaExpired: "Время входа истекло. Введите пароль ещё раз.",
    mfaSetupTitle: "Настройте двухфакторный вход", mfaSetupText: "Двухфакторная защита обязательна. Отсканируйте QR-код в Google Authenticator, Microsoft Authenticator или 1Password и введите 6-значный код.",
    mfaManual: "Или введите ключ вручную", mfaEnterCode: "6-значный код", mfaTurnOn: "Включить двухфакторный вход",
    recoveryText: "Сохраните эти одноразовые резервные коды в надёжном месте (менеджер паролей или на бумаге). Каждый позволяет войти один раз, если вы потеряете телефон. Больше они не будут показаны.",
    download: "Скачать", recoverySaved: "Я сохранил(а) резервные коды", continue: "Продолжить",
    setupTitle: "Завершите настройку", openVercel: "Открыть Vercel", setupFoot: "После добавления сделайте Redeploy проекта в Vercel.",
    setupStorage: "База данных", setupStorageText: "Vercel → Storage → Create → Upstash Redis → подключите к этому проекту.",
    setupPw: "Пароль админа", setupPwText: "Vercel → Settings → Environment Variables → добавьте <code>ADMIN_PASSWORD</code>.",
    setupSecret: "Ключ безопасности", setupSecretText: "Vercel → Settings → Environment Variables → добавьте <code>AUTH_SECRET</code> (случайная строка от 32 символов).",
    overview: "Обзор", orders: "Заказы", board: "Доска", security: "Безопасность",
    overviewSub: "Всё о заказах с вашего сайта", ordersSub: "Все заявки из формы на сайте", boardSub: "Перетаскивайте карточки, чтобы менять статус", securitySub: "Защита входа, уведомления и журнал действий",
    openSite: "Открыть сайт", logout: "Выйти", search: "Поиск", searchPh: "№ заказа, имя, телефон, сообщение…", refresh: "Обновить", export: "Экспорт CSV",
    synced: "Онлайн · обновлено {t}", offline: "Нет связи", justNow: "только что",
    kTotal: "Всего заказов", kNew: "Новые", kProgress: "В работе", kDone: "Выполнено", kCancelled: "Отменено", kNotify: "Ошибки уведомлений", kRevenue: "Выручка", kConv: "Конверсия",
    kTotalHint: "{n} за неделю", kNewHint: "Ждут ответа", kProgressHint: "Связались, обсуждаем, делаем", kDoneHint: "Готовые сайты", kCancelledHint: "Закрыты без проекта", kNotifyHint: "Письма или сообщения для повтора", kNotifyOk: "Все уведомления доставлены", kRevenueHint: "По выполненным", kConvHint: "Заказы → выполнено",
    chart30: "Заказы · 30 дней", byBiz: "По типу бизнеса", recent: "Последние заказы", viewAll: "Все заказы →",
    st: { new: "Новый", contacted: "Связались", discussion: "Обсуждение", inProgress: "В работе", done: "Выполнен", cancelled: "Отменён" },
    all: "Все", allBiz: "Все типы бизнеса", from: "С", to: "По", failedOnly: "Ошибка уведомления", clear: "Сбросить",
    biz: { restaurant: "Ресторан / кафе", hotel: "Отель", barber: "Барбершоп / салон", market: "Супермаркет / магазин", clothing: "Магазин одежды", commerce: "Интернет-магазин / платформа доставки", other: "Другое" },
    colOrder: "Заказ", colClient: "Клиент", colBiz: "Бизнес", colBudget: "Бюджет", colMsg: "Сообщение", colStatus: "Статус", colNotify: "Уведомление", colDate: "Дата",
    emptyTitle: "Заказов пока нет", emptyText: "Новые заявки с сайта появятся здесь сразу.", noMatch: "Ничего не найдено.",
    pageOf: "{a}–{b} из {n}", prev: "← Назад", next: "Далее →",
    call: "Позвонить", telegram: "Telegram", whatsapp: "WhatsApp", copy: "Копировать", copied: "Скопировано",
    status: "Статус", details: "Детали", fBiz: "Бизнес", fBudget: "Бюджет", fLang: "Язык", fDate: "Получен", fPage: "Страница", fId: "ID заказа", fNumber: "Заказ",
    message: "Сообщение клиента", price: "Согласованная цена", pricePh: "например 650", notes: "Внутренние заметки (только для команды)", notesPh: "Звонки, сроки, пожелания клиента…",
    history: "История", created: "Заказ получен", save: "Сохранить", saved: "Сохранено", delete: "Удалить", cancel: "Отмена", close: "Закрыть",
    deleteQ: "Удалить заказ?", deleteText: "Он будет удалён навсегда. Отменить нельзя. Сначала можно скачать резервную копию (Безопасность → Резервная копия).", deleted: "Заказ удалён",
    newOrder: "Новый заказ: {name}", saveErr: "Не удалось сохранить. Попробуйте ещё раз.", sessionEnd: "Сессия истекла — войдите снова.",
    notifications: "Уведомления", nEmail: "Email", nTelegram: "Telegram", nb: { sent: "Отправлено", failed: "Ошибка", pending: "Ожидает", sending: "Отправка", not_configured: "Не настроено", "": "—" },
    nAttempts: "попыток: {n}", nNext: "следующий автоповтор {t}", nLegacy: "Заказ получен до появления отслеживания доставки.",
    retry: "Повторить", resend: "Отправить снова", resendQ: "Отправить уведомление ещё раз?", resendText: "Оно уже было отправлено. Команда получит вторую копию.",
    retried: "Уведомление отправлено повторно", alreadySending: "Уже отправляется — попробуйте чуть позже.", notConfiguredHint: "Email ещё не настроен — см. «Безопасность».",
    notifyBanner: "Не доставлено уведомлений о заказах: {n}.", review: "Посмотреть",
    hChanged: "Изменено", hNotify: "Уведомление", hCreated: "Получен",
    secMfa: "Двухфакторный вход", mfaOn: "Включён", mfaOff: "Выключен", mfaSince: "Включён", recLeft: "Осталось резервных кодов", mfaReset: "Настроить новый телефон", newCodes: "Новые резервные коды",
    askCode: "Введите текущий 6-значный код", askCodeText: "Подтвердите кодом из приложения-аутентификатора (или резервным кодом).",
    secSessions: "Активные сессии", thisDevice: "Это устройство", lastActive: "активность {t}", signOutOthers: "Завершить другие сессии", signedOutN: "Завершено сессий: {n}",
    sessionPolicy: "Сессия завершается после {i} мин бездействия и в любом случае через {h} ч.",
    secEmail: "Email-уведомления", provider: "Сервис", recipient: "Получатель", sender: "Отправитель", configured: "Настроено", notConfigured: "Не настроено", testEmail: "Отправить тестовое письмо",
    testOk: "Письмо принято почтовым сервисом. Проверьте входящие (и спам).", testFail: "Не удалось отправить: {e}",
    secTelegram: "Telegram-уведомления", retryQueue: "Ждут автоповтора", cronJob: "Ежедневный повтор",
    secBackup: "Резервная копия", backupText: "Скачайте все заказы (со статусом уведомлений) в файле JSON. Храните его в надёжном месте.", backupBtn: "Скачать копию",
    secAlerts: "Последние оповещения безопасности", noAlerts: "Оповещений нет.", secAudit: "Журнал действий", noAudit: "Пока пусто.",
    codesTitle: "Новые резервные коды", codesText: "Сохраните их сейчас — старые коды больше не работают, и эти не будут показаны снова."
  },
  uz: {
    adminPanel: "Admin panel", password: "Parol", showPassword: "Parolni koʻrsatish", signIn: "Kirish",
    wrongPassword: "Kirish maʼlumotlari notoʻgʻri. Qayta urinib koʻring.", tooMany: "Juda koʻp urinish. {m} daqiqadan soʻng urinib koʻring.", netErr: "Serverga ulanib boʻlmadi. Internetni tekshiring.",
    mfaCode: "Tasdiqlash kodi", mfaHint: "Autentifikator ilovasidagi 6 xonali kod yoki zaxira kod.", verify: "Tasdiqlash", back: "Orqaga",
    badCode: "Kod mos kelmadi. Telefondagi vaqtni tekshirib, qayta urinib koʻring.", mfaExpired: "Kirish vaqti tugadi. Parolni qayta kiriting.",
    mfaSetupTitle: "Ikki bosqichli kirishni sozlang", mfaSetupText: "Ikki bosqichli himoya majburiy. QR kodni Google Authenticator, Microsoft Authenticator yoki 1Password bilan skanerlang va 6 xonali kodni kiriting.",
    mfaManual: "Yoki kalitni qoʻlda kiriting", mfaEnterCode: "6 xonali kod", mfaTurnOn: "Ikki bosqichli kirishni yoqish",
    recoveryText: "Bu bir martalik zaxira kodlarni xavfsiz joyda saqlang (parol menejeri yoki qogʻozda). Telefonni yoʻqotsangiz, har biri bilan bir marta kirish mumkin. Ular qayta koʻrsatilmaydi.",
    download: "Yuklab olish", recoverySaved: "Zaxira kodlarni saqladim", continue: "Davom etish",
    setupTitle: "Sozlashni yakunlang", openVercel: "Vercel'ni ochish", setupFoot: "Qoʻshgandan soʻng Vercel'da loyihani Redeploy qiling.",
    setupStorage: "Maʼlumotlar bazasi", setupStorageText: "Vercel → Storage → Create → Upstash Redis → shu loyihaga ulang.",
    setupPw: "Admin paroli", setupPwText: "Vercel → Settings → Environment Variables → <code>ADMIN_PASSWORD</code> qoʻshing.",
    setupSecret: "Xavfsizlik kaliti", setupSecretText: "Vercel → Settings → Environment Variables → <code>AUTH_SECRET</code> qoʻshing (kamida 32 belgili tasodifiy qiymat).",
    overview: "Umumiy", orders: "Buyurtmalar", board: "Doska", security: "Xavfsizlik",
    overviewSub: "Saytingizdagi buyurtmalar haqida hammasi", ordersSub: "Saytdagi formadan kelgan barcha soʻrovlar", boardSub: "Holatni oʻzgartirish uchun kartani sudrang", securitySub: "Kirish himoyasi, bildirishnomalar va harakatlar jurnali",
    openSite: "Saytni ochish", logout: "Chiqish", search: "Qidiruv", searchPh: "Buyurtma №, ism, telefon, xabar…", refresh: "Yangilash", export: "CSV yuklab olish",
    synced: "Onlayn · {t} yangilandi", offline: "Aloqa yoʻq", justNow: "hozirgina",
    kTotal: "Jami buyurtmalar", kNew: "Yangi", kProgress: "Jarayonda", kDone: "Bajarildi", kCancelled: "Bekor qilingan", kNotify: "Bildirishnoma xatolari", kRevenue: "Daromad", kConv: "Konversiya",
    kTotalHint: "Bu hafta {n} ta", kNewHint: "Javob kutmoqda", kProgressHint: "Bogʻlanildi, muhokama, ish", kDoneHint: "Tayyor saytlar", kCancelledHint: "Loyihasiz yopilgan", kNotifyHint: "Qayta yuborish kerak", kNotifyOk: "Barcha bildirishnomalar yetkazildi", kRevenueHint: "Bajarilganlardan", kConvHint: "Buyurtma → bajarildi",
    chart30: "Buyurtmalar · 30 kun", byBiz: "Biznes turi boʻyicha", recent: "Oxirgi buyurtmalar", viewAll: "Hammasi →",
    st: { new: "Yangi", contacted: "Bogʻlanildi", discussion: "Muhokamada", inProgress: "Jarayonda", done: "Bajarildi", cancelled: "Bekor qilindi" },
    all: "Hammasi", allBiz: "Barcha biznes turlari", from: "Dan", to: "Gacha", failedOnly: "Bildirishnoma xatosi", clear: "Tozalash",
    biz: { restaurant: "Restoran / kafe", hotel: "Mehmonxona", barber: "Sartaroshxona / salon", market: "Supermarket / doʻkon", clothing: "Kiyim doʻkoni", commerce: "Onlayn doʻkon / yetkazib berish platformasi", other: "Boshqa" },
    colOrder: "Buyurtma", colClient: "Mijoz", colBiz: "Biznes", colBudget: "Byudjet", colMsg: "Xabar", colStatus: "Holat", colNotify: "Bildirishnoma", colDate: "Sana",
    emptyTitle: "Hozircha buyurtma yoʻq", emptyText: "Saytdan kelgan yangi soʻrovlar shu yerda darhol paydo boʻladi.", noMatch: "Hech narsa topilmadi.",
    pageOf: "{a}–{b} / {n}", prev: "← Oldingi", next: "Keyingi →",
    call: "Qoʻngʻiroq", telegram: "Telegram", whatsapp: "WhatsApp", copy: "Nusxa", copied: "Nusxalandi",
    status: "Holat", details: "Tafsilotlar", fBiz: "Biznes", fBudget: "Byudjet", fLang: "Til", fDate: "Qabul qilindi", fPage: "Sahifa", fId: "Buyurtma ID", fNumber: "Buyurtma",
    message: "Mijoz xabari", price: "Kelishilgan narx", pricePh: "masalan 650", notes: "Ichki eslatmalar (faqat jamoa uchun)", notesPh: "Qoʻngʻiroqlar, muddatlar, mijoz istaklari…",
    history: "Tarix", created: "Buyurtma qabul qilindi", save: "Saqlash", saved: "Saqlandi", delete: "Oʻchirish", cancel: "Bekor qilish", close: "Yopish",
    deleteQ: "Buyurtmani oʻchirasizmi?", deleteText: "U butunlay oʻchiriladi. Qaytarib boʻlmaydi. Avval zaxira nusxani yuklab olishingiz mumkin (Xavfsizlik → Zaxira).", deleted: "Buyurtma oʻchirildi",
    newOrder: "Yangi buyurtma: {name}", saveErr: "Saqlab boʻlmadi. Qayta urinib koʻring.", sessionEnd: "Sessiya tugadi — qayta kiring.",
    notifications: "Bildirishnomalar", nEmail: "Email", nTelegram: "Telegram", nb: { sent: "Yuborildi", failed: "Xato", pending: "Kutilmoqda", sending: "Yuborilmoqda", not_configured: "Sozlanmagan", "": "—" },
    nAttempts: "{n} ta urinish", nNext: "keyingi avto-urinish {t}", nLegacy: "Bu buyurtma yetkazishni kuzatish qoʻshilishidan oldin kelgan.",
    retry: "Qayta urinish", resend: "Yana yuborish", resendQ: "Bildirishnomani yana yuborasizmi?", resendText: "U allaqachon yuborilgan. Jamoa ikkinchi nusxani oladi.",
    retried: "Bildirishnoma qayta yuborildi", alreadySending: "Yuborilmoqda — birozdan soʻng urinib koʻring.", notConfiguredHint: "Email hali sozlanmagan — Xavfsizlik boʻlimiga qarang.",
    notifyBanner: "{n} ta buyurtma bildirishnomasi yetkazilmadi.", review: "Koʻrish",
    hChanged: "Oʻzgartirildi", hNotify: "Bildirishnoma", hCreated: "Qabul qilindi",
    secMfa: "Ikki bosqichli kirish", mfaOn: "Yoqilgan", mfaOff: "Oʻchirilgan", mfaSince: "Yoqilgan", recLeft: "Qolgan zaxira kodlar", mfaReset: "Yangi telefonni sozlash", newCodes: "Yangi zaxira kodlar",
    askCode: "Joriy 6 xonali kodni kiriting", askCodeText: "Autentifikator ilovasidagi kod (yoki zaxira kod) bilan tasdiqlang.",
    secSessions: "Faol sessiyalar", thisDevice: "Shu qurilma", lastActive: "oxirgi faollik {t}", signOutOthers: "Boshqa sessiyalarni yopish", signedOutN: "{n} ta sessiya yopildi",
    sessionPolicy: "Sessiya {i} daqiqa harakatsizlikdan soʻng va har holda {h} soatdan keyin tugaydi.",
    secEmail: "Email bildirishnomalar", provider: "Xizmat", recipient: "Qabul qiluvchi", sender: "Joʻnatuvchi", configured: "Sozlangan", notConfigured: "Sozlanmagan", testEmail: "Test xat yuborish",
    testOk: "Xat pochta xizmati tomonidan qabul qilindi. Kiruvchi (va spam) papkani tekshiring.", testFail: "Yuborib boʻlmadi: {e}",
    secTelegram: "Telegram bildirishnomalar", retryQueue: "Avto-urinishni kutmoqda", cronJob: "Kunlik qayta urinish",
    secBackup: "Zaxira nusxa", backupText: "Barcha buyurtmalarni (bildirishnoma holati bilan) JSON faylida yuklab oling. Uni maxfiy joyda saqlang.", backupBtn: "Zaxira nusxani yuklab olish",
    secAlerts: "Soʻnggi xavfsizlik ogohlantirishlari", noAlerts: "Ogohlantirish yoʻq.", secAudit: "Harakatlar jurnali", noAudit: "Hozircha boʻsh.",
    codesTitle: "Yangi zaxira kodlar", codesText: "Ularni hozir saqlang — eski kodlar endi ishlamaydi va bular qayta koʻrsatilmaydi."
  }
};
const LANG_HTML = { en: "en", ru: "ru", uz: "uz" };
const STATUSES = ["new", "contacted", "discussion", "inProgress", "done", "cancelled"];
const BIZ = ["restaurant", "hotel", "barber", "market", "clothing", "commerce", "other"];
const VIEWS = ["overview", "orders", "board", "security"];

let lang = (() => { try { return localStorage.getItem("wc-admin-lang") || ""; } catch { return ""; } })();
if (!I18N[lang]) lang = /^ru/i.test(navigator.language) ? "ru" : /^uz/i.test(navigator.language) ? "uz" : "en";

const t = (k, vars) => {
  let v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), I18N[lang]);
  if (v == null) v = k.split(".").reduce((o, p) => (o == null ? o : o[p]), I18N.en);
  if (typeof v === "string" && vars) v = v.replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? "");
  return v ?? k;
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------------ icons */
const IC = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1" fill="currentColor"/><circle cx="3.5" cy="12" r="1" fill="currentColor"/><circle cx="3.5" cy="18" r="1" fill="currentColor"/></svg>',
  board: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 6.5c-1-1.3-2.8-2-5-2-3 0-5 1.5-5 3.7 0 5 10 2.5 10 7.6 0 2.2-2 3.7-5 3.7-2.3 0-4.2-.8-5.2-2.2"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  tg: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3l-3.2 15.1c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.2-8.3c.4-.4-.1-.6-.6-.2L6.1 13 1.2 11.5c-1.1-.3-1.1-1.1.2-1.6L20.6 2.5c.9-.3 1.7.2 1.3 1.8z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3.5 20.5l1.3-4.4A8.5 8.5 0 1 1 8 19.3z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z" fill="currentColor" stroke="none"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9M10 20a2 2 0 0 0 4 0"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 18H2zM12 10v5M12 18v.5"/></svg>'
};

/* ------------------------------------------------------------------ API */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
    cache: "no-store"
  });
  const data = await res.json().catch(() => ({}));
  if (!opts.auth && res.status === 401 && data.error === "unauthorized") { showLogin(t("sessionEnd")); throw Object.assign(new Error("unauthorized"), { status: 401 }); }
  if (!opts.auth && res.status === 403 && data.error === "mfa_setup_required") { startEnroll(); throw Object.assign(new Error("unauthorized"), { status: 403 }); }
  if (!res.ok) { const e = new Error(data.error || "HTTP " + res.status); e.status = res.status; e.data = data; throw e; }
  return data;
}

/* ------------------------------------------------------------------ state */
const state = {
  view: "overview", status: "all", biz: "", q: "", from: "", to: "", failedOnly: false, page: 1,
  summary: null, list: null, board: [], security: null, auditPage: 1, audit: null,
  orderCache: new Map(), lastSync: 0, online: true, openId: null, knownIds: null, poll: null, setup: null
};

/* ------------------------------------------------------------------ language */
function applyLang() {
  document.documentElement.lang = LANG_HTML[lang];
  $$("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
  $$("[data-t-ph]").forEach((el) => { el.placeholder = t(el.dataset.tPh); });
  $$("[data-t-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.tAria)); });
  $$("[data-lang-switch]").forEach((box) => {
    box.innerHTML = Object.keys(I18N).map((k) => `<button type="button" data-l="${k}" aria-pressed="${k === lang}">${k.toUpperCase()}</button>`).join("");
  });
  $$(".yr").forEach((el) => { el.textContent = new Date().getFullYear(); });
  if (!$("#setup").hidden) renderSetup(state.setup);
  if (!$("#app").hidden) { renderNav(); render(); if (state.openId) openDrawer(state.openId, true); }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-l]");
  if (!b) return;
  lang = b.dataset.l;
  try { localStorage.setItem("wc-admin-lang", lang); } catch {}
  applyLang();
});

/* ------------------------------------------------------------------ gates */
function showOnly(id) { ["login", "setup", "enroll", "app"].forEach((x) => { $("#" + x).hidden = x !== id; }); }

function showLogin(msg, step = "password") {
  stopPolling();
  closeDrawer();
  state.orderCache.clear(); state.summary = state.list = state.security = state.audit = null; state.board = []; state.knownIds = null;
  showOnly("login");
  $("#login-form").hidden = step !== "password";
  $("#mfa-form").hidden = step !== "mfa";
  $("#login-err").textContent = step === "password" ? msg || "" : "";
  $("#mfa-err").textContent = step === "mfa" ? msg || "" : "";
  $("#pw").value = ""; $("#mfa-code").value = "";
  setTimeout(() => (step === "mfa" ? $("#mfa-code") : $("#pw")).focus(), 50);
}

function renderSetup(setup) {
  if (!setup) return;
  const item = (ok, title, text) => `<div class="setup-item ${ok ? "ok" : "miss"}"><span class="dot">${ok ? "✓" : "!"}</span><div><b>${esc(title)}</b><span>${ok ? "" : text}</span></div></div>`;
  // the setup texts are our own translations (they contain <code>), not user data
  $("#setup-list").innerHTML = item(setup.storage, t("setupStorage"), t("setupStorageText")) + item(setup.password, t("setupPw"), t("setupPwText")) + item(setup.secret, t("setupSecret"), t("setupSecretText"));
}

const loginError = (ex) => ex.status === 429 ? t("tooMany", { m: Math.max(1, Math.ceil((ex.data?.retryAfter || 60) / 60)) }) : ex.status === 401 ? t("wrongPassword") : t("netErr");

$("#pw-toggle").addEventListener("click", () => { const i = $("#pw"); i.type = i.type === "password" ? "text" : "password"; i.focus(); });

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#login-btn"), err = $("#login-err");
  if (!$("#pw").value) { $("#pw").focus(); return; }
  btn.disabled = true; err.textContent = "";
  try {
    const r = await api("/api/auth", { method: "POST", body: { action: "login", password: $("#pw").value }, auth: true });
    $("#pw").value = "";
    if (r.next === "mfa") showLogin("", "mfa");
    else if (r.next === "mfa-setup") startEnroll();
    else await enterApp();
  } catch (ex) {
    if (ex.status === 503 && ex.data?.setup) { state.setup = ex.data.setup; renderSetup(ex.data.setup); showOnly("setup"); return; }
    err.textContent = loginError(ex);
    $("#pw").select();
  } finally { btn.disabled = false; }
});

$("#mfa-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#mfa-btn"), err = $("#mfa-err"), code = $("#mfa-code").value.trim();
  if (!code) { $("#mfa-code").focus(); return; }
  btn.disabled = true; err.textContent = "";
  try {
    await api("/api/auth", { method: "POST", body: { action: "mfa", code }, auth: true });
    $("#mfa-code").value = "";
    await enterApp();
  } catch (ex) {
    if (ex.data?.error === "mfa_expired") { showLogin(t("mfaExpired")); return; }
    err.textContent = ex.status === 401 ? t("badCode") : loginError(ex);
    $("#mfa-code").select();
  } finally { btn.disabled = false; }
});
$("#mfa-back").addEventListener("click", () => showLogin());

/* ------------------------------------------------------------------ 2FA enrolment (required on first sign-in) */
let enrollCodes = [];
async function startEnroll() {
  stopPolling(); closeDrawer();
  showOnly("enroll");
  $("#enroll .gate-badge span").textContent = t("mfaSetupTitle");
  $("#enroll-step1").hidden = false; $("#enroll-step2").hidden = true;
  $("#enroll-err").textContent = ""; $("#enroll-code").value = "";
  try {
    const r = await api("/api/auth", { method: "POST", body: { action: "mfa-begin" }, auth: true });
    drawQr($("#enroll-qr"), r.uri);
    $("#enroll-secret").textContent = r.secret.replace(/(.{4})/g, "$1 ").trim();
  } catch (ex) {
    if (ex.status === 401) showLogin(t("sessionEnd")); else $("#enroll-err").textContent = t("netErr");
  }
}
function drawQr(box, text) {
  box.textContent = "";
  try {
    const qr = window.qrcode(0, "M");
    qr.addData(text); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); // library output, contains no user data
  } catch { box.hidden = true; }
}
$("#enroll-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#enroll-btn"), err = $("#enroll-err"), code = $("#enroll-code").value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) { err.textContent = t("badCode"); return; }
  btn.disabled = true; err.textContent = "";
  try {
    const r = await api("/api/auth", { method: "POST", body: { action: "mfa-confirm", code }, auth: true });
    showCodes(r.recoveryCodes);
  } catch (ex) {
    err.textContent = ex.status === 401 ? t("badCode") : ex.data?.error === "mfa_setup_expired" ? t("mfaExpired") : t("netErr");
    if (ex.data?.error === "mfa_setup_expired") startEnroll();
  } finally { btn.disabled = false; }
});
function showCodes(codes) {
  enrollCodes = codes;
  $("#enroll-step1").hidden = true; $("#enroll-step2").hidden = false;
  $("#enroll-codes").innerHTML = codes.map((c) => `<li>${esc(c)}</li>`).join("");
  $("#codes-saved").checked = false; $("#codes-done").disabled = true;
}
$("#codes-saved").addEventListener("change", (e) => { $("#codes-done").disabled = !e.target.checked; });
$("#codes-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(enrollCodes.join("\n")); toast(t("copied")); } catch {} });
$("#codes-dl").addEventListener("click", () => downloadText(enrollCodes.join("\n") + "\n", "webcreators-admin-recovery-codes.txt"));
$("#codes-done").addEventListener("click", () => { enrollCodes = []; $("#enroll-codes").textContent = ""; enterApp(); });

function downloadText(text, name, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$$("[data-logout]").forEach((b) => b.addEventListener("click", async () => {
  try { await api("/api/auth", { method: "DELETE", auth: true }); } catch {}
  showLogin();
}));

/* ------------------------------------------------------------------ boot */
async function boot() {
  applyLang();
  try {
    const s = await api("/api/auth", { auth: true });
    state.setup = s.setup;
    if (!s.setup.storage || !s.setup.password || !s.setup.secret) { renderSetup(s.setup); showOnly("setup"); return; }
    if (s.loggedIn) await enterApp();
    else if (s.stage === "enroll") startEnroll();
    else showLogin("", s.stage === "mfa" ? "mfa" : "password");
  } catch {
    showLogin(t("netErr"));
  }
}

async function enterApp() {
  showOnly("app");
  const hash = location.hash.replace("#", "");
  const deep = /^order=([a-z0-9]{6,32})$/.exec(hash);
  if (VIEWS.includes(hash)) state.view = hash;
  if (deep) state.view = "orders";
  renderNav();
  await load(true);
  startPolling();
  if (deep) openDrawer(deep[1]);
}

/* ------------------------------------------------------------------ data */
function listParams(extra = {}) {
  const p = new URLSearchParams({ view: "list", page: String(state.page), pageSize: "25" });
  if (state.status !== "all") p.set("status", state.status);
  if (state.biz) p.set("biz", state.biz);
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.from) p.set("from", state.from);
  if (state.to) p.set("to", state.to);
  if (state.failedOnly) p.set("notify", "failed");
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p;
}

async function load(first) {
  const btn = $("#refresh svg");
  btn && btn.classList.add("spin");
  try {
    // the summary drives the nav badge, the failure banner and new-order toasts on every view
    const summary = await api("/api/orders?view=summary");
    const fresh = state.knownIds ? summary.newest.filter((o) => !state.knownIds.has(o.id)) : [];
    state.knownIds = new Set(summary.newest.map((o) => o.id));
    state.summary = summary;
    if (state.view === "orders") state.list = await api("/api/orders?" + listParams());
    if (state.view === "board") state.board = (await api("/api/orders?view=board")).orders;
    if (state.view === "security") await loadSecurity();
    state.online = true;
    state.lastSync = Date.now();
    fresh.slice(0, 3).forEach((o) => toast(t("newOrder", { name: o.name }), "bell"));
    if (fresh.length) ping();
    renderNav();
    render(first);
  } catch (e) {
    if (e.message !== "unauthorized") { state.online = false; renderSync(); }
  } finally {
    setTimeout(() => btn && btn.classList.remove("spin"), 300);
  }
}
async function loadSecurity() {
  const [sec, audit] = await Promise.all([api("/api/admin?section=security"), api("/api/admin?section=audit&page=" + state.auditPage)]);
  state.security = sec; state.audit = audit;
}
async function reloadList() {
  try { state.list = await api("/api/orders?" + listParams()); render(); } catch (e) { if (e.message !== "unauthorized") toast(t("netErr"), "warn", true); }
}
function startPolling() { stopPolling(); state.poll = setInterval(() => { if (!document.hidden) load(); renderSync(); }, 20000); }
function stopPolling() { clearInterval(state.poll); state.poll = null; }
document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#app").hidden) load(); });
$("#refresh").addEventListener("click", () => load());

function ping() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(880, ctx.currentTime); o.frequency.setValueAtTime(1320, ctx.currentTime + .12);
    g.gain.setValueAtTime(.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.12, ctx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .35);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .4);
  } catch {}
}

/* ------------------------------------------------------------------ helpers */
const fmtMoney = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
const locale = () => ({ en: "en-GB", ru: "ru-RU", uz: "uz-Latn-UZ" }[lang]);
function fmtDate(ts, withTime = true) {
  const d = new Date(ts);
  try { return d.toLocaleString(locale(), withTime ? { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined, hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }); }
  catch { return d.toLocaleString(); }
}
function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (Math.abs(s) < 45) return t("justNow");
  try {
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
    const a = Math.abs(s), sign = s > 0 ? -1 : 1;
    if (a < 3600) return rtf.format(sign * Math.round(a / 60), "minute");
    if (a < 86400) return rtf.format(sign * Math.round(a / 3600), "hour");
    return rtf.format(sign * Math.round(a / 86400), "day");
  } catch { return fmtDate(ts); }
}
const initials = (n) => String(n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const pill = (s) => `<span class="pill st-${esc(s)}"><i></i>${esc(t("st." + s))}</span>`;
const nbadge = (s) => s ? `<span class="nb ${esc(s)}">${esc(t("nb." + s))}</span>` : `<span class="dim">—</span>`;
const bizLabel = (o) => (o.businessKey && I18N.en.biz[o.businessKey]) ? t("biz." + o.businessKey) : o.business;
const label = (o) => o.label || (o.number ? "WC-" + String(o.number).padStart(4, "0") : o.id);
const digits = (p) => {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;          // local Uzbek number without country code
  if (d.length === 10 && d[0] === "8") d = "998" + d.slice(1);
  return d;
};

function renderSync() {
  const el = $("#sync");
  if (!el) return;
  el.classList.toggle("off", !state.online);
  $("#sync-text").textContent = state.online ? t("synced", { t: ago(state.lastSync) }) : t("offline");
}

/* ------------------------------------------------------------------ nav */
function renderNav() {
  const unseen = state.summary ? state.summary.counts.new : 0;
  const items = [["overview", IC.grid], ["orders", IC.list], ["board", IC.board], ["security", IC.shield]];
  const html = items.map(([k, ic]) => `<button class="nav-btn" type="button" data-view="${k}" ${state.view === k ? 'aria-current="page"' : ""}>${ic}<span>${esc(t(k))}</span>${k === "orders" && unseen ? `<span class="count">${unseen}</span>` : ""}</button>`).join("");
  $("#side-nav").innerHTML = html;
  $("#m-nav").innerHTML = html;
  document.title = (unseen ? `(${unseen}) ` : "") + t("adminPanel") + " — WEB-CREATORS";
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-view]");
  if (!b) return;
  state.view = b.dataset.view;
  if (b.dataset.status) { state.status = b.dataset.status; state.page = 1; }
  if (b.dataset.failed) { state.failedOnly = true; state.status = "all"; state.page = 1; }
  history.replaceState(null, "", "#" + state.view);
  renderNav();
  render(true);
  load();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

let searchTimer;
$("#search").addEventListener("input", (e) => {
  state.q = e.target.value;
  state.page = 1;
  if (state.view !== "orders") { state.view = "orders"; history.replaceState(null, "", "#orders"); renderNav(); }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(reloadList, 250);
});

/* ------------------------------------------------------------------ views */
function render(animate) {
  $("#view-title").textContent = t(state.view);
  $("#view-sub").textContent = t(state.view + "Sub");
  $("#export").hidden = state.view === "security";
  $(".search").hidden = state.view === "security";
  renderSync();
  const v = $("#view");
  v.className = animate ? "view" : "";
  if (animate) { v.offsetWidth; }
  const banner = failureBanner();
  if (state.view === "overview") v.innerHTML = banner + viewOverview();
  else if (state.view === "orders") v.innerHTML = banner + viewOrders();
  else if (state.view === "board") v.innerHTML = banner + viewBoard();
  else v.innerHTML = viewSecurity();
  if (state.view === "overview") drawChart();
  if (state.view === "board") wireBoard();
}

function failureBanner() {
  const n = state.summary?.notifyFailed || 0;
  if (!n || (state.view === "orders" && state.failedOnly)) return "";
  return `<div class="banner">${IC.warn}<span class="grow">${esc(t("notifyBanner", { n }))}</span><button class="btn btn-ghost" type="button" data-view="orders" data-failed="1">${esc(t("review"))}</button></div>`;
}

function viewOverview() {
  const S = state.summary;
  if (!S) return "";
  const c = S.counts;
  const inProgress = c.contacted + c.discussion + c.inProgress;
  const conv = S.total ? Math.round((c.done / S.total) * 100) : 0;
  const kpi = (labelTxt, val, hint, ic, cls, delay) => `<div class="kpi glass ${cls || ""}" style="animation-delay:${delay}ms"><div class="kpi-top"><span class="kpi-label">${esc(labelTxt)}</span><span class="kpi-ico">${ic}</span></div><div class="kpi-val">${val}</div><div class="kpi-hint">${esc(hint)}</div></div>`;
  const counts = BIZ.map((k) => [k, S.byBiz[k] || 0]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const maxB = Math.max(1, ...counts.map((x) => x[1]));
  const recent = S.recent;

  return `
  <div class="kpis">
    ${kpi(t("kTotal"), S.total, t("kTotalHint", { n: S.week }), IC.inbox, "hero", 0)}
    ${kpi(t("kNew"), c.new, t("kNewHint"), IC.spark, "", 30)}
    ${kpi(t("kProgress"), inProgress, t("kProgressHint"), IC.clock, "", 60)}
    ${kpi(t("kDone"), c.done, t("kDoneHint"), IC.check, "", 90)}
    ${kpi(t("kCancelled"), c.cancelled, t("kCancelledHint"), IC.ban, "", 120)}
    ${kpi(t("kNotify"), S.notifyFailed, S.notifyFailed ? t("kNotifyHint") : t("kNotifyOk"), IC.mail, "", 150)}
    ${kpi(t("kRevenue"), fmtMoney(S.revenue), t("kRevenueHint"), IC.dollar, "", 180)}
    ${kpi(t("kConv"), conv + "%", t("kConvHint"), IC.trend, "", 210)}
  </div>
  <div class="grid2">
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("chart30"))}</h2><span class="dim" id="chart-total"></span></div>
      <div class="chart" id="chart"></div>
    </section>
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("byBiz"))}</h2></div>
      ${counts.length ? `<div class="hbars">${counts.map(([k, n]) => `<div class="hbar-row"><span class="nm">${esc(t("biz." + k))}</span><div class="hbar"><span style="width:${(n / maxB) * 100}%"></span></div><span class="val">${n}</span></div>`).join("")}</div>` : emptyBlock()}
    </section>
  </div>
  <section class="panel glass">
    <div class="panel-h"><h2>${esc(t("recent"))}</h2>${S.total ? `<button class="chip" type="button" data-view="orders" data-status="all">${esc(t("viewAll"))}</button>` : ""}</div>
    ${recent.length ? `<div class="recent">${recent.map((o) => `
      <button type="button" data-open="${esc(o.id)}" class="${o.seen ? "" : "unseen"}">
        <span class="avatar">${esc(initials(o.name))}</span>
        <span class="who"><b>${esc(o.name)}</b><span>${esc(label(o))} · ${esc(bizLabel(o))} · ${esc(ago(o.createdAt))}</span></span>
        ${pill(o.status)}
      </button>`).join("")}</div>` : emptyBlock()}
  </section>`;
}

function emptyBlock(filteredTxt) {
  return `<div class="empty">${IC.inbox}<b>${esc(filteredTxt ? t("noMatch") : t("emptyTitle"))}</b>${filteredTxt ? "" : esc(t("emptyText"))}</div>`;
}

function viewOrders() {
  const L = state.list;
  const counts = L ? L.statusCounts : { all: 0 };
  const chips = ["all", ...STATUSES].map((s) => `<button class="chip" type="button" data-status-filter="${s}" aria-pressed="${state.status === s}">${esc(s === "all" ? t("all") : t("st." + s))}<span class="n">${counts[s] ?? 0}</span></button>`).join("");
  const bizSel = `<select class="select" id="biz-filter" aria-label="${esc(t("colBiz"))}"><option value="">${esc(t("allBiz"))}</option>${BIZ.map((k) => `<option value="${k}" ${state.biz === k ? "selected" : ""}>${esc(t("biz." + k))}</option>`).join("")}</select>`;
  const dates = `<label class="dim">${esc(t("from"))} <input class="input" type="date" id="f-from" value="${esc(state.from)}"></label><label class="dim">${esc(t("to"))} <input class="input" type="date" id="f-to" value="${esc(state.to)}"></label>`;
  const failed = `<button class="chip" type="button" id="f-failed" aria-pressed="${state.failedOnly}">${IC.warn.replace("<svg", '<svg width="14" height="14"')}${esc(t("failedOnly"))}</button>`;
  const anyFilter = state.status !== "all" || state.biz || state.from || state.to || state.failedOnly || state.q;
  const clear = anyFilter ? `<button class="chip" type="button" id="f-clear">${esc(t("clear"))}</button>` : "";
  const list = L ? L.orders : [];

  let body;
  if (!L) body = "";
  else if (!list.length) body = `<div class="glass">${emptyBlock(counts.all ? "filtered" : "")}</div>`;
  else body = `
    <div class="table-wrap glass">
      <table>
        <thead><tr><th>${esc(t("colOrder"))}</th><th>${esc(t("colClient"))}</th><th>${esc(t("colBiz"))}</th><th>${esc(t("colBudget"))}</th><th>${esc(t("colStatus"))}</th><th>${esc(t("colNotify"))}</th><th>${esc(t("colDate"))}</th></tr></thead>
        <tbody>${list.map((o) => `
          <tr data-open="${esc(o.id)}" tabindex="0">
            <td class="num dim">${esc(label(o))}</td>
            <td><div class="cl ${o.seen ? "" : "unseen"}"><span class="avatar">${esc(initials(o.name))}</span><div><b>${esc(o.name)}</b><span class="num">${esc(o.phone)}</span></div></div></td>
            <td>${esc(bizLabel(o))}</td>
            <td class="num">${o.price != null ? `<span class="ok-txt">${fmtMoney(o.price)}</span>` : esc(o.budget)}</td>
            <td>${pill(o.status)}</td>
            <td>${nbadge(o.notify)}</td>
            <td class="dim num" title="${esc(fmtDate(o.createdAt))}">${esc(fmtDate(o.createdAt))}</td>
          </tr>`).join("")}</tbody>
      </table>
      <div class="cards">${list.map((o) => `
        <button type="button" class="ocard glass" data-open="${esc(o.id)}">
          <div class="ocard-top"><div class="cl ${o.seen ? "" : "unseen"}"><span class="avatar">${esc(initials(o.name))}</span><div><b>${esc(o.name)}</b><span class="num">${esc(o.phone)}</span></div></div>${pill(o.status)}</div>
          <div class="ocard-meta"><span>${esc(label(o))}</span><span>${esc(bizLabel(o))}</span><span>${esc(o.price != null ? fmtMoney(o.price) : o.budget)}</span><span>${esc(fmtDate(o.createdAt))}</span>${o.notify === "failed" ? nbadge("failed") : ""}</div>
        </button>`).join("")}</div>
    </div>
    <div class="pager"><span>${esc(t("pageOf", { a: (L.page - 1) * L.pageSize + 1, b: (L.page - 1) * L.pageSize + list.length, n: L.total }))}</span>
      <span class="btns"><button class="btn btn-ghost" type="button" data-page="${L.page - 1}" ${L.page <= 1 ? "disabled" : ""}>${esc(t("prev"))}</button><button class="btn btn-ghost" type="button" data-page="${L.page + 1}" ${L.page >= L.pages ? "disabled" : ""}>${esc(t("next"))}</button></span></div>`;
  return `<div class="filters">${chips}</div><div class="filters">${bizSel}${dates}${failed}${clear}</div>${body}`;
}

document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-status-filter]");
  if (c) { state.status = c.dataset.statusFilter; state.page = 1; reloadList(); return; }
  const p = e.target.closest("[data-page]");
  if (p && !p.disabled) { state.page = Number(p.dataset.page); reloadList(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  if (e.target.closest("#f-failed")) { state.failedOnly = !state.failedOnly; state.page = 1; reloadList(); return; }
  if (e.target.closest("#f-clear")) {
    Object.assign(state, { status: "all", biz: "", from: "", to: "", failedOnly: false, q: "", page: 1 });
    $("#search").value = ""; reloadList();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "biz-filter") { state.biz = e.target.value; state.page = 1; reloadList(); }
  if (e.target.id === "f-from") { state.from = e.target.value; state.page = 1; reloadList(); }
  if (e.target.id === "f-to") { state.to = e.target.value; state.page = 1; reloadList(); }
});

function viewBoard() {
  const list = state.board;
  return `<div class="board">${STATUSES.map((s) => {
    const items = list.filter((o) => o.status === s);
    return `<section class="col glass" data-col="${s}">
      <div class="col-h">${pill(s)}<span class="n">${items.length}</span></div>
      <div class="col-body">${items.map((o) => `
        <button type="button" class="kcard" draggable="true" data-open="${esc(o.id)}" data-id="${esc(o.id)}">
          <b>${esc(o.name)}</b>
          <span class="biz">${esc(label(o))} · ${esc(bizLabel(o))}</span>
          <span class="meta"><span class="num">${esc(o.phone)}</span>${o.price != null ? `<span class="price">${fmtMoney(o.price)}</span>` : `<span>${esc(ago(o.createdAt))}</span>`}</span>
        </button>`).join("")}</div>
    </section>`;
  }).join("")}</div>`;
}

function wireBoard() {
  let dragId = null;
  $$(".kcard").forEach((c) => {
    c.addEventListener("dragstart", (e) => { dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
    c.addEventListener("dragend", () => c.classList.remove("dragging"));
  });
  $$(".col").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop"); });
    col.addEventListener("drop", async (e) => {
      e.preventDefault(); col.classList.remove("drop");
      const id = e.dataTransfer.getData("text/plain") || dragId;
      const o = state.board.find((x) => x.id === id);
      if (!o || o.status === col.dataset.col) return;
      await patch(id, { status: col.dataset.col });
    });
  });
}

/* ------------------------------------------------------------------ security view */
function viewSecurity() {
  const S = state.security, A = state.audit;
  if (!S) return "";
  const row = (k, v) => `<div><span>${esc(k)}</span><span>${v}</span></div>`;
  const yes = (b, okTxt = t("configured"), noTxt = t("notConfigured")) => b ? `<span class="ok-txt">${esc(okTxt)}</span>` : `<span class="err-txt">${esc(noTxt)}</span>`;
  const auditRows = A && A.entries.length ? A.entries.map((e) => `<div><time>${esc(fmtDate(e.at))}</time><span><code>${esc(e.action)}</code> ${esc(e.target || "")} ${e.details ? `<span class="dim">${esc(JSON.stringify(e.details))}</span>` : ""} <span class="dim">${esc(e.country || "")}</span></span></div>`).join("") : `<p class="dim">${esc(t("noAudit"))}</p>`;
  return `
  <div class="sec-grid">
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("secMfa"))}</h2>${yes(S.mfa.enabled, t("mfaOn"), t("mfaOff"))}</div>
      <div class="kv">
        ${S.mfa.enabledAt ? row(t("mfaSince"), esc(fmtDate(S.mfa.enabledAt))) : ""}
        ${row(t("recLeft"), `<span class="${S.mfa.recoveryLeft < 3 ? "err-txt" : ""}">${S.mfa.recoveryLeft}</span>`)}
      </div>
      <div class="btn-row"><button class="btn btn-ghost" type="button" id="sec-reset">${esc(t("mfaReset"))}</button><button class="btn btn-ghost" type="button" id="sec-codes">${esc(t("newCodes"))}</button></div>
    </section>
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("secSessions"))}</h2><span class="dim">${S.sessions.length}</span></div>
      <div class="list-plain">${S.sessions.map((x) => `<div><time>${esc(ago(x.lastSeen))}</time><span>${x.current ? `<b class="ok-txt">${esc(t("thisDevice"))}</b> · ` : ""}${esc([x.city, x.country].filter(Boolean).join(", ") || "—")} · <span class="dim">${esc(x.ua.slice(0, 80))}</span></span></div>`).join("")}</div>
      <p class="hint">${esc(t("sessionPolicy", { i: S.sessionPolicy.idleMinutes, h: S.sessionPolicy.maxHours }))}</p>
      <div class="btn-row"><button class="btn btn-ghost" type="button" id="sec-others" ${S.sessions.length < 2 ? "disabled" : ""}>${esc(t("signOutOthers"))}</button></div>
    </section>
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("secEmail"))}</h2>${yes(S.email.configured)}</div>
      <div class="kv">
        ${row(t("provider"), esc(S.email.provider))}
        ${row(t("recipient"), esc(S.email.to.join(", ") || "—"))}
        ${row(t("sender"), esc(S.email.from || "—"))}
        ${row(t("secTelegram"), yes(S.telegram.configured))}
        ${row(t("retryQueue"), String(S.retryQueue))}
        ${row(t("cronJob"), yes(S.cron.configured))}
      </div>
      <div class="btn-row"><button class="btn btn-ghost" type="button" id="sec-test" ${S.email.configured ? "" : "disabled"}>${IC.mail.replace("<svg", '<svg width="16" height="16"')}${esc(t("testEmail"))}</button></div>
    </section>
    <section class="panel glass">
      <div class="panel-h"><h2>${esc(t("secBackup"))}</h2></div>
      <p class="muted small">${esc(t("backupText"))}</p>
      <div class="btn-row"><a class="btn btn-ghost" href="/api/admin?section=backup" download>${esc(t("backupBtn"))}</a></div>
    </section>
  </div>
  <section class="panel glass" style="margin-bottom:16px">
    <div class="panel-h"><h2>${esc(t("secAlerts"))}</h2></div>
    ${S.alerts.length ? `<div class="list-plain">${S.alerts.map((a) => `<div><time>${esc(fmtDate(a.at))}</time><span><b>${esc(a.subject)}</b> <span class="dim">${esc((a.lines || []).join(" "))}</span></span></div>`).join("")}</div>` : `<p class="dim">${esc(t("noAlerts"))}</p>`}
  </section>
  <section class="panel glass">
    <div class="panel-h"><h2>${esc(t("secAudit"))}</h2></div>
    <div class="list-plain">${auditRows}</div>
    ${A && A.pages > 1 ? `<div class="pager"><span>${A.page} / ${A.pages}</span><span class="btns"><button class="btn btn-ghost" type="button" data-audit-page="${A.page - 1}" ${A.page <= 1 ? "disabled" : ""}>${esc(t("prev"))}</button><button class="btn btn-ghost" type="button" data-audit-page="${A.page + 1}" ${A.page >= A.pages ? "disabled" : ""}>${esc(t("next"))}</button></span></div>` : ""}
  </section>`;
}

document.addEventListener("click", async (e) => {
  const ap = e.target.closest("[data-audit-page]");
  if (ap && !ap.disabled) { state.auditPage = Number(ap.dataset.auditPage); try { state.audit = await api("/api/admin?section=audit&page=" + state.auditPage); render(); } catch {} return; }
  if (e.target.closest("#sec-test")) {
    try {
      const r = await api("/api/admin", { method: "POST", body: { action: "test-email" } });
      if (r.ok) toast(t("testOk"), "check"); else toast(t("testFail", { e: r.error || "" }), "warn", true);
      load();
    } catch (ex) { if (ex.message !== "unauthorized") toast(t("testFail", { e: ex.message }), "warn", true); }
    return;
  }
  if (e.target.closest("#sec-others")) {
    try { const r = await api("/api/auth", { method: "POST", body: { action: "logout-others" } }); toast(t("signedOutN", { n: r.signedOut })); load(); } catch {}
    return;
  }
  if (e.target.closest("#sec-codes")) {
    const code = await askCode();
    if (!code) return;
    try {
      const r = await api("/api/auth", { method: "POST", body: { action: "recovery-codes", code } });
      showCodesDialog(r.recoveryCodes); load();
    } catch (ex) { if (ex.status === 401) toast(t("badCode"), "warn", true); }
    return;
  }
  if (e.target.closest("#sec-reset")) {
    const code = await askCode();
    if (!code) return;
    try {
      const r = await api("/api/auth", { method: "POST", body: { action: "mfa-begin", code } });
      stopPolling(); closeDrawer(); showOnly("enroll");
      $("#enroll .gate-badge span").textContent = t("mfaSetupTitle");
      $("#enroll-step1").hidden = false; $("#enroll-step2").hidden = true; $("#enroll-err").textContent = ""; $("#enroll-code").value = "";
      drawQr($("#enroll-qr"), r.uri);
      $("#enroll-secret").textContent = r.secret.replace(/(.{4})/g, "$1 ").trim();
    } catch (ex) { if (ex.status === 401) toast(t("badCode"), "warn", true); }
  }
});

function askCode() {
  const d = $("#prompt");
  $("#prompt-title").textContent = t("askCode");
  $("#prompt-text").textContent = t("askCodeText");
  $("#prompt-input").value = "";
  return new Promise((resolve) => {
    const done = (v) => { d.removeEventListener("close", onClose); $("#prompt-form").removeEventListener("click", onClick); resolve(v); };
    const onClose = () => done(d.returnValue === "yes" ? $("#prompt-input").value.trim() : "");
    const onClick = (e) => { const b = e.target.closest("button[value=no]"); if (b) d.close("no"); };
    d.addEventListener("close", onClose);
    $("#prompt-form").addEventListener("click", onClick);
    d.returnValue = "";
    d.showModal();
    setTimeout(() => $("#prompt-input").focus(), 30);
  });
}
$("#prompt-form").addEventListener("submit", (e) => { e.preventDefault(); $("#prompt").close("yes"); });

function showCodesDialog(codes) {
  showOnly("enroll");
  stopPolling();
  showCodes(codes);
  $("#enroll .gate-badge span").textContent = t("codesTitle");
}

/* ------------------------------------------------------------------ chart: orders per day, last 30 days */
function drawChart() {
  const box = $("#chart");
  if (!box || !state.summary) return;
  const days = 30, W = box.clientWidth || 600, H = box.clientHeight || 220;
  const pad = { l: 28, r: 6, t: 14, b: 24 };
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
  const buckets = Array.from({ length: days }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return { d, n: 0 }; });
  state.summary.days.forEach((ts) => {
    const i = Math.floor((new Date(ts).setHours(0, 0, 0, 0) - start.getTime()) / 864e5);
    if (i >= 0 && i < days) buckets[i].n++;
  });
  const total = buckets.reduce((s, b) => s + b.n, 0);
  $("#chart-total").textContent = total + " · " + t("orders").toLowerCase();
  const max = Math.max(3, ...buckets.map((b) => b.n));
  const niceMax = Math.ceil(max / 2) * 2;
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const step = iw / days, bw = Math.max(3, Math.min(18, step - 4));
  const y = (v) => pad.t + ih - (v / niceMax) * ih;
  const ticks = [0, niceMax / 2, niceMax];
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("chart30"))}"><defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#62A4FF"/><stop offset="1" stop-color="#1B5BD8"/></linearGradient></defs><g class="grid">`;
  ticks.forEach((v) => { svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
  svg += `</g>`;
  buckets.forEach((b, i) => {
    const x = pad.l + i * step + (step - bw) / 2;
    if (b.n) {
      const h = Math.max(4, ih * (b.n / niceMax)), top = pad.t + ih - h, r = Math.min(4, bw / 2);
      svg += `<path class="bar" data-i="${i}" d="M${x},${pad.t + ih} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${pad.t + ih} Z"/>`;
    }
    if ((i % 7 === 0 && i <= days - 5) || i === days - 1) svg += `<text class="axis" x="${pad.l + i * step + step / 2}" y="${H - 6}" text-anchor="middle">${esc(fmtDate(b.d, false))}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="${pad.l + i * step}" y="${pad.t}" width="${step}" height="${ih}"/>`;
  });
  svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}" stroke="rgba(130,165,255,.25)"/></svg><div class="tip" id="tip"></div>`;
  box.innerHTML = svg;
  const tip = $("#tip", box);
  $$(".hit", box).forEach((r) => {
    const i = +r.dataset.i, b = buckets[i];
    r.addEventListener("mouseenter", () => {
      $$(".bar", box).forEach((p) => p.classList.toggle("hot", +p.dataset.i === i));
      tip.innerHTML = `<b>${b.n}</b>${esc(fmtDate(b.d, false))}`;
      tip.style.left = (pad.l + i * step + step / 2) + "px";
      tip.style.top = (y(b.n) - 8) + "px";
      tip.style.opacity = 1;
    });
    r.addEventListener("mouseleave", () => { tip.style.opacity = 0; $$(".bar", box).forEach((p) => p.classList.remove("hot")); });
  });
}
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (state.view === "overview" && !$("#app").hidden) drawChart(); }, 150); });

/* ------------------------------------------------------------------ drawer */
document.addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]");
  if (o && !e.target.closest(".drawer")) openDrawer(o.dataset.open);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("tr[data-open]")) openDrawer(e.target.dataset.open);
  if (e.key === "Escape" && state.openId && !$("#confirm").open && !$("#prompt").open) closeDrawer();
});
$("#scrim").addEventListener("click", closeDrawer);

let lastFocus = null;
async function openDrawer(id, keepDraft) {
  let detail = state.orderCache.get(id);
  if (!keepDraft || !detail) {
    try { detail = await api("/api/order?id=" + encodeURIComponent(id)); }
    catch (e) { if (e.message !== "unauthorized") toast(t("netErr"), "warn", true); return; }
    state.orderCache.set(id, detail);
  }
  renderDrawer(detail, keepDraft);
}

function historyItems(detail) {
  const o = detail.order;
  const items = [{ at: o.createdAt, html: `${pill("new")}<span>${esc(t("created"))}</span>` }];
  (o.history || []).forEach((h) => items.push({ at: h.at, html: pill(h.to) }));
  (detail.history || []).forEach((h) => {
    if (h.action === "order.updated" && h.details && !h.details.status) items.push({ at: h.at, html: `<span>${esc(t("hChanged"))}: ${esc(Object.keys(h.details).map((k) => t(k === "notes" ? "notes" : k === "price" ? "price" : k)).join(", "))}</span>` });
    if (/^order\.notify_/.test(h.action)) items.push({ at: h.at, html: `<span>${esc(t("hNotify"))}: ${esc(Object.values(h.details || {}).join(" · "))}</span>` });
  });
  return items.sort((a, b) => b.at - a.at);
}

function notifyBlock(n) {
  if (!n.recorded) return `<div class="notify-box"><span class="dim">${esc(t("nLegacy"))}</span><div class="notify-row"><button class="btn btn-ghost" type="button" id="dr-retry">${esc(t("retry"))}</button></div></div>`;
  const ch = (name, c) => `<div class="notify-row"><b>${esc(t(name === "email" ? "nEmail" : "nTelegram"))}</b>${nbadge(c.status)}
    ${c.attempts ? `<span class="dim">${esc(t("nAttempts", { n: c.attempts }))}</span>` : ""}
    ${c.sentAt ? `<span class="dim">${esc(fmtDate(c.sentAt))}</span>` : ""}
    ${c.status === "failed" && c.nextRetryAt ? `<span class="dim">${esc(t("nNext", { t: ago(c.nextRetryAt) }))}</span>` : ""}
    ${c.lastError && c.status !== "sent" ? `<span class="err">${esc(c.lastError)}</span>` : ""}</div>`;
  const anyFailed = ["email", "telegram"].some((k) => ["failed", "pending"].includes(n[k].status));
  const anySent = ["email", "telegram"].some((k) => n[k].status === "sent");
  return `<div class="notify-box">${ch("email", n.email)}${n.telegramConfigured || n.telegram.status === "sent" ? ch("telegram", n.telegram) : ""}
    ${!n.emailConfigured ? `<span class="dim">${esc(t("notConfiguredHint"))}</span>` : ""}
    <div class="notify-row">${anyFailed ? `<button class="btn btn-primary" type="button" id="dr-retry">${esc(t("retry"))}</button>` : ""}${anySent ? `<button class="btn btn-ghost" type="button" id="dr-resend">${esc(t("resend"))}</button>` : ""}</div></div>`;
}

function renderDrawer(detail, keepDraft) {
  const o = detail.order;
  const draft = keepDraft && state.openId === o.id ? { status: $("#dr-status [aria-pressed=true]")?.dataset.s, price: $("#dr-price")?.value, notes: $("#dr-notes")?.value } : null;
  if (!keepDraft && !state.openId) lastFocus = document.activeElement;
  state.openId = o.id;
  history.replaceState(null, "", "#order=" + o.id);
  const d = digits(o.phone);
  const cur = draft?.status || o.status;
  $("#drawer").innerHTML = `
    <div class="dr-head">
      <span class="avatar">${esc(initials(o.name))}</span>
      <div class="grow"><h2 id="dr-name">${esc(o.name)}</h2><p class="sub">${esc(label(o))} · ${esc(fmtDate(o.createdAt))} · ${esc(ago(o.createdAt))}</p></div>
      <button class="icon-btn" type="button" id="dr-close" aria-label="${esc(t("close"))}">${IC.x}</button>
    </div>
    <div class="dr-body">
      <div class="quick">
        <a href="tel:+${d}">${IC.phone}${esc(t("call"))}</a>
        <a href="https://t.me/+${d}" target="_blank" rel="noopener noreferrer">${IC.tg}${esc(t("telegram"))}</a>
        <a href="https://wa.me/${d}" target="_blank" rel="noopener noreferrer">${IC.wa}${esc(t("whatsapp"))}</a>
        <button type="button" id="dr-copy">${IC.copy}${esc(t("copy"))}</button>
      </div>
      <div>
        <span class="label">${esc(t("status"))}</span>
        <div class="seg" id="dr-status">${STATUSES.map((s) => `<button type="button" class="st-${s}" data-s="${s}" aria-pressed="${s === cur}">${esc(t("st." + s))}</button>`).join("")}</div>
      </div>
      <div>
        <span class="label">${esc(t("details"))}</span>
        <div class="facts">
          <div class="fact"><small>${esc(t("fNumber"))}</small><span class="num">${esc(label(o))}</span></div>
          <div class="fact"><small>${esc(t("colClient"))}</small><span class="num">${esc(o.phone)}</span></div>
          <div class="fact"><small>${esc(t("fBiz"))}</small><span>${esc(bizLabel(o))}</span></div>
          <div class="fact"><small>${esc(t("fBudget"))}</small><span>${esc(o.budget)}</span></div>
          <div class="fact"><small>${esc(t("fLang"))}</small><span>${esc(o.language || "—")}</span></div>
          <div class="fact"><small>${esc(t("fDate"))}</small><span>${esc(fmtDate(o.createdAt))}</span></div>
          <div class="fact"><small>${esc(t("fId"))}</small><span class="num">${esc(o.id)}</span></div>
          <div class="fact"><small>${esc(t("fPage"))}</small><span>${esc(o.page || "—")}</span></div>
        </div>
      </div>
      ${o.message && o.message !== "—" ? `<div><span class="label">${esc(t("message"))}</span><div class="msgbox">${esc(o.message)}</div></div>` : ""}
      <div>
        <span class="label">${esc(t("notifications"))}</span>
        ${notifyBlock(detail.notify)}
      </div>
      <div>
        <label class="label" for="dr-price">${esc(t("price"))}</label>
        <div class="money"><span>$</span><input class="input num" id="dr-price" type="number" inputmode="decimal" min="0" step="1" placeholder="${esc(t("pricePh"))}" value="${esc(draft ? draft.price : (o.price ?? ""))}"></div>
      </div>
      <div>
        <label class="label" for="dr-notes">${esc(t("notes"))}</label>
        <textarea class="textarea" id="dr-notes" rows="4" maxlength="4000" placeholder="${esc(t("notesPh"))}">${esc(draft ? draft.notes : (o.notes || ""))}</textarea>
      </div>
      <div>
        <span class="label">${esc(t("history"))}</span>
        <div class="timeline">${historyItems(detail).map((h) => `<div>${h.html}<time>${esc(fmtDate(h.at))}</time></div>`).join("")}</div>
      </div>
    </div>
    <div class="dr-foot">
      <button class="btn btn-danger" type="button" id="dr-delete">${esc(t("delete"))}</button>
      <span class="grow"></span>
      <button class="btn btn-primary" type="button" id="dr-save">${IC.check}${esc(t("save"))}</button>
    </div>`;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("open");
  document.body.style.overflow = "hidden";
  if (!keepDraft) setTimeout(() => $("#dr-close")?.focus(), 50);

  $("#dr-close").addEventListener("click", closeDrawer);
  $("#dr-copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText(o.phone); toast(t("copied"), "check"); } catch {} });
  $$("#dr-status button").forEach((b) => b.addEventListener("click", () => $$("#dr-status button").forEach((x) => x.setAttribute("aria-pressed", x === b))));
  $("#dr-save").addEventListener("click", async () => {
    const status = $("#dr-status [aria-pressed=true]").dataset.s;
    const price = $("#dr-price").value.trim();
    const ok = await patch(o.id, { status, price: price === "" ? null : Number(price), notes: $("#dr-notes").value });
    if (ok) { toast(t("saved"), "check"); closeDrawer(); }
  });
  $("#dr-delete").addEventListener("click", async () => {
    if (!(await confirmDialog(t("deleteQ"), t("deleteText"), t("delete")))) return;
    try {
      await api("/api/order?id=" + encodeURIComponent(o.id), { method: "DELETE" });
      state.orderCache.delete(o.id);
      closeDrawer(); toast(t("deleted"), "check"); load();
    } catch (e) { if (e.message !== "unauthorized") toast(t("saveErr"), "warn", true); }
  });
  const notifyAction = async (force) => {
    if (force && !(await confirmDialog(t("resendQ"), t("resendText"), t("resend")))) return;
    $$("#dr-retry,#dr-resend").forEach((b) => { b.disabled = true; });
    try {
      const r = await api("/api/order?id=" + encodeURIComponent(o.id), { method: "POST", body: { action: "notify", force } });
      detail.notify = r.notify;
      toast(t("retried"), "check");
      openDrawer(o.id); load();
    } catch (e) {
      if (e.status === 409 || e.status === 429) toast(t("alreadySending"), "warn", true);
      else if (e.message !== "unauthorized") toast(t("saveErr"), "warn", true);
      $$("#dr-retry,#dr-resend").forEach((b) => { b.disabled = false; });
    }
  };
  $("#dr-retry")?.addEventListener("click", () => notifyAction(false));
  $("#dr-resend")?.addEventListener("click", () => notifyAction(true));

  if (!o.seen) {
    o.seen = true;
    api("/api/order?id=" + encodeURIComponent(o.id), { method: "PATCH", body: { seen: true } }).then(() => load()).catch(() => {});
  }
}

function closeDrawer() {
  if (!state.openId) return;
  state.openId = null;
  if (/^#order=/.test(location.hash)) history.replaceState(null, "", "#" + state.view);
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("open");
  document.body.style.overflow = "";
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

// focus trap inside drawer
$("#drawer").addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const f = $$("#drawer a,#drawer button,#drawer input,#drawer textarea").filter((x) => !x.disabled);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});

function confirmDialog(title, text, yesLabel) {
  const d = $("#confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-yes").textContent = yesLabel;
  return new Promise((resolve) => {
    const onClick = (e) => { const b = e.target.closest("button[value]"); if (!b) return; d.close(); cleanup(); resolve(b.value === "yes"); };
    const onCancel = () => { cleanup(); resolve(false); };
    const cleanup = () => { d.removeEventListener("click", onClick); d.removeEventListener("cancel", onCancel); };
    d.addEventListener("click", onClick);
    d.addEventListener("cancel", onCancel);
    d.showModal();
  });
}

async function patch(id, body) {
  try {
    const { order } = await api("/api/order?id=" + encodeURIComponent(id), { method: "PATCH", body });
    const cached = state.orderCache.get(id);
    if (cached) cached.order = order;
    const b = state.board.find((x) => x.id === id);
    if (b) Object.assign(b, { status: order.status, price: order.price });
    render();
    load();
    return true;
  } catch (e) {
    if (e.message !== "unauthorized") toast(t("saveErr"), "warn", true);
    return false;
  }
}

/* ------------------------------------------------------------------ toast */
function toast(msg, icon = "check", err) {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : "");
  el.innerHTML = (IC[icon] || IC.check) + `<span>${esc(msg)}</span>`;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = 0; setTimeout(() => el.remove(), 300); }, 3800);
}

/* ------------------------------------------------------------------ CSV export (current filters, all pages) */
$("#export").addEventListener("click", async () => {
  const rows = [["Order", "ID", "Date", "Name", "Phone", "Business", "Budget", "Status", "Agreed price (USD)", "Message", "Notes", "Language", "Notification"]];
  try {
    for (let page = 1, pages = 1; page <= pages && page <= 100; page++) {
      const r = await api("/api/orders?" + listParams({ page: String(page), pageSize: "100", full: "1" }));
      pages = r.pages;
      r.orders.forEach((o) => rows.push([label(o), o.id, new Date(o.createdAt).toISOString().replace("T", " ").slice(0, 16), o.name, o.phone, bizLabel(o), o.budget, t("st." + o.status), o.price ?? "", o.message, o.notes || "", o.language || "", o.notify || ""]));
    }
  } catch (e) { if (e.message !== "unauthorized") toast(t("netErr"), "warn", true); return; }
  const csv = "﻿" + rows.map((r) => r.map((c) => {
    let s = String(c ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(",")).join("\r\n");
  downloadText(csv, "webcreators-orders-" + new Date().toISOString().slice(0, 10) + ".csv", "text/csv;charset=utf-8");
});

// links like /admin/#order=<id> (from notification e-mails) also work when the panel is already open
window.addEventListener("hashchange", () => {
  const m = /^#order=([a-z0-9]{6,32})$/.exec(location.hash);
  if (m && !$("#app").hidden && state.openId !== m[1]) openDrawer(m[1]);
});

boot();
})();
