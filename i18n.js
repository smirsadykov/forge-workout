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

    // Auth errors (localized from raw Supabase messages)
    "authErr.emailRate": {
      en: "Too many sign-up attempts. Try again in about an hour, or log in if you already have an account.",
      ru: "Слишком много попыток регистрации. Попробуй через час или войди, если аккаунт уже есть.",
    },
    "authErr.cooldown": {
      en: "Wait {sec} seconds before trying again.",
      ru: "Подожди {sec} секунд перед следующей попыткой.",
    },
    "authErr.badCreds": { en: "Wrong email or password.", ru: "Неверный email или пароль." },
    "authErr.exists": {
      en: "An account with this email already exists. Try logging in instead.",
      ru: "Аккаунт с таким email уже есть. Попробуй войти.",
    },
    "authErr.notConfirmed": {
      en: "Email not confirmed yet — check your inbox for the link.",
      ru: "Email ещё не подтверждён — проверь почту.",
    },
    "authErr.weakPassword": {
      en: "Password must be at least 6 characters.",
      ru: "Пароль должен быть не короче 6 символов.",
    },
    "authErr.badEmail": {
      en: "That doesn't look like a valid email address.",
      ru: "Похоже, email указан неправильно.",
    },
    "authErr.network": {
      en: "Network error — check your connection and try again.",
      ru: "Ошибка сети — проверь подключение и попробуй снова.",
    },
    "authErr.unknown": { en: "Something went wrong. Try again.", ru: "Что-то пошло не так. Попробуй ещё раз." },

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
    "gen.equipment": { en: "What you don't have", ru: "Чего у тебя нет" },
    "eq.optoutIntro": {
      en: "Tap anything you don't have. Everything else — including bodyweight — is fair game.",
      ru: "Отметь то, чего у тебя нет. Всё остальное — включая свой вес — пойдёт в дело.",
    },
    "eq.floorOnlyToggle": { en: "Floor only — no bar, bench or chair", ru: "Только пол — без турника, скамьи и стула" },
    "eq.bodyweightAlways": { en: "Bodyweight is always included.", ru: "Свой вес всегда включён." },
    "equip.full": { en: "Full kit", ru: "Всё есть" },
    "equip.bwOnly": { en: "Bodyweight", ru: "Свой вес" },
    "gen.target": { en: "Target", ru: "Зона" },
    "gen.duration": { en: "Duration", ru: "Длительность" },
    "gen.intensity": { en: "Intensity", ru: "Интенсивность" },
    "gen.intensityHint": {
      en: "Easy: fewer sets, longer rest, RIR 3+ (recovery / light day). Normal: standard prescription. Hard: more sets, shorter rest, RIR 0–1 (push day).",
      ru: "Легко: меньше подходов, дольше отдых, RIR 3+ (восстановительный/лёгкий день). Норма: стандартное предписание. Тяжело: больше подходов, короче отдых, RIR 0–1 (день максимума).",
    },
    "intensity.easy": { en: "Easy", ru: "Легко" },
    "intensity.normal": { en: "Normal", ru: "Норма" },
    "intensity.hard": { en: "Hard", ru: "Тяжело" },
    "progression.label": { en: "Progression", ru: "Прогрессия" },
    "progression.note": {
      en: "From your plateau at {from}. Next step in the chain.",
      ru: "Сменили на следующий шаг после плато на {from}.",
    },
    "gen.difficulty": { en: "Difficulty", ru: "Уровень" },
    "gen.style": { en: "Style", ru: "Стиль" },
    "gen.styleHint": {
      en: "Tempo adds slow eccentrics + pause reps for real strength stimulus at any load. Supersets pair exercises with no rest between. Circuits chain 3 exercises and rest after the cycle — burns more calories per minute.",
      ru: "«Темп» добавляет медленные эксцентрики и паузы для силового стимула на любом весе. Суперсеты — пара упражнений без отдыха. Круговые — 3 упражнения подряд, отдых после круга, больше калорий в минуту.",
    },
    "gen.generate": { en: "Generate Workout", ru: "Создать тренировку" },
    "gen.summaryPlaceholder": {
      en: "Pick your session type, equipment, target & duration",
      ru: "Выбери тип сессии, инвентарь, зону и длительность",
    },
    "gen.advancedHint": { en: "advanced", ru: "расширенные" },

    // Equipment labels (used by form summary pills)
    "equip.bodyweight": { en: "Bodyweight", ru: "Свой вес" },
    "equip.dumbbells": { en: "Dumbbells", ru: "Гантели" },
    "equip.barbell": { en: "Barbell", ru: "Штанга" },
    "equip.kettlebell": { en: "Kettlebell", ru: "Гиря" },
    "equip.bands": { en: "Bands", ru: "Резинки" },
    "equip.machine": { en: "Machines", ru: "Тренажёры" },
    "equip.cardio_machine": { en: "Cardio machine", ru: "Кардио" },
    "equip.floor_only": { en: "Floor only", ru: "Только пол" },
    "gen.min": { en: "min", ru: "мин" },

    // Session type — 2026-06: collapsed strength/hypertrophy/endurance/
    // fat_loss into "Standard" (hypertrophy default). Per-card advice
    // teaches users how to bias toward other goals without forcing them
    // to pick one upfront.
    "gen.sessionType": { en: "Session type", ru: "Тип сессии" },
    "gen.sessionTypeHint": {
      en: "Standard is hypertrophy programming — drives strength, muscle & work capacity simultaneously. Each exercise card shows how to adjust if you want a strength, endurance, or fat-loss bias.",
      ru: "«Стандарт» — гипертрофия. Развивает силу, массу и работоспособность одновременно. На каждой карточке упражнения есть подсказки, как сместить акцент на силу, выносливость или сжигание жира.",
    },
    // Per-session-type hints — replace the static hint when user picks a chip
    "gen.hint.mobility": {
      en: "Pure stretching + joint prep. Lower intensity, longer holds, no loaded compound work. Use on rest days or after a hard session to maintain range.",
      ru: "Чистая растяжка + подготовка суставов. Низкая интенсивность, длинные удержания, без силовой нагрузки. Используй в дни отдыха или после тяжёлой сессии.",
    },
    "gen.hint.recovery": {
      en: "Active recovery day. Light compound + isolation work for blood flow, no ballistic or conditioning. Helps clear DOMS without adding fatigue.",
      ru: "Активное восстановление. Лёгкие базовые + изолированные упражнения для кровотока, без баллистики и кардио. Помогает снять крепатуру, не накапливая усталость.",
    },
    "gen.hint.animal_flow": {
      en: "Bodyweight ground-based locomotion. Activations (Beast/Crab/Ape holds) → Reaches → Travels → Flow sequences. Mike Fitch curriculum, scales by intensity.",
      ru: "Наземные передвижения со своим весом. Активация (Beast/Crab/Ape) → растяжки → передвижения → потоки. Программа Майка Фитча, шкалируется интенсивностью.",
    },
    "gen.hint.kb_sport": {
      en: "Girevoy sport (KB Sport) — 1-3 continuous time blocks of Jerk, Long Cycle, or Snatch at a target pace. Technical — start with a lighter bell than your max.",
      ru: "Гиревой спорт — 1-3 непрерывных временных блока Толчка, Рывка или Длинного Цикла на заданном темпе. Технично — начинай с гири легче максимальной.",
    },
    "gen.hint.sport_prep": {
      en: "Sport-specific prep + prehab. Pick a sport above — workout pulls drills + injury-prevention work tailored to that sport's load patterns.",
      ru: "Подготовка под конкретный вид спорта + профилактика травм. Выбери вид спорта выше — тренировка возьмёт упражнения под него.",
    },
    // Equipment hints — show context based on what's selected
    "eq.hint.empty": {
      en: "Pick everything you have access to. Multi-select — the generator can mix implements within a session.",
      ru: "Выбери всё, что есть в наличии. Можно несколько — генератор будет миксовать в рамках сессии.",
    },
    "eq.hint.kb_only": {
      en: "KB-only mode. All KB programming families unlocked — strength, ballistics, sport. Full progression chains included.",
      ru: "Только гиря. Все семьи КБ-программ открыты — сила, баллистика, спорт. Прогрессии включены.",
    },
    "eq.hint.bw_only": {
      en: "Bodyweight only. Generator picks from BW-only exercises. Pair with a goal of mobility or recovery for best fit; strength sessions are limited to advanced BW moves.",
      ru: "Только свой вес. Генератор берёт упражнения из BW-пула. Лучше работает в связке с мобильностью или восстановлением.",
    },
    "goal.standard": { en: "Standard", ru: "Стандарт" },
    // Legacy goal labels — kept so old saved workouts render readable in history.
    "goal.strength": { en: "Strength", ru: "Сила" },
    "goal.hypertrophy": { en: "Standard", ru: "Стандарт" },
    "goal.fat_loss": { en: "Fat Loss", ru: "Сжигание жира" },
    "goal.endurance": { en: "Endurance", ru: "Выносливость" },
    "goal.mobility": { en: "Mobility", ru: "Мобильность" },
    "goal.recovery": { en: "Recovery", ru: "Восстановление" },
    "goal.kb_sport": { en: "KB Sport", ru: "Гиревой спорт" },
    "goal.sport_prep": { en: "Sport Prep", ru: "Подготовка к спорту" },
    "goal.animal_flow": { en: "Animal Flow", ru: "Animal Flow" },

    // Goals — strength/skill target tracking
    "goals.title": { en: "Toward your goal", ru: "К твоей цели" },
    "goals.sub": { en: "what you're training for", ru: "то, к чему ты идёшь" },
    "goals.current": { en: "Now", ru: "Сейчас" },
    "goals.target": { en: "Target", ru: "Цель" },
    "goals.deadline": { en: "By", ru: "К" },
    "goals.daysLeft": { en: "Days left", ru: "Дней" },
    "goals.onTrack": { en: "On track", ru: "В графике" },
    "goals.behind": { en: "Behind", ru: "Отстаём" },
    "goals.achieved": { en: "Achieved", ru: "Достигнуто" },
    "goals.achievedMsg": { en: "🎉 You've hit your target — set a new goal!", ru: "🎉 Цель достигнута — поставь новую!" },
    "goals.projection": { en: "At current rate: projected", ru: "При таком темпе:" },
    "goals.byDeadline": { en: "by deadline", ru: "к дедлайну" },
    "goals.noProgressYet": { en: "Log a session of this exercise to start tracking progress.", ru: "Залогируй сессию этого упражнения, чтобы начать отслеживать прогресс." },
    "goals.repsLabel": { en: "reps", ru: "повторений" },
    "goals.reps": { en: "reps", ru: "повт" },
    "goals.byShort": { en: "by", ru: "к" },
    "goals.remove": { en: "Remove", ru: "Удалить" },
    "goals.typeStrength": { en: "Lift a specific weight", ru: "Поднять заданный вес" },
    "goals.typeSkill": { en: "Hit a rep count (bodyweight skill)", ru: "Набрать число повторений (своим весом)" },
    "goals.errExercise": { en: "Pick an exercise", ru: "Выбери упражнение" },
    "goals.errWeight": { en: "Set a target weight", ru: "Укажи целевой вес" },
    "goals.errReps": { en: "Set a target rep count", ru: "Укажи число повторений" },
    "goals.errDeadline": { en: "Pick a deadline", ru: "Выбери дедлайн" },
    "goals.errPast": { en: "Deadline must be in the future", ru: "Дедлайн должен быть в будущем" },
    "goals.empty": { en: "No goals yet. Add one below.", ru: "Целей пока нет. Добавь ниже." },
    "goals.emptyTitle": { en: "No goals yet", ru: "Целей пока нет" },
    "goals.emptySub": {
      en: "Add a strength or skill target with a deadline. The generator will start biasing exercises that drive it, and you'll see trajectory on the History view.",
      ru: "Поставь цель по силе или навыку с дедлайном. Генератор начнёт усиливать упражнения, ведущие к ней, и на странице Истории появится траектория.",
    },
    "settings.goalsTitle": { en: "Training goals", ru: "Тренировочные цели" },
    "settings.goalsHelp": {
      en: "Set 1-3 outcomes. The generator boosts exercises that drive each goal, and you see trajectory toward target on the History view.",
      ru: "Поставь 1-3 цели. Генератор усиливает упражнения, которые ведут к каждой цели, а на странице Истории видна траектория к цели.",
    },
    "settings.addGoal": { en: "+ Add a goal", ru: "+ Добавить цель" },
    "settings.goalType": { en: "Goal type", ru: "Тип цели" },
    "settings.goalExercise": { en: "Exercise", ru: "Упражнение" },
    "settings.goalTargetWeight": { en: "Target weight", ru: "Целевой вес" },
    "settings.goalTargetReps": { en: "Target reps", ru: "Целевые повторения" },
    "settings.goalDeadline": { en: "Deadline", ru: "Дедлайн" },
    "settings.saveGoal": { en: "Save goal", ru: "Сохранить цель" },
    "program.bannerUseConfirm": { en: "Program session loaded", ru: "Сессия из программы загружена" },
    "af.activations": { en: "ACTIVATIONS", ru: "АКТИВАЦИЯ" },
    "af.reaches": { en: "FORM-SPECIFIC STRETCHES", ru: "РАСТЯЖКИ С ФОРМОЙ" },
    "af.travels": { en: "TRAVELING FORMS", ru: "ПЕРЕДВИЖЕНИЕ" },
    "af.flow": { en: "FLOW SEQUENCE", ru: "ПОТОК" },
    "af.flowNote": {
      en: "Chain these 3 moves continuously, then rest. Repeat for {rounds} rounds.",
      ru: "Объединяй 3 движения непрерывно, затем отдых. Повтори {rounds} раундов.",
    },

    // Per-card "For other goals" advice section
    "advice.title": { en: "For other goals", ru: "Для других целей" },
    "advice.strength": { en: "Strength", ru: "Сила" },
    "advice.endurance": { en: "Endurance", ru: "Выносливость" },
    "advice.fat_loss": { en: "Fat-loss", ru: "Сжигание жира" },
    "advice.strengthCue": { en: "push to RIR 0–1", ru: "до RIR 0–1" },
    "advice.enduranceCue": { en: "light load, no failure", ru: "лёгкий вес, без отказа" },
    "advice.fatLossCue": { en: "superset with cardio", ru: "суперсет с кардио" },
    "gen.sport": { en: "Sport", ru: "Вид спорта" },
    "sport.running": { en: "Running", ru: "Бег" },
    "sport.cycling": { en: "Cycling", ru: "Велоспорт" },
    "sport.swimming": { en: "Swimming", ru: "Плавание" },
    "sport.racket": { en: "Tennis / Padel", ru: "Теннис / Падел" },
    "sport.climbing": { en: "Climbing", ru: "Скалолазание" },
    "sport.pickFirst": { en: "Pick a sport first", ru: "Сначала выбери вид спорта" },
    "kbsport.pace": { en: "pace {lo}-{hi}/min", ru: "темп {lo}-{hi}/мин" },
    "kbsport.warmup": { en: "Warm-up", ru: "Разминка" },
    "kbsport.mainSet": { en: "Main set", ru: "Основной сет" },
    "kbsport.cooldown": { en: "Cool-down", ru: "Заминка" },
    "kbsport.continuous": { en: "continuous — don't set the bell down", ru: "непрерывно — не ставь гирю" },
    "kbsport.needKb": { en: "KB Sport needs a kettlebell. Add kettlebell to Equipment.", ru: "Гиревому спорту нужна гиря. Добавь гирю в Инвентарь." },
    "kbsport.needIntermediate": { en: "KB Sport lifts (Jerk, Long Cycle, Snatch) are technical. Pick Intermediate or Advanced; start with a lighter bell.", ru: "Толчок, длинный цикл и рывок — техничные движения. Выбери Средний или Продвинутый; начни с лёгкой гири." },
    "gen.nothingFits": { en: "Couldn't build a workout that fits these filters. Try a different goal or add more equipment.", ru: "Не получилось собрать тренировку под эти фильтры. Попробуй другую цель или добавь инвентарь." },

    // Program mode
    "program.title": { en: "Program", ru: "Программа" },
    "program.help": { en: "Commit to a goal for 4-8 weeks. The app rotates through a goal-appropriate split, auto-deloads near the end, and suggests today's session on the Generator.", ru: "Прими цель на 4-8 недель. Приложение ротирует подходящий сплит, делает разгрузку под конец и предлагает сессию на сегодня на экране генератора." },
    "program.goal": { en: "Goal", ru: "Цель" },
    "program.goalHypertrophy": { en: "Muscle growth", ru: "Набор массы" },
    "program.goalStrength": { en: "Strength gain", ru: "Сила" },
    "program.goalFatLoss": { en: "Fat loss", ru: "Сжигание жира" },
    "program.goalEndurance": { en: "Endurance", ru: "Выносливость" },
    "program.weeks": { en: "Block length", ru: "Длина блока" },
    "program.sessionsPerWeek": { en: "Sessions per week", ru: "Тренировок в неделю" },
    "program.start": { en: "Start program", ru: "Начать программу" },
    "program.startErr": { en: "Pick goal, weeks, and sessions/week.", ru: "Выбери цель, недели и количество тренировок." },
    "program.activeGoal": { en: "Goal", ru: "Цель" },
    "program.activeWeek": { en: "Week", ru: "Неделя" },
    "program.activeDay": { en: "Day", ru: "День" },
    "program.activeDone": { en: "Sessions done", ru: "Тренировок сделано" },
    "program.deloadFlag": { en: "⚠ Deload week — volume cut 30%, rest extended", ru: "⚠ Разгрузочная неделя — объём -30%, отдых дольше" },
    // Block periodization phase names — shown as badge on Program banner
    "program.phase.accumulation":    { en: "Accumulation · volume build", ru: "Накопление · набор объёма" },
    "program.phase.intensification": { en: "Intensification · push intensity", ru: "Интенсификация · повышение интенсивности" },
    "program.phase.realization":     { en: "Realization · peak weeks", ru: "Реализация · пиковые недели" },
    "program.phase.deload":          { en: "Deload · recovery week", ru: "Разгрузка · восстановление" },
    "program.pause": { en: "Pause", ru: "Поставить на паузу" },
    "program.resume": { en: "Resume", ru: "Продолжить" },
    "program.end": { en: "End program", ru: "Завершить программу" },
    "program.confirmEnd": { en: "End the current program? You can start a new one any time.", ru: "Завершить текущую программу? Новую можно начать в любой момент." },

    // Program banner on generator
    "program.bannerTitle": { en: "Active program", ru: "Активная программа" },
    "program.bannerSessionToday": { en: "Today: {label}", ru: "Сегодня: {label}" },
    "program.bannerMeta": { en: "Week {week}/{total} · Day {day}/{days}", ru: "Неделя {week}/{total} · День {day}/{days}" },
    "program.bannerUse": { en: "Use this session", ru: "Использовать эту сессию" },
    "program.bannerSkip": { en: "Skip", ru: "Пропустить" },
    "program.bannerComplete": { en: "Program complete — 🎉", ru: "Программа завершена — 🎉" },
    "program.bannerPaused": { en: "Paused — resume in Settings", ru: "На паузе — продолжи в Настройках" },

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
    "eq.floor_only": { en: "🏨 Floor only", ru: "🏨 Только пол" },
    "eq.floorOnlyHint": { en: "Floor only: pull-ups, dips, step-ups, and anything else needing a bar, bench or chair will be skipped.", ru: "Только пол: подтягивания, отжимания на брусьях, зашагивания и всё, что требует турник, скамью или стул, будут пропущены." },

    // Difficulty
    "diff.beginner": { en: "Beginner", ru: "Новичок" },
    "diff.intermediate": { en: "Intermediate", ru: "Средний" },
    "diff.advanced": { en: "Advanced", ru: "Продвинутый" },

    // Style
    "style.standard": { en: "Standard", ru: "Стандарт" },
    "style.tempo": { en: "Tempo ⚡", ru: "Темп ⚡" },
    // legacy alias for old workouts saved with style="intensity"
    "style.intensity": { en: "Tempo ⚡", ru: "Темп ⚡" },
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
    "history.emptySub": { en: "Generate one and hit Save to see it here. Each workout you log builds your training history — patterns, progressions, plateau detection all start working.", ru: "Создай тренировку и нажми Сохранить — появится здесь. Каждая записанная тренировка строит твою историю — паттерны, прогрессии, отслеживание плато." },
    "history.emptyCta": { en: "Generate your first workout", ru: "Создать первую тренировку" },
    "history.syncing": { en: "Loading your training history…", ru: "Загружаем твою историю тренировок…" },
    "history.bodyHeatmap": { en: "Body heatmap", ru: "Карта тела" },
    "history.bodyMap": { en: "BODY MAP", ru: "КАРТА ТЕЛА" },
    "history.bodyMapSub": { en: "OVER 14 DAYS · HOVER FOR DETAILS", ru: "ЗА 14 ДНЕЙ · НАВЕДИ ДЛЯ ДЕТАЛЕЙ" },
    "history.trainingVolume": { en: "Training Volume", ru: "Тренировочный объём" },
    "history.upperBody": { en: "UPPER BODY", ru: "ВЕРХ ТЕЛА" },
    "history.lowerBody": { en: "LOWER BODY", ru: "НИЗ ТЕЛА" },
    "history.periodAnalyzed": { en: "PERIOD ANALYZED", ru: "АНАЛИЗ ПЕРИОДА" },
    "history.lastIntensity": { en: "LAST SESSION", ru: "ПОСЛ. СЕССИЯ" },
    "gen.days": { en: "days", ru: "дн" },
    "muscleSheet.recent": { en: "Recent Exercises", ru: "Недавние упражнения" },
    "muscleSheet.sets": { en: "SETS", ru: "ПОДХ" },
    "muscleSheet.setsPerWeek": { en: "sets/wk", ru: "подх/нед" },
    "muscleSheet.today": { en: "TODAY", ru: "СЕГОДНЯ" },
    "muscleSheet.daysAgo": { en: "D AGO", ru: "Д НАЗАД" },
    "muscleSheet.empty": { en: "No recent work on this muscle in the last 14 days.", ru: "За последние 14 дней нет работы на эту мышцу." },
    "muscleSheet.name.chest":      { en: "Chest",      ru: "Грудные" },
    "muscleSheet.name.back":       { en: "Back",       ru: "Спина" },
    "muscleSheet.name.shoulders":  { en: "Shoulders",  ru: "Плечи" },
    "muscleSheet.name.biceps":     { en: "Biceps",     ru: "Бицепс" },
    "muscleSheet.name.triceps":    { en: "Triceps",    ru: "Трицепс" },
    "muscleSheet.name.quads":      { en: "Quads",      ru: "Квадрицепс" },
    "muscleSheet.name.hamstrings": { en: "Hamstrings", ru: "Бицепс бедра" },
    "muscleSheet.name.glutes":     { en: "Glutes",     ru: "Ягодицы" },
    "muscleSheet.name.calves":     { en: "Calves",     ru: "Икры" },
    "muscleSheet.name.core":       { en: "Core",       ru: "Кор" },
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
    "wo.editLogs": { en: "Edit logs", ru: "Изменить записи" },
    "wo.doneEdit": { en: "Done editing", ru: "Готово" },
    "wo.copyLink": { en: "Copy link", ru: "Скопировать ссылку" },
    "wo.linkCopied": { en: "Link copied", ru: "Ссылка скопирована" },
    "wo.saveSet": { en: "✓ Save sets", ru: "✓ Сохранить подходы" },
    "wo.logged": { en: "✓ Logged", ru: "✓ Записано" },
    "wo.edit": { en: "edit", ru: "изменить" },
    "wo.newPR": { en: "🏆 NEW PR", ru: "🏆 НОВЫЙ PR" },
    "wo.readyToPush": { en: "→ ready to push weight", ru: "→ можно добавить вес" },
    "wo.deloadNext": { en: "↓ deload next time", ru: "↓ снизить вес в след. раз" },
    "wo.last": { en: "Last:", ru: "Прошлая:" },
    "wo.progress": { en: "add weight", ru: "добавь вес" },
    "wo.deload": { en: "drop weight", ru: "снизь вес" },
    "wo.pushReps": { en: "push for one more rep", ru: "сделай ещё повтор" },
    "wo.recoveryLight": { en: "go light today", ru: "сегодня — легко" },
    "wo.firstTime": { en: "First time", ru: "Первый раз" },
    "wo.firstSessionNote": { en: "start here, adjust after set 1", ru: "начни отсюда, скорректируй после 1-го подхода" },
    "wo.shortfall": { en: "Estimated ~{est} min — you asked for {req}. The pool of exercises matching these filters is small.", ru: "Примерно ~{est} мин — ты запросил {req}. Под эти фильтры подходит мало упражнений." },
    "wo.shortfallTips": { en: "To get the full duration: raise difficulty (more exercises available), pick a broader target (Upper / Full Body), or add Bodyweight to Equipment.", ru: "Чтобы получить полную длительность: подними уровень (откроются новые упражнения), выбери более широкую зону (Верх тела / Всё тело) или добавь «Свой вес» в Инвентарь." },
    "banner.more": { en: "more reasons", ru: "ещё причины" },
    "section.warmup": { en: "WARM-UP", ru: "РАЗМИНКА" },
    "section.main": { en: "MAIN WORK", ru: "ОСНОВНАЯ РАБОТА" },
    "section.cardio": { en: "CONDITIONING", ru: "КАРДИО" },
    "section.cooldown": { en: "COOL-DOWN", ru: "ЗАМИНКА" },

    // Onboarding wizard (first-run, 3 steps)
    "onboard.step1Title": { en: "Welcome to FORGE", ru: "Добро пожаловать в FORGE" },
    "onboard.step1Sub": { en: "Tell us what loads you have so progressions actually match your equipment. You can edit these later in Settings.", ru: "Укажи доступные веса — прогрессии будут соответствовать твоему инвентарю. Можно изменить позже в Настройках." },
    "onboard.step2Title": { en: "Want a program?", ru: "Нужна программа?" },
    "onboard.step2Sub": { en: "A program rotates through a goal-appropriate split and auto-deloads near the end. Or skip and freestyle workouts day by day.", ru: "Программа ротирует сплит под цель и делает разгрузку под конец блока. Или пропусти и делай тренировки день за днём." },
    "onboard.step3Title": { en: "You're set.", ru: "Готово." },
    "onboard.step3Sub": { en: "Build your first session: pick a goal, equipment, target, and duration. The app handles the rest — exercise selection, weight suggestions, rest timing, progression.", ru: "Создай первую тренировку: выбери цель, инвентарь, зону и длительность. Остальное — подбор упражнений, веса, отдых, прогрессии — на нас." },
    "onboard.skip": { en: "Skip setup", ru: "Пропустить настройку" },
    "onboard.next": { en: "Continue →", ru: "Продолжить →" },
    "onboard.skipProgram": { en: "No program, freestyle", ru: "Без программы" },
    "onboard.startProgram": { en: "Start program →", ru: "Начать программу →" },
    "onboard.finish": { en: "Build my first workout →", ru: "Создать первую тренировку →" },

    // Interval timer (Tabata / EMOM / AMRAP / Custom)
    "timer.title": { en: "Interval timer", ru: "Интервальный таймер" },
    "timer.sub": { en: "Tabata, EMOM, AMRAP, or fully custom.", ru: "Табата, EMOM, AMRAP или любые интервалы." },
    "timer.toolHelp": { en: "Tabata, EMOM, AMRAP, or custom intervals. Big timer, beep cues. Replaces a separate timer app.", ru: "Табата, EMOM, AMRAP или свои интервалы. Большой таймер, звуковые сигналы. Заменяет отдельное приложение." },
    "timer.open": { en: "Open timer →", ru: "Открыть таймер →" },
    "timer.tabata": { en: "Tabata", ru: "Табата" },
    "timer.tabataDetail": { en: "20s work · 10s rest · 8 rounds", ru: "20с работа · 10с отдых · 8 раундов" },
    "timer.emom": { en: "EMOM", ru: "EMOM" },
    "timer.emomDetail": { en: "Top of every minute · 10 rounds", ru: "В начале каждой минуты · 10 раундов" },
    "timer.amrap": { en: "AMRAP", ru: "AMRAP" },
    "timer.amrapDetail": { en: "As many rounds as possible · 15 min", ru: "Сколько успеешь · 15 минут" },
    "timer.custom": { en: "Custom", ru: "Свой" },
    "timer.customDetail": { en: "Set work / rest / rounds yourself", ru: "Свои работа / отдых / раунды" },
    "timer.workSec": { en: "Work (sec)", ru: "Работа (сек)" },
    "timer.restSec": { en: "Rest (sec)", ru: "Отдых (сек)" },
    "timer.rounds": { en: "Rounds", ru: "Раунды" },
    "timer.start": { en: "▶ Start", ru: "▶ Старт" },
    "timer.work": { en: "WORK", ru: "РАБОТА" },
    "timer.rest": { en: "REST", ru: "ОТДЫХ" },
    "timer.pause": { en: "Pause", ru: "Пауза" },
    "timer.resume": { en: "Resume", ru: "Продолжить" },
    "timer.stop": { en: "Stop", ru: "Стоп" },
    "timer.roundOf": { en: "Round {current} of {total}", ru: "Раунд {current} из {total}" },
    "timer.doneTitle": { en: "Done.", ru: "Готово." },
    "timer.doneSummary": { en: "{rounds} rounds · {minutes} min of work", ru: "{rounds} раундов · {minutes} мин работы" },
    "timer.again": { en: "Run again", ru: "Запустить снова" },
    "timer.tabataSummary": { en: "{rounds} rounds · ~{total} total", ru: "{rounds} раундов · ~{total} всего" },
    "timer.emomSummary": { en: "{rounds} minutes · ~{total} total", ru: "{rounds} минут · ~{total} всего" },
    "timer.amrapSummary": { en: "Single block · {total}", ru: "Один блок · {total}" },
    "timer.customSummary": { en: "{work}s / {rest}s × {rounds} · ~{total} total", ru: "{work}с / {rest}с × {rounds} · ~{total} всего" },

    // Custom workout templates
    "templates.save": { en: "Save template", ru: "Сохранить шаблон" },
    "templates.saveTooltip": { en: "Save this workout's shape (goal, equipment, exercises) for reuse later", ru: "Сохранить форму тренировки (цель, инвентарь, упражнения) для повторного использования" },
    "templates.namePrompt": { en: "Name this template", ru: "Название шаблона" },
    "templates.fromSaved": { en: "From a saved template", ru: "Из сохранённого шаблона" },
    "templates.useExact": { en: "Use exact", ru: "Использовать как есть" },
    "templates.regen": { en: "Regenerate", ru: "Пересоздать" },
    "templates.confirmDelete": { en: "Delete this template?", ru: "Удалить шаблон?" },

    // History insights
    "insights.title": { en: "Insights", ru: "Аналитика" },
    "insights.sub": { en: "last 4-8 weeks", ru: "за 4-8 недель" },
    "insights.prsLast8w": { en: "PRs (8 weeks)", ru: "Рекорды (8 нед)" },
    "insights.workoutsLast4w": { en: "Workouts (4 weeks)", ru: "Тренировок (4 нед)" },
    "insights.weekAvg": { en: "{avg}/week average", ru: "В среднем {avg}/нед" },
    "insights.mostFrequent": { en: "Most-trained", ru: "Чаще всего" },
    "insights.balance": { en: "Movement balance", ru: "Баланс движений" },
    "insights.pushPull": { en: "Push : Pull", ru: "Жим : Тяга" },
    "insights.kneeHip": { en: "Knee : Hip", ru: "Колено : Бедро" },
    "insights.pushHeavy": { en: "Push-heavy ({ratio}). Add pulling work.", ru: "Преобладают жимы ({ratio}). Добавь тяги." },
    "insights.pullHeavy": { en: "Pull-heavy ({ratio}). Add pressing work.", ru: "Преобладают тяги ({ratio}). Добавь жимы." },
    "insights.kneeHeavy": { en: "Squat-heavy ({ratio}). Add hinge work.", ru: "Преобладают приседы ({ratio}). Добавь становые/наклоны." },
    "insights.hipHeavy": { en: "Hinge-heavy ({ratio}). Add squat work.", ru: "Преобладают наклоны ({ratio}). Добавь приседания." },
    "insights.lastPR": { en: "Last PR: {name} ({days}d ago)", ru: "Последний рекорд: {name} ({days}д назад)" },
    "insights.noPRs": { en: "No PRs yet — keep logging.", ru: "Рекордов пока нет — продолжай тренироваться." },
    "insights.noFrequent": { en: "No exercises logged in 4 weeks.", ru: "За 4 недели ничего не залогировано." },

    // This Week pattern balance
    "week.title": { en: "This Week", ru: "Эта неделя" },
    "week.sub": { en: "last 7 days · sets per pattern", ru: "за 7 дней · подходов по паттернам" },
    "week.favor": { en: "Today's workout will favor", ru: "Сегодняшняя тренировка усилит" },
    "week.deload": { en: "Auto-deload", ru: "Авто-разгрузка" },
    "week.balanced": { en: "All patterns balanced — no bias applied", ru: "Все паттерны в норме — без сдвигов" },
    "patterns.push": { en: "Push", ru: "Жим" },
    "patterns.pull": { en: "Pull", ru: "Тяга" },
    "patterns.squat": { en: "Squat", ru: "Присед" },
    "patterns.hinge": { en: "Hinge", ru: "Наклон" },
    "patterns.core": { en: "Core", ru: "Кор" },

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
    "guided.finishHere": { en: "Save & finish here", ru: "Завершить и сохранить" },
    "guided.mainWork": { en: "MAIN WORK", ru: "ОСНОВНАЯ РАБОТА" },
    "guided.restAfterPair": { en: "rest after the pair", ru: "отдых после пары" },
    "guided.restAfterCircuit": { en: "rest after the circuit", ru: "отдых после круга" },
    "guided.restGroup": { en: "Rest — Round of group", ru: "Отдых — после круга" },
    "guided.last": { en: "Last:", ru: "Прошлая:" },
    "guided.startTimer": { en: "Start timer", ru: "Запустить таймер" },
    "guided.timerRunning": { en: "Timer running", ru: "Таймер идёт" },
    "guided.seeBar": { en: "see bar below", ru: "см. полосу ниже" },
    "guided.setTimerLabel": { en: "Set", ru: "Подход" },
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
    "vol.weekShort": { en: "wk", ru: "нед" },
    "vol.noWork": { en: "no work", ru: "нет работы" },

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
    "sleep.modalSub": { en: "Daily check-in. Feeds the recovery algorithm.", ru: "Ежедневная отметка. Влияет на алгоритм восстановления." },
    "sleep.skipToday": { en: "Skip today", ru: "Пропустить сегодня" },

    // ─── Misc ─────────────────────────────────────────────────────────
    // Time units (used inside reps strings: "30–60 sec", "5 min")
    "time.sec": { en: "sec", ru: "сек" },
    "time.min": { en: "min", ru: "мин" },
    "wo.perSide": { en: "per side", ru: "на сторону" },

    // ─── Banners ──────────────────────────────────────────────────────
    // Load warning
    "warn.loadTitle": { en: "Equipment may be too light for {diff} strength", ru: "Возможно, веса малы для уровня «{diff}»" },
    "warn.intensityHint": { en: "Or use Intensity Mode — tempo and pause reps create real strength stimulus even at lighter loads.", ru: "Или включи Intensity Mode — темп и паузы дают силовой стимул даже на лёгких весах." },
    "warn.switchTo": { en: "Switch to {goal}", ru: "Перейти на {goal}" },
    "warn.useIntensity": { en: "Use Intensity Mode ⚡", ru: "Включить Intensity ⚡" },
    "warn.openSettings": { en: "Open Settings", ru: "Открыть Настройки" },
    "warn.reasonNoneSelected": { en: "You haven't selected any equipment that can be loaded heavy (barbell, dumbbells, kettlebell, or machine).", ru: "Не выбран инвентарь, который можно загрузить тяжело (штанга, гантели, гири, тренажёр)." },
    "warn.reasonUnknownMax": { en: "You haven't told us how heavy your dumbbells / kettlebells go. Set this in Settings for accurate recommendations.", ru: "Не указаны максимальные веса гантелей/гирь. Укажи в Настройках для точных рекомендаций." },
    "warn.reasonTooLight": { en: "Your heaviest available weight ({weight} {units}) is too light for {diff} strength training.", ru: "Максимальный доступный вес ({weight} {units}) слишком мал для силовой на уровне «{diff}»." },
    "warn.recommendation": { en: "Switch to Hypertrophy or Endurance — with limited load, high-volume training is where you'll actually grow.", ru: "Перейди на массу или выносливость — при ограниченных весах рост даёт высокий объём." },

    // Recovery banner
    "rec.title": { en: "You're under-recovered.", ru: "Восстановление не завершено." },
    "rec.body": {
      en: "Detected: {reasons}. A Recovery session — ~55% of your usual weights, 2-3 sets of 10-15 reps with short rest — keeps momentum without digging the hole deeper. Better than skipping.",
      ru: "Признаки: {reasons}. Восстановительная тренировка — ~55% обычных весов, 2-3 подхода по 10-15 повторов с коротким отдыхом — сохраняет ритм, не углубляя усталость. Лучше, чем пропуск.",
    },
    "rec.reasonBadSleep": { en: "you slept badly", ru: "плохой сон" },
    "rec.reasonSore": { en: "{n} muscles still sore", ru: "забитых мышц: {n}" },
    "rec.start": { en: "Start Recovery", ru: "Начать восстановление" },
    "rec.dismiss": { en: "Train anyway", ru: "Тренироваться всё равно" },

    // Recommendation banner
    "recm.title": { en: "Recommended for today:", ru: "Рекомендовано на сегодня:" },
    "recm.apply": { en: "Apply", ru: "Применить" },
    "recm.dismiss": { en: "Dismiss", ru: "Скрыть" },
    "recm.reasonFirst": { en: "Start your first session with a full body workout to baseline everything.", ru: "Первую тренировку сделай на всё тело — это даст базовую точку отсчёта." },
    "recm.reasonRecent": { en: "You trained {last} recently — a mobility session lets you keep moving while you recover.", ru: "Недавно тренировал {last} — мобильность позволит двигаться, пока идёт восстановление." },
    "recm.reasonBalance": { en: "Last session was {last} — train {opp} today to keep your body balanced.", ru: "Прошлая тренировка — {last}. Сегодня {opp}, чтобы держать тело в балансе." },

    // Deload banner
    "deload.titleSoreness": { en: "Multiple muscles sore — consider a deload", ru: "Несколько мышц забиты — пора разгрузиться" },
    "deload.titleWeeks": { en: "Consider a deload this week", ru: "Возможно, разгрузочная неделя" },
    "deload.bodySoreness": { en: "Multiple muscles are still flagged as highly sore in recent sessions. Pushing through cumulative fatigue is the fastest way to a plateau. A planned light week now (~30% less volume, slightly more rest) lets your nervous system catch up.", ru: "Несколько мышц по-прежнему сильно забиты. Тренировка через накопленную усталость — самый быстрый путь к застою. Запланированная лёгкая неделя (~30% меньше объёма, чуть больше отдыха) даст нервной системе восстановиться." },
    "deload.bodyWeeks": { en: "You've trained {weeks} weeks in a row since your last deload. A planned light week (~30% less volume, slightly more rest) lets your nervous system catch up and primes the next training block. Highly recommended for sustained progress.", ru: "Ты тренируешься {weeks} недель подряд без разгрузки. Лёгкая неделя (~30% меньше объёма, чуть больше отдыха) даст нервной системе восстановиться и подготовит следующий блок. Очень рекомендуется." },
    "deload.start": { en: "Plan this as a deload week", ru: "Сделать эту неделю разгрузочной" },
    "deload.notYet": { en: "Not yet", ru: "Не сейчас" },

    // Level banner
    "level.titleUp": { en: "Time to level up?", ru: "Пора повысить уровень?" },
    "level.titleDown": { en: "Time to ease off?", ru: "Пора снизить уровень?" },
    "level.try": { en: "Try {level}", ru: "Перейти на {level}" },
    "level.skip": { en: "Skip", ru: "Пропустить" },
    "level.reasonDown": { en: "Your last {n} sessions averaged {avg}/5 effort — consistently maxing out. Dropping to {next} for a couple weeks will let you build back stronger.", ru: "Последние {n} тренировок в среднем на {avg}/5 — постоянно на максимуме. Снизься до уровня «{next}» на пару недель, чтобы потом вернуться сильнее." },
    "level.reasonUp": { en: "Your last {n} sessions averaged {avg}/5 effort — too easy. Try {next} for real progress.", ru: "Последние {n} тренировок в среднем на {avg}/5 — слишком легко. Попробуй уровень «{next}» для реального прогресса." },

    // Difficulty readiness (behavior-based, no RPE needed)
    "ready.reason": {
      en: "You've hit {n}/4 readiness signals — {signals}. Time to unlock more exercises + heavier prescription.",
      ru: "Сработало {n} из 4 признаков готовности — {signals}. Пора открыть новые упражнения и более тяжёлую программу.",
    },
    "ready.consistency":      { en: "8+ workouts in 4 weeks", ru: "8+ тренировок за 4 недели" },
    "ready.effort":           { en: "RIR ≤ 1 on top sets",    ru: "RIR ≤ 1 на ключевых подходах" },
    "ready.progression":      { en: "Adding weight on compounds", ru: "Прибавка веса на базовых" },
    "ready.patternCoverage":  { en: "All 4 patterns covered",  ru: "Все 4 паттерна покрыты" },
    "ready.tenure":           { en: "24+ workouts over 12 weeks", ru: "24+ тренировок за 12 недель" },
    "ready.heavyEquip":       { en: "Heavy equipment unlocked", ru: "Используешь тяжёлый инвентарь" },
    "ready.prs":              { en: "2+ PRs in last 8 weeks", ru: "2+ рекорда за 8 недель" },

    // Common controls
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
