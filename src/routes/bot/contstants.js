const CheckContentText = "Перевірити контент"
const CheckContentAnswerText= "Надішліть матеріали які бажаєте перевірити"
const SubscribtionText = "🔥 Актуальні фейки"
const NoCurrentFakes = "Нажаль ми ще не підібрали для вас актуальних фейків"
const SetFakesRequestText = "Надішліть нові фейки у відповідь на це повідомлення"
const TrueMessageText = "Ваше звернення визначено як правдиве"
const FakeMessageText = "Ваше звернення визначено як оманливе"
const RejectMessageText = "🌪На жаль, ми не можемо підтвердити чи спростувати цю інформацію🌪\n\nВірогідні причини:\n🧨 перевантаження\nми мали пікове навантаження в момент твого запиту і він застарів\n🔧нерелевантний запит\nми перевіряємо інформацію на фейки, проте інколи читачі плутають це з консьєрж-сервісом\n\nЗ початком війни журналісти @gwaramedia запустили цей бот для перевірки новин на фейки.\nІнформація перевіряється журналістами, волонтерами (громадськими фактчекерами) та алгоритмами.\n\nНадсилайте важливу інформацію на перевірку - зробимо інфопростір чистим."
const BlackSourceText = "Високовірогідно - ФЕЙК, МАНІПУЛЯЦІЯ або ДЕЗІНФОРМАЦІЯ. Запит не перевірявся журналістами та фактчекерами і обробився автоматично.";
const WhiteSourceText = "Високовірогідно - ВІДПОВІДАЛЬНА ІНФОРМАЦІЯ або ПРАВДА. Запит не перевірявся журналістами та фактчекерами і обробився автоматично.";
const ForbiddenRequestText = "Ми тимчасово призупинили прийом повідомлень. Спробуйте знову за деякий час.";
const TimeoutMessageText = "Дякуємо за Ваше звернення! \nНа жаль, на цей час навантаження на бот дуже велике і оскільки обробка запитів здійснюється вручну командою фактчекерів-волонтерів, ми не встигаємо обробити все вчасно. \nПриносимо наші вибачення.\n\nЯкщо Ваш запит ще актуальний та необхідний, будь ласка, надішліть його повторно. Просимо нам направляти інформацію, яка містить: текст/фото та джерело каналу. Запити-пропозиції з роботи, волонтерства або інших питань з приватних номерів та каналів, ми не можемо ніяк перевірити. Тому радимо звертатися до відповідних установ, які цим займаються та бути пильними! \n" +
    "Щоб бути обізнаними та не піддаватися фейкам — підписуйтеся на офіційні канали, які одними з перших повідомляють важливу інформацію:  \n" +
    "✅https://t.me/OP_UA\nhttps://www.facebook.com/president.gov.ua — Офіс президента України \n" +
    "✅ https://t.me/V_Zelenskiy_official — Президент України Володимир Зеленський. \n" +
    "✅https://www.facebook.com/KabminUA — Кабінет Міністрів України\n" +
    "✅https://www.facebook.com/MinistryofDefence.UA — Міністерство оборони України\n" +
    "✅https://www.facebook.com/GeneralStaff.ua — Генеральний штаб Збройних сил України\n" +
    "✅https://t.me/CenterCounteringDisinformation — Центр протидії дезінформації при РНБО"
const NotifyUserTextMap = {
    "1": TrueMessageText,
    "-1": FakeMessageText,
    "-2": RejectMessageText,
    "-3": TimeoutMessageText
}
const UnsupportedContentText = "Ми не обробляємо переслані повідомлення, проте можете надіслати посилання на інформацію, яку бажаєте перевірити";
const WhatReasonText = "Чому важливо перевірити цю інформацію";
const ByInterestRequestText = "На жаль, ми не обробляємо запити із такою причиною звернення.";
const RequestTimeout = 14 // in days

module.exports = {
    CheckContentText,
    CheckContentAnswerText,
    SubscribtionText,
    SetFakesRequestText,
    NoCurrentFakes,
    TrueMessageText,
    FakeMessageText,
    RejectMessageText,
    BlackSourceText,
    WhiteSourceText,
    ForbiddenRequestText,
    UnsupportedContentText,
    WhatReasonText,
    ByInterestRequestText,
    RequestTimeout,
    TimeoutMessageText,
    NotifyUserTextMap
}