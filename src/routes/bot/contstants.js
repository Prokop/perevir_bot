const CheckContentText = {
    ua: "Перевірити контент",
    en: "Check content"
}

const SubscribtionText = {
    ua: "🔥 Актуальні фейки",
    en: "🔥 Relevant fakes"
}

const QuizText = {
    ua: "📝 Тести",
    en: "📝 Tests"
}

const ChangeLanguage = {
    ua: "🌍 Change Language",
    en: "🇺🇦 Змінити мову"
}

const NoCurrentFakes = {
    ua: "Нажаль ми ще не підібрали для вас актуальних фейків",
    en: "Unfortunatly we don't have relevant fakes right now"
}

const UnsupportedContentText = {
    ua: "Ми не обробляємо переслані повідомлення, проте можете надіслати посилання на інформацію, яку бажаєте перевірити",
    en: "We don't accept resent messages right now"
}

const SetFakesRequestText = "Надішліть нові фейки у відповідь на це повідомлення"
const RequestTimeout = 14 // in days
const RequestThrottleLimit = 50 // 5 requests per 1 hour
const FakeStatusesStrToInt = {
    "true": 1,
    "false": -1,
    "manipulation": -5,
    "noproof": -4,
    "reject": -2,
    "autoconfirm": 2,
    "autodecline": -3,
}
const FakeStatusesStrToHuman = {
    "true": "правда",
    "false": "фейк",
    "manipulation": "напівправда",
    "noproof": "бракує доказів",
    "reject": "відмова",
    "autoconfirm": "підтверджено автоматичнр",
    "autodecline": "відмовлено автоматично",
}
const BackNav = "🔙 Назад";

module.exports = {
    CheckContentText,
    SubscribtionText,
    QuizText,
    ChangeLanguage,
    NoCurrentFakes,
    UnsupportedContentText,
    SetFakesRequestText,
    RequestThrottleLimit,
    RequestTimeout,
    FakeStatusesStrToInt,
    FakeStatusesStrToHuman,
    BackNav
}