// FORGE i18n — minimal dictionary-based translation system.
//
// Design:
//   - Two languages (en, ru). English is the canonical key source.
//   - `t("some.key")` returns translated string; falls back to English; then
//     falls back to the key itself (so missing translations are visible).
//   - `t("greet", { name: "Sasha" })` interpolates {name} placeholders.
//   - Current language is stored on `window.__LANG__` and persisted in
//     localStorage (forge_lang). Default = browser language if ru, else en.
//
// To re-translate DOM after a language switch, walk `[data-i18n]` and
// `[data-i18n-attr]` elements via `applyI18n(root)`.

(function () {
  const STORAGE_KEY = "forge_lang";

  const DICT = {
    // ─── Nav / chrome ────────────────────────────────────────────────
    "nav.generator": { en: "Generator", ru: "Тренировка" },
    "nav.history": { en: "History", ru: "История" },
    "nav.library": { en: "Library", ru: "Библиотека" },
    "nav.settings": { en: "Settings", ru: "Настройки" },
    "nav.logout": { en: "Logout", ru: "Выйти" },

    // ─── Auth ─────────────────────────────────────────────────────────
    "auth.title": { en: "Forge your next workout.", ru: "Создай свою следующую тренировку." },
    "auth.sub": {
      en: "Select your goal, equipment, target, and duration. Get a custom session in seconds.",
      ru: "Выбери цель, инвентарь, зону и длительность. Получи тренировку за секунды.",
    },
    "auth.loading": { en: "Loading…", ru: "Загрузка…" },
    "auth.resetCache": { en: "Stuck on old version? Reset cache & reload", ru: "Зависла старая версия? Сбросить кэш" },
    "auth.offlineMode": { en: "Can't reach cloud? Use offline mode →", ru: "Нет доступа к серверу? Офлайн-режим →" },
    "auth.tabLogin": { en: "Log in", ru: "Войти" },
    "auth.tabSignup": { en: "Sign up", ru: "Регистрация" },
    "auth.username": { en: "Username", ru: "Имя пользователя" },
    "auth.password": { en: "Password", ru: "Пароль" },
    "auth.submitLogin": { en: "Log in", ru: "Войти" },
    "auth.submitSignup": { en: "Create account", ru: "Создать аккаунт" },
    "auth.loggingIn": { en: "Logging in…", ru: "Вход…" },
    "auth.creating": { en: "Creating…", ru: "Создание…" },
    "auth.forgot": { en: "Forgot password?", ru: "Забыли пароль?" },
    "auth.newPasswordTitle": { en: "Set a new password", ru: "Задать новый пароль" },
    "auth.newPasswordSub": {
      en: "Enter a new password below. You'll be signed in straight after.",
      ru: "Введи новый пароль. После сохранения войдёшь автоматически.",
    },
    "auth.newPasswordLabel": { en: "New password", ru: "Новый пароль" },
    "auth.updatePassword": { en: "Update password", ru: "Сохранить пароль" },

    // Email confirmation pending panel
    "confirm.title": { en: "Check your email", ru: "Проверь почту" },
    "confirm.bodyPre": { en: "We sent a confirmation link to", ru: "Мы отправили ссылку для подтверждения на" },
    "confirm.bodyPost": { en: "Click the link, then come back here and log in.", ru: "Перейди по ссылке, потом вернись сюда и войди." },
    "confirm.spamHint": { en: "Didn't see it? Check your spam folder.", ru: "Не пришло? Проверь папку спам." },
    "confirm.resend": { en: "Resend email", ru: "Отправить снова" },
    "confirm.resending": { en: "Sending…", ru: "Отправляем…" },
    "confirm.resent": { en: "Sent! Check your inbox.", ru: "Отправлено! Проверь почту." },
    "confirm.resendError": { en: "Couldn't resend. Try again in a moment.", ru: "Не получилось отправить. Попробуй ещё раз." },
    "confirm.back": { en: "← Back to login", ru: "← Назад ко входу" },
    "confirm.cooldown": { en: "Please wait {sec}s before requesting another email.", ru: "Подожди {sec}с перед повторной отправкой." },

    // ─── Generator view ──────────────────────────────────────────────
    "gen.title": { en: "Build your workout", ru: "Собери тренировку" },
    "gen.sub": { en: "Pick what you want, what you have, and how long you've got.", ru: "Выбери цель, инвентарь и длительность." },
    "gen.goal": { en: "Goal", ru: "Цель" },
    "gen.equipment": { en: "Equipment (select all you have)", ru: "Инвентарь (выбери всё доступное)" },
    "gen.target": { en: "Target", ru: "Зона" },
    "gen.duration": { en: "Duration", ru: "Длительность" },
    "gen.difficulty": { en: "Difficulty", ru: "Уровень" },
    "gen.style": { en: "Style", ru: "Стиль" },
    "gen.styleHint": {
      en: "Intensity adds tempo + pause reps for real strength stimulus at any load. Supersets pair exercises with no rest between. Circuits chain 3 exercises and rest after the cycle — burns more calories per minute.",
      ru: "Intensity добавляет темп и паузы для силового стимула на любом весе. Суперсеты — пара упражнений без отдыха. Круговые — 3 упражнения подряд, отдых после круга, больше калорий в минуту.",
    },
    "gen.generate": { en: "Generate Workout", ru: "Создать тренировку" },
    "gen.min": { en: "min", ru: "мин" },

    // Goals
    "goal.strength": { en: "Strength", ru: "Сила" },
    "goal.hypertrophy": { en: "Hypertrophy", ru: "Масса" },
    "goal.fat_loss": { en: "Fat Loss", ru: "Сжигание жира" },
    "goal.endurance": { en: "Endurance", ru: "Выносливость" },
    "goal.mobility": { en: "Mobility", ru: "Мобильность" },
    "goal.recovery": { en: "Recovery", ru: "Восстановление" },

    // Targets
    "target.full_body": { en: "Full Body", ru: "Всё тело" },
    "target.upper": { en: "Upper Body", ru: "Верх тела" },
    "target.lower": { en: "Lower Body", ru: "Низ тела" },
    "target.push": { en: "Push", ru: "Жим" },
    "target.pull": { en: "Pull", ru: "Тяга" },
    "target.legs": { en: "Legs", ru: "Ноги" },
    "target.core": { en: "Core", ru: "Кор" },
    "target.cardio": { en: "Cardio", ru: "Кардио" },

    // Equipment
    "eq.bodyweight": { en: "Bodyweight", ru: "Свой вес" },
    "eq.dumbbells": { en: "Dumbbells", ru: "Гантели" },
    "eq.barbell": { en: "Barbell", ru: "Штанга" },
    "eq.kettlebell": { en: "Kettlebell", ru: "Гиря" },
    "eq.bands": { en: "Resistance Bands", ru: "Резинки" },
    "eq.bandsShort": { en: "Bands", ru: "Резинки" },
    "eq.machine": { en: "Machines / Cable", ru: "Тренажёры / Блоки" },
    "eq.machineShort": { en: "Machine", ru: "Тренажёр" },
    "eq.cardio_machine": { en: "Cardio Machine", ru: "Кардиотренажёр" },

    // Difficulty
    "diff.beginner": { en: "Beginner", ru: "Новичок" },
    "diff.intermediate": { en: "Intermediate", ru: "Средний" },
    "diff.advanced": { en: "Advanced", ru: "Продвинутый" },

    // Style
    "style.standard": { en: "Standard", ru: "Стандарт" },
    "style.intensity": { en: "Intensity ⚡", ru: "Интенсивный ⚡" },
    "style.supersets": { en: "Supersets", ru: "Суперсеты" },
    "style.circuits": { en: "Circuits", ru: "Круговые" },

    // Patterns
    "pattern.compound": { en: "Compound", ru: "Базовое" },
    "pattern.isolation": { en: "Isolation", ru: "Изолирующее" },
    "pattern.ballistic": { en: "Ballistic", ru: "Взрывное" },
    "pattern.conditioning": { en: "Conditioning", ru: "Кондиционное" },
    "pattern.mobility": { en: "Mobility", ru: "Мобильность" },

    // ─── Muscles ──────────────────────────────────────────────────────
    "muscle.chest": { en: "chest", ru: "грудь" },
    "muscle.back": { en: "back", ru: "спина" },
    "muscle.shoulders": { en: "shoulders", ru: "плечи" },
    "muscle.biceps": { en: "biceps", ru: "бицепс" },
    "muscle.triceps": { en: "triceps", ru: "трицепс" },
    "muscle.quads": { en: "quads", ru: "квадрицепс" },
    "muscle.hamstrings": { en: "hamstrings", ru: "бицепс бедра" },
    "muscle.glutes": { en: "glutes", ru: "ягодицы" },
    "muscle.calves": { en: "calves", ru: "икры" },
    "muscle.core": { en: "core", ru: "кор" },
    "muscle.forearms": { en: "forearms", ru: "предплечья" },
    "muscle.cardio": { en: "cardio", ru: "кардио" },

    // ─── Library view ────────────────────────────────────────────────
    "lib.title": { en: "Exercise library", ru: "Библиотека упражнений" },
    "lib.sub": { en: "Browse all {count} exercises. Filter, search, see form cues and demos.", ru: "Все {count} упражнений. Фильтруй, ищи, смотри подсказки и демо." },
    "lib.search": { en: "Search exercises…", ru: "Найти упражнение…" },
    "lib.muscle": { en: "Muscle", ru: "Мышца" },
    "lib.equipment": { en: "Equipment", ru: "Инвентарь" },
    "lib.pattern": { en: "Pattern", ru: "Паттерн" },
    "lib.difficulty": { en: "Difficulty", ru: "Уровень" },
    "lib.clear": { en: "Clear filters", ru: "Сбросить фильтры" },
    "lib.results": { en: "{count} exercises", ru: "Упражнений: {count}" },
    "lib.empty": { en: "No exercises match", ru: "Ничего не найдено" },
    "lib.emptySub": { en: "Try clearing some filters.", ru: "Попробуй сбросить фильтры." },

    // ─── Settings view ───────────────────────────────────────────────
    "settings.title": { en: "Settings", ru: "Настройки" },
    "settings.sub": {
      en: "Tell us what loads you have access to so we can pick goals that actually match your equipment.",
      ru: "Укажи доступные веса — алгоритм подберёт цели под твой инвентарь.",
    },
    "settings.language": { en: "Language", ru: "Язык" },
    "settings.languageHelp": { en: "Choose the app's language.", ru: "Выбери язык интерфейса." },
    "settings.equipment": { en: "Equipment loads", ru: "Доступные веса" },
    "settings.equipmentHelp": {
      en: "Leave blank if you don't own that equipment. Strength training needs heavy loads — if your weights are light, the app will steer you toward hypertrophy/endurance where you'll actually get results.",
      ru: "Оставь пустым, если такого инвентаря нет. Силовой тренинг требует тяжёлых весов — при лёгких алгоритм направит к массе/выносливости.",
    },
    "settings.maxDumbbell": { en: "Heaviest dumbbell (per hand)", ru: "Самая тяжёлая гантель (на руку)" },
    "settings.maxKettlebell": { en: "Heaviest kettlebell", ru: "Самая тяжёлая гиря" },
    "settings.hasBarbell": {
      en: "I have a barbell with at least 100 kg / 220 lb in plates available",
      ru: "Есть штанга и блины минимум на 100 кг / 220 lb",
    },
    "settings.availableKB": { en: "Available kettlebells (comma-separated, in {unit})", ru: "Какие гири есть (через запятую, в {unit})" },
    "settings.availableKBHelp": {
      en: "List what you own. Progression uses these — if next size up is too big a jump, it'll suggest pushing reps further first.",
      ru: "Перечисли свои гири. Алгоритм учитывает реальные шаги — если до следующего веса слишком далеко, сначала добавит повторов.",
    },
    "settings.save": { en: "Save", ru: "Сохранить" },
    "settings.saved": { en: "Saved ✓", ru: "Сохранено ✓" },
    "settings.cloudSync": { en: "Cloud sync", ru: "Синхронизация" },
    "settings.cloudSyncHelp": {
      en: "Toggle cloud sync on or off. When off, your account on this device is local-only — no sync with other devices. Useful if your network blocks Supabase but you still want to use the app.",
      ru: "Включи/выключи синхронизацию. Когда выключено, данные только локально — без синхронизации с другими устройствами. Полезно, если сеть блокирует Supabase.",
    },
    "settings.sleep": { en: "Sleep", ru: "Сон" },
    "settings.sleepHelp": {
      en: "Rate last night's sleep. Bad sleep + accumulated soreness triggers an auto-suggested Recovery workout on the generator.",
      ru: "Оцени, как спал. Плохой сон + накопленная усталость предложит восстановительную тренировку.",
    },
    "settings.soreness": { en: "Current soreness", ru: "Текущая забитость" },
    "settings.sorenessHelp": {
      en: "Set how sore each muscle feels right now. The algorithm deprioritizes highly-sore muscles in your next workout. Soreness decays over time — full strength for 18 hours, then halves every 24 hours after.",
      ru: "Отметь, какие мышцы забиты. Алгоритм избегает сильно забитых мышц в следующей тренировке. Забитость уменьшается со временем — 18 часов на полную, потом вдвое каждые 24 часа.",
    },
    "settings.volumeTargets": { en: "Weekly volume targets", ru: "Недельные цели по объёму" },
    "settings.volumeTargetsHelp": {
      en: "Sets per week per primary muscle group. Hitting the target lights up a ✓ on the History volume chart. Leave blank for muscles you're not specifically programming.",
      ru: "Подходов в неделю на основную мышцу. При достижении ставится ✓ на графике объёма. Оставь пустым там, где не нужна цель.",
    },
    "settings.saveTargets": { en: "Save targets", ru: "Сохранить цели" },
    "settings.tools": { en: "Tools", ru: "Калькуляторы" },
    "settings.toolsHelp": { en: "Quick utilities. Don't change any saved data.", ru: "Утилиты — данные не меняют." },
    "settings.plateCalc": { en: "Plate calculator", ru: "Расчёт блинов" },
    "settings.plateCalcHelp": {
      en: "How to load a barbell for a target weight. Assumes a 20 kg / 45 lb Olympic bar.",
      ru: "Как зарядить штангу под нужный вес. Гриф 20 кг / 45 lb.",
    },
    "settings.plateTotal": { en: "total", ru: "всего" },
    "settings.calculate": { en: "Calculate", ru: "Рассчитать" },
    "settings.oneRm": { en: "1RM calculator", ru: "Расчёт 1ПМ" },
    "settings.oneRmHelp": {
      en: "Estimated 1-rep max from a weight × reps set. Three formulas + average.",
      ru: "Оценка 1ПМ от подхода вес × повторы. Три формулы и среднее.",
    },
    "settings.weight": { en: "weight", ru: "вес" },
    "settings.reps": { en: "reps", ru: "повторы" },
    "settings.estimate": { en: "Estimate", ru: "Оценить" },
    "settings.data": { en: "Data", ru: "Данные" },
    "settings.dataHelp": {
      en: "Backup your workouts, stats, and settings. JSON file, restore on any device or after wiping the browser.",
      ru: "Бэкап тренировок и настроек. JSON, восстанавливается на любом устройстве.",
    },
    "settings.exportData": { en: "Export all data", ru: "Экспорт всех данных" },
    "settings.importData": { en: "Import data", ru: "Импорт данных" },

    // ─── History view ────────────────────────────────────────────────
    "history.title": { en: "Your workout history", ru: "История тренировок" },
    "history.sub": { en: "Every session you've generated and saved.", ru: "Все созданные и сохранённые тренировки." },
    "rest.pause": { en: "Pause", ru: "Пауза" },
    "rest.resume": { en: "Resume", ru: "Продолжить" },
    "rest.skip": { en: "Skip", ru: "Пропустить" },
    "rest.label": { en: "Rest", ru: "Отдых" },
    "history.empty": { en: "No saved workouts yet", ru: "Тренировок пока нет" },
    "history.emptySub": { en: "Generate one and hit Save to see it here.", ru: "Создай тренировку и нажми Сохранить — появится здесь." },
    "history.bodyHeatmap": { en: "Body heatmap", ru: "Карта тела" },
    "history.bodyHeatmapSub": { en: "last 14 days · hover for details", ru: "за 14 дней · наведи для деталей" },
    "history.weeklyVolume": { en: "Weekly volume", ru: "Недельный объём" },
    "history.weeklyVolumeSub": { en: "last {n} weeks · per primary muscle", ru: "за {n} недель · по основной мышце" },
    "history.delete": { en: "Delete", ru: "Удалить" },

    // ─── Workout / exercise card ─────────────────────────────────────
    "wo.save": { en: "Save workout", ru: "Сохранить" },
    "wo.startWorkout": { en: "Start Workout", ru: "Начать" },
    "wo.regenerate": { en: "Regenerate", ru: "Пересоздать" },
    "wo.deloadFlag": { en: "Deload", ru: "Разгрузка" },
    "wo.addNotes": { en: "Add notes", ru: "Добавить заметку" },
    "wo.guidedMode": { en: "Guided Mode", ru: "Режим-гид" },
    "wo.swap": { en: "Swap", ru: "Заменить" },
    "wo.rest": { en: "rest", ru: "отдых" },
    "wo.sets": { en: "sets", ru: "подходы" },
    "wo.exercises": { en: "exercises", ru: "упражнений" },
    "wo.notes": { en: "Notes", ru: "Заметки" },
    "wo.notesPlaceholder": { en: "How did this workout feel? Any notes for next time?", ru: "Как прошла тренировка? Заметки на будущее?" },
    "wo.share": { en: "Share workout", ru: "Поделиться" },
    "wo.copyLink": { en: "Copy link", ru: "Скопировать ссылку" },
    "wo.linkCopied": { en: "Link copied", ru: "Ссылка скопирована" },
    "wo.saveSet": { en: "✓ Save sets", ru: "✓ Сохранить подходы" },
    "wo.logged": { en: "✓ Logged", ru: "✓ Записано" },
    "wo.edit": { en: "edit", ru: "изменить" },
    "wo.newPR": { en: "🏆 NEW PR", ru: "🏆 НОВЫЙ PR" },
    "wo.readyToPush": { en: "→ ready to push weight", ru: "→ можно добавить вес" },
    "wo.deloadNext": { en: "↓ deload next time", ru: "↓ снизить вес в след. раз" },
    "wo.last": { en: "Last:", ru: "Прошлая:" },
    "wo.progress": { en: "progress", ru: "прогресс" },
    "wo.deload": { en: "deload", ru: "снижение" },
    "wo.pushReps": { en: "push reps", ru: "добавь повторы" },
    "wo.recoveryLight": { en: "recovery — light", ru: "восстановление — лёгко" },

    // ─── Guided mode ─────────────────────────────────────────────────
    "guided.exit": { en: "← Exit", ru: "← Выйти" },
    "guided.set": { en: "Set", ru: "Подход" },
    "guided.round": { en: "Round", ru: "Круг" },
    "guided.of": { en: "of", ru: "из" },
    "guided.reps": { en: "reps", ru: "повторы" },
    "guided.doneSet": { en: "✓ Done Set", ru: "✓ Готово" },
    "guided.doneNext": { en: "✓ Done Set — Next Exercise →", ru: "✓ Готово — Следующее →" },
    "guided.finish": { en: "✓ Finish Workout", ru: "✓ Завершить" },
    "guided.skipSet": { en: "Skip Set", ru: "Пропустить подход" },
    "guided.skipExercise": { en: "Skip Exercise", ru: "Пропустить упражнение" },
    "guided.mainWork": { en: "MAIN WORK", ru: "ОСНОВНАЯ РАБОТА" },
    "guided.restAfterPair": { en: "rest after the pair", ru: "отдых после пары" },
    "guided.restAfterCircuit": { en: "rest after the circuit", ru: "отдых после круга" },
    "guided.restGroup": { en: "Rest — Round of group", ru: "Отдых — после круга" },
    "guided.last": { en: "Last:", ru: "Прошлая:" },
    "guided.warmup": { en: "WARM-UP / MOBILITY", ru: "РАЗМИНКА / МОБИЛЬНОСТЬ" },
    "guided.power": { en: "POWER / BALLISTIC", ru: "СИЛА / ВЗРЫВНОЕ" },
    "guided.conditioning": { en: "CONDITIONING / FINISHER", ru: "КОНДИЦИЯ / ФИНИШЕР" },

    // ─── RIR ──────────────────────────────────────────────────────────
    "rir.label": { en: "RIR", ru: "РВЗ" },
    "rir.tooltip": {
      en: "Reps In Reserve — how many reps did you have left? (0 = to failure, 3+ = easy)",
      ru: "Резерв повторов — сколько ещё мог сделать? (0 = до отказа, 3+ = легко)",
    },
    "rir.guidedTooltip": {
      en: "Reps In Reserve — how many reps left in the tank? 0 = to failure, 3+ = easy",
      ru: "Резерв повторов — сколько ещё оставалось? 0 = до отказа, 3+ = легко",
    },

    // ─── Volume status ───────────────────────────────────────────────
    "vol.underMev": { en: "Under MEV", ru: "Ниже МЕV" },
    "vol.approaching": { en: "Approaching", ru: "Подход" },
    "vol.optimal": { en: "Optimal (MAV)", ru: "Оптимум (MAV)" },
    "vol.high": { en: "High (near MRV)", ru: "Много (близ MRV)" },
    "vol.overMrv": { en: "Over MRV", ru: "Свыше MRV" },
    "vol.belowMev": { en: "below minimum effective volume", ru: "ниже минимального эффективного объёма" },
    "vol.approachingMsg": { en: "approaching productive range", ru: "приближается к рабочему диапазону" },
    "vol.optimalMsg": { en: "productive working volume", ru: "рабочий объём" },
    "vol.highMsg": { en: "high volume — approaching MRV", ru: "высокий объём — близко к MRV" },
    "vol.overMsg": { en: "over MRV · recovery at risk", ru: "выше MRV · восстановление под угрозой" },
    "vol.setsPerWeek": { en: "sets/wk", ru: "подх./нед" },

    // ─── Sleep ratings ───────────────────────────────────────────────
    "sleep.promptTitle": { en: "How did you sleep last night?", ru: "Как ты спал прошлой ночью?" },
    "sleep.great": { en: "Great", ru: "Отлично" },
    "sleep.greatDesc": { en: "8+ hrs, refreshed", ru: "8+ часов, отдохнул" },
    "sleep.ok": { en: "OK", ru: "Норм" },
    "sleep.okDesc": { en: "6-8 hrs", ru: "6-8 часов" },
    "sleep.meh": { en: "Meh", ru: "Так себе" },
    "sleep.mehDesc": { en: "5-6 hrs / restless", ru: "5-6 часов / беспокойно" },
    "sleep.bad": { en: "Bad", ru: "Плохо" },
    "sleep.badDesc": { en: "Under 5 hrs / terrible", ru: "Меньше 5 часов / ужасно" },

    // ─── Misc ─────────────────────────────────────────────────────────
    "common.cancel": { en: "Cancel", ru: "Отмена" },
    "common.confirm": { en: "Confirm", ru: "Подтвердить" },
    "common.close": { en: "Close", ru: "Закрыть" },
    "common.yes": { en: "Yes", ru: "Да" },
    "common.no": { en: "No", ru: "Нет" },
    "common.skip": { en: "Skip", ru: "Пропустить" },
    "common.loading": { en: "Loading…", ru: "Загрузка…" },
    "common.error": { en: "Error", ru: "Ошибка" },
  };

  function detectInitial() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "ru") return stored;
    } catch {}
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("ru") ? "ru" : "en";
  }

  let LANG = detectInitial();

  function getLang() { return LANG; }

  function setLang(lang) {
    if (lang !== "en" && lang !== "ru") return;
    LANG = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
    document.documentElement.lang = lang;
  }

  function t(key, params) {
    const entry = DICT[key];
    let s;
    if (entry) {
      s = entry[LANG] != null ? entry[LANG] : entry.en;
    } else {
      s = key; // expose missing keys visibly during development
    }
    if (params && typeof s === "string") {
      for (const [k, v] of Object.entries(params)) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), String(v));
      }
    }
    return s;
  }

  // Walk a root node and replace text/attrs marked with data-i18n.
  //   data-i18n="key"            → element.textContent = t(key)
  //   data-i18n-attr="attr:key"  → element.setAttribute(attr, t(key))
  //                                (multi: "placeholder:foo,title:bar")
  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const spec = el.dataset.i18nAttr;
      if (!spec) return;
      spec.split(",").forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  // Set initial document lang before first render.
  document.documentElement.lang = LANG;

  window.i18n = { t, getLang, setLang, applyI18n, DICT };
  window.t = t; // shorthand
})();
