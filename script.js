// Fragenkatalog: 'mc', 'gap', 'drag'(match), 'gapdrag', 'list'
let questionsByCategory = {};
let questionsLoaded = false;

fetch("questions.json")
  .then(response => response.json())
  .then(data => {
    questionsByCategory = data;
    questionsLoaded = true;
    console.log("Fragen geladen:", questionsByCategory);
  })
  .catch(error => {
    console.error("Fehler beim Laden der questions.json:", error);
    alert("Die Fragen konnten nicht geladen werden. Starte die Seite über Live Server.");
  });

let currentQuestion = 0;
let score = 0;
let questions = [];
let level = 1;
let xp = 0;
let currentUser = "";

// Drag config per question
let currentDragMulti = false;

// Feedback flow
let awaitingNext = false;


// =========================================================
// MEDIEN: BILDER UND KOREANISCHE AUSSPRACHE
// =========================================================

// Verwendete Fragenfelder:
// koreanTerm, hangul, bild, bildbeschreibung,
// audiodatei und optional medienVorAntwort.

let currentPronunciationAudio = null;


// Ersten Wert aus einem Array oder Text holen
function firstMediaText(value) {
  const firstValue = Array.isArray(value) ? value[0] : value;

  return firstValue == null
    ? ""
    : String(firstValue).trim();
}


// Nur lokale Bilder und Audiodateien verwenden
function localMediaPath(value, folder) {
  if (typeof value !== "string") return "";

  const path = value.trim().replace(/^\.\//, "");

  if (!path.startsWith(folder + "/")) return "";

  if (path.includes("..") || /[\\:?#]/.test(path)) {
    return "";
  }

  return path;
}


// Aktuelle Sprachausgabe stoppen
function stopPronunciation() {
  if (currentPronunciationAudio) {
    currentPronunciationAudio.pause();
    currentPronunciationAudio.currentTime = 0;
    currentPronunciationAudio = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}


// Koreanischen Text automatisch vorlesen
function speakKorean(hangul) {
  if (
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    alert("Dein Browser unterstützt keine automatische Sprachausgabe.");
    return;
  }

  const speech = new SpeechSynthesisUtterance(hangul);

  speech.lang = "ko-KR";
  speech.rate = 0.8;

  window.speechSynthesis.speak(speech);
}


// Aussprache abspielen
function playPronunciation(q) {
  stopPronunciation();

  const audioPath = localMediaPath(
    q.audiodatei ?? q.audio,
    "audio"
  );

  const hangul = firstMediaText(q.hangul);

  // Wenn eine MP3-Datei vorhanden ist,
  // wird diese bevorzugt abgespielt.
  if (audioPath) {
    currentPronunciationAudio = new Audio(audioPath);

    currentPronunciationAudio.play().catch(error => {
      console.warn(
        "Audiodatei konnte nicht abgespielt werden:",
        error
      );

      currentPronunciationAudio = null;

      // Falls die MP3 nicht funktioniert,
      // versuchen wir die automatische Sprachausgabe.
      if (hangul) {
        speakKorean(hangul);
      } else {
        alert("Die Audiodatei konnte nicht abgespielt werden.");
      }
    });

  } else if (hangul) {
    speakKorean(hangul);
  }
}


// Bilder und Lautsprecher-Button anzeigen
function renderQuestionMedia(q, target, afterAnswer) {
  if (!q) return;

  const imagePath = localMediaPath(
    q.bild ?? q.image,
    "images"
  );

  const audioPath = localMediaPath(
    q.audiodatei ?? q.audio,
    "audio"
  );

  const hangul = firstMediaText(q.hangul);
  const koreanTerm = firstMediaText(q.koreanTerm);

  const questionText =
    typeof q.question === "string"
      ? q.question
      : "";

  // Verhindern, dass die Aussprache
  // vorzeitig die richtige Antwort verrät.
  const termAlreadyVisible =
    koreanTerm &&
    questionText
      .toLocaleLowerCase("de")
      .includes(
        koreanTerm.toLocaleLowerCase("de")
      );

  const showAudio =
    !!(audioPath || hangul) &&
    (afterAnswer || termAlreadyVisible);

  // Bilder normalerweise erst nach der Antwort zeigen.
  const showImage =
    !!imagePath &&
    (afterAnswer || q.medienVorAntwort === true);

  if (!showAudio && !showImage) return;

  const mediaBox = document.createElement("div");
  mediaBox.className = "quizMedia";

  // Bild anzeigen
  if (showImage) {
    const img = document.createElement("img");

    img.src = imagePath;

    img.alt =
      firstMediaText(
        q.bildbeschreibung ?? q.imageAlt
      ) || "Bild zum Lernstoff";

    img.loading = "lazy";

    img.style.cssText = `
      display: block;
      max-width: 100%;
      max-height: 260px;
      object-fit: contain;
      margin: 12px 0;
      border-radius: 10px;
    `;

    img.addEventListener("error", () => {
      console.warn(
        "Bild konnte nicht geladen werden:",
        imagePath
      );

      img.remove();
    });

    mediaBox.appendChild(img);
  }

  // Lautsprecher-Button anzeigen
  if (showAudio) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "mediaButton";

    button.textContent = "🔊 Aussprache anhören";
    button.style.margin = "8px 0";

    button.addEventListener("click", () => {
      playPronunciation(q);
    });

    mediaBox.appendChild(button);
  }

  target.appendChild(mediaBox);
}


// =========================================================
// UTILS
// =========================================================

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}


function getSavedDifficulty(user) {
  const saved = localStorage.getItem(
    `${user}_difficulty`
  );

  const validGrades = [
    "k10",
    "k9",
    "k8",
    "k7",
    "k6",
    "k5",
    "k4",
    "k3",
    "k2",
    "k1",
    "d1"
  ];

  return validGrades.includes(saved)
    ? saved
    : "k10";
}


// =========================================================
// BOOT
// =========================================================

window.onload = function() {
  const lastUser = localStorage.getItem("lastUser") || "";

  if (lastUser) {
    document.getElementById("username").value = lastUser;

    if (loadUserData(lastUser)) {
      document.getElementById("difficulty").value =
        getSavedDifficulty(lastUser);

      updateUI();
      showLastUserInfo(lastUser);
    }

  } else {
    updateUI();
    showLastUserInfo("");
  }
};


function showLastUserInfo(name) {
  const info = document.getElementById("lastUserInfo");

  if (info) {
    info.textContent = name
      ? `Zuletzt gespielt: ${name}`
      : "";
  }
}


// =========================================================
// PERSISTENCE
// =========================================================

function loadUserData(username) {
  currentUser = (username || "").trim();

  if (!currentUser) {
    alert("Bitte gib einen Benutzernamen ein.");
    return false;
  }

  level =
    parseInt(
      localStorage.getItem(`${currentUser}_level`)
    ) || 1;

  xp =
    parseInt(
      localStorage.getItem(`${currentUser}_xp`)
    ) || 0;

  return true;
}


function updateUI() {
  document.getElementById("userLevel").innerText = level;

  document.getElementById("levelBar").value = xp % 100;

  document.getElementById("xpHint").innerText =
    `(${xp % 100} / 100 XP bis zum nächsten Level)`;

  const k10 = document.querySelector(
    "#difficulty option[value='k10']"
  );

  const k9 = document.querySelector(
    "#difficulty option[value='k9']"
  );

  const k8 = document.querySelector(
    "#difficulty option[value='k8']"
  );

  const k7 = document.querySelector(
    "#difficulty option[value='k7']"
  );

  const k6 = document.querySelector(
    "#difficulty option[value='k6']"
  );

  const k5 = document.querySelector(
    "#difficulty option[value='k5']"
  );

  const k4 = document.querySelector(
    "#difficulty option[value='k4']"
  );

  const k3 = document.querySelector(
    "#difficulty option[value='k3']"
  );

  const k2 = document.querySelector(
    "#difficulty option[value='k2']"
  );

  const k1 = document.querySelector(
    "#difficulty option[value='k1']"
  );

  const d1 = document.querySelector(
    "#difficulty option[value='d1']"
  );
}


// =========================================================
// QUIZ FLOW
// =========================================================

function startQuiz() {
  const usernameInput =
    document.getElementById("username").value;

  if (!loadUserData(usernameInput)) return;

  localStorage.setItem("lastUser", currentUser);

  const difficulty =
    document.getElementById("difficulty").value;

  localStorage.setItem(
    `${currentUser}_difficulty`,
    difficulty
  );

  // Prüfen, ob die Fragen geladen wurden
  if (!questionsLoaded) {
    alert(
      "Die Fragen werden noch geladen oder konnten nicht geladen werden."
    );
    return;
  }

  // Fragen für Kategorie und Graduierung laden
  const availableQuestions =
    questionsByCategory[currentCategory]?.[difficulty];

  if (
    !Array.isArray(availableQuestions) ||
    availableQuestions.length === 0
  ) {
    alert(
      "Für diese Kategorie und Graduierung sind keine Fragen vorhanden."
    );
    return;
  }

  // Zufällige Auswahl
  const pool = [...availableQuestions];

  shuffle(pool);

  const questionCountByDifficulty = {
    k10: 5,
    k8: 7,
    k6: 10,
    k4: 12
  };

  const COUNT =
    questionCountByDifficulty[difficulty] || 5;

  questions = pool.slice(
    0,
    Math.min(COUNT, pool.length)
  );

  document.getElementById("startScreen")
    .classList.add("hidden");

  document.getElementById("quizScreen")
    .classList.remove("hidden");

  document.getElementById("endScreen")
    .classList.add("hidden");

  currentQuestion = 0;
  score = 0;
  awaitingNext = false;

  showQuestion();
}


// =========================================================
// FRAGE ANZEIGEN
// =========================================================

function showQuestion() {
  stopPronunciation();

  const container =
    document.getElementById("questionContainer");

  const checkBtn =
    document.getElementById("checkBtn");

  const nextBtn =
    document.getElementById("nextBtn");

  const feedback =
    document.getElementById("feedback");

  container.innerHTML = "";

  checkBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");

  feedback.classList.add("hidden");
  feedback.innerHTML = "";

  awaitingNext = false;

  const q = questions[currentQuestion];

  currentDragMulti = !!q.multi;

  const header = document.createElement("div");
  header.className = "question";

  header.innerText =
    `Frage ${currentQuestion + 1}:`;

  container.appendChild(header);

  // Fragetext anzeigen
  if (q.type !== "gapdrag") {
    const text = document.createElement("div");

    text.className = "muted";
    text.style.marginBottom = ".75rem";
    text.textContent = q.question;

    container.appendChild(text);
  }

  // Medien anzeigen
  renderQuestionMedia(q, container, false);


  // =====================================================
  // SINGLE CHOICE
  // =====================================================

  if (q.type === "sc") {
    const answersEl = document.createElement("div");
    answersEl.className = "answers";

    const shuffledAnswers = q.answers.map(
      (answer, idx) => ({
        text: answer,
        originalIndex: idx
      })
    );

    shuffle(shuffledAnswers);

    shuffledAnswers.forEach(answerObj => {
      const btn = document.createElement("button");

      btn.textContent = answerObj.text;

      btn.onclick = () => {
        if (awaitingNext) return;

        const ok =
          answerObj.originalIndex === q.correct;

        submitAnswer(ok, {
          userText: answerObj.text,
          correctText: q.answers[q.correct]
        });
      };

      answersEl.appendChild(btn);
    });

    container.appendChild(answersEl);
  }


  // =====================================================
  // MULTIPLE CHOICE
  // =====================================================

  if (q.type === "mc") {
    const answersEl = document.createElement("div");

    answersEl.className =
      "answers multiAnswers";

    const shuffledAnswers = q.answers.map(
      (answer, idx) => ({
        text: answer,
        originalIndex: idx
      })
    );

    shuffle(shuffledAnswers);

    shuffledAnswers.forEach(answerObj => {
      const label = document.createElement("label");
      label.className = "multiOption";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = answerObj.originalIndex;

      const span = document.createElement("span");
      span.textContent = answerObj.text;

      label.appendChild(checkbox);
      label.appendChild(span);

      answersEl.appendChild(label);
    });

    container.appendChild(answersEl);

    checkBtn.classList.remove("hidden");
  }


  // =====================================================
  // LÜCKENTEXT
  // =====================================================

  if (q.type === "gap") {
    const input = document.createElement("input");

    input.type = "text";
    input.className = "gapInput";

    input.placeholder = "Antwort hier eingeben…";

    input.addEventListener("input", () => {
      checkBtn.classList.toggle(
        "hidden",
        input.value.trim().length === 0
      );
    });

    container.appendChild(input);
  }


  // =====================================================
  // DRAG & DROP
  // =====================================================

  if (q.type === "drag") {
    renderDragMatch(container, q);

    checkBtn.classList.remove("hidden");
  }


  // =====================================================
  // GAP DRAG
  // =====================================================

  if (q.type === "gapdrag") {
    renderGapDrag(container, q);

    checkBtn.classList.remove("hidden");
  }


  // =====================================================
  // LISTENFRAGEN
  // =====================================================

  if (q.type === "list") {
    const info = document.createElement("p");

    info.className = "muted";

    info.innerText =
      q.hint ||
      "Eine Antwort pro Zeile (oder mit Kommas trennen).";

    container.appendChild(info);

    const area = document.createElement("textarea");

    area.className = "listInput";
    area.rows = 5;

    area.placeholder = "z. B.\nrot\nblau\ngelb";

    area.addEventListener("input", () => {
      const hasText = area.value.trim().length > 0;

      checkBtn.classList.toggle(
        "hidden",
        !hasText
      );
    });

    container.appendChild(area);
  }

  document.getElementById("progressBar").value =
    (currentQuestion / questions.length) * 100;
}


// =========================================================
// ANTWORT PRÜFEN
// =========================================================

function checkInteractiveAnswer() {
  if (awaitingNext) return;

  const q = questions[currentQuestion];


  // Lückentext
  if (q.type === "gap") {
    const val = (
      document.querySelector(".gapInput")?.value || ""
    ).trim();

    const ok = (
      Array.isArray(q.correct)
        ? q.correct
        : [q.correct]
    )
      .map(x => x.toLowerCase())
      .includes(val.toLowerCase());

    submitAnswer(ok, {
      userText: val,
      correctText: (q.correct || []).join(" / ")
    });

    return;
  }


  // Drag & Drop
  if (q.type === "drag") {
    const ok = checkDragMatch(q);

    submitAnswer(ok, {
      userText: buildDragUserText(q),
      correctText: buildDragCorrectText(q)
    });

    return;
  }


  // GapDrag
  if (q.type === "gapdrag") {
    const ok = checkGapDrag(q);

    const correctText = q.correct
      .map(arr => arr.join(" / "))
      .join(" | ");

    submitAnswer(ok, {
      userText: buildGapDragUserText(),
      correctText
    });

    return;
  }


  // Listenfragen
  if (q.type === "list") {
    const ok = checkListAnswer(q);

    const raw =
      document.querySelector(".listInput")?.value || "";

    submitAnswer(ok, {
      userText: raw.trim(),
      correctText: q.correct.join(", ")
    });

    return;
  }


  // Multiple Choice
  if (q.type === "mc") {
    const selected = [
      ...document.querySelectorAll(
        ".multiOption input:checked"
      )
    ]
      .map(cb => Number(cb.value))
      .sort((a, b) => a - b);

    const correct = [...q.correct]
      .sort((a, b) => a - b);

    const ok =
      selected.length === correct.length &&
      selected.every(
        (v, i) => v === correct[i]
      );

    const userText = selected
      .map(i => q.answers[i])
      .join(", ");

    const correctText = correct
      .map(i => q.answers[i])
      .join(", ");

    submitAnswer(ok, {
      userText: userText || "–",
      correctText
    });
  }
}


// =========================================================
// ANTWORT ABSCHICKEN
// =========================================================

function submitAnswer(isCorrect, details) {
  const checkBtn =
    document.getElementById("checkBtn");

  const nextBtn =
    document.getElementById("nextBtn");

  const feedback =
    document.getElementById("feedback");

  if (isCorrect) score++;

  disableQuestionInputs();

  feedback.classList.remove("hidden");

  feedback.innerHTML = `
    <div class="fbTitle">
      ${isCorrect ? "✅ Richtig!" : "❌ Falsch"}
    </div>

    <div class="fbLine">
      <strong>Deine Antwort:</strong>
      ${escapeHtml(details?.userText ?? "") || "–"}
    </div>

    <div class="fbLine">
      <strong>Richtige Antwort:</strong>
      ${escapeHtml(details?.correctText ?? "") || "–"}
    </div>
  `;

  // Nach der Antwort:
  // Bild und Aussprache freigeben
  renderQuestionMedia(
    questions[currentQuestion],
    feedback,
    true
  );

  checkBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");

  awaitingNext = true;
}


// =========================================================
// NÄCHSTE FRAGE
// =========================================================

function nextQuestion() {
  if (!awaitingNext) return;

  currentQuestion++;

  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    showResult();
  }
}


// =========================================================
// EINGABEN DEAKTIVIEREN
// =========================================================

function disableQuestionInputs() {
  document
    .querySelectorAll("#questionContainer button")
    .forEach(b => b.disabled = true);

  const gap = document.querySelector(".gapInput");

  if (gap) gap.disabled = true;

  const list = document.querySelector(".listInput");

  if (list) list.disabled = true;

  document
    .querySelectorAll(".draggable")
    .forEach(chip => chip.draggable = false);
}


// =========================================================
// DRAG & DROP MATCH
// =========================================================

function renderDragMatch(container, q) {
  const wrap = document.createElement("div");
  wrap.className = "dragWrap";

  const bank = document.createElement("div");
  bank.className = "dragBank";
  bank.dataset.role = "bank";

  enableDrop(bank);

  shuffle([...q.items]).forEach(item => {
    bank.appendChild(
      makeDraggableChip(item.id, item.label)
    );
  });

  const slotsWrap = document.createElement("div");
  slotsWrap.className = "slotsWrap";

  q.slots.forEach(slot => {
    const slotEl = document.createElement("div");

    slotEl.className = "dropSlot";
    slotEl.dataset.slotId = slot.id;

    const label = document.createElement("div");
    label.className = "slotLabel";
    label.textContent = slot.label;

    const content = document.createElement("div");
    content.className = "slotContent";

    slotEl.appendChild(label);
    slotEl.appendChild(content);

    enableDrop(slotEl);

    slotsWrap.appendChild(slotEl);
  });

  wrap.appendChild(bank);
  wrap.appendChild(slotsWrap);

  container.appendChild(wrap);
}


// =========================================================
// DRAGGABLE CHIP
// =========================================================

function makeDraggableChip(id, label) {
  const chip = document.createElement("div");

  chip.className = "draggable";
  chip.draggable = true;

  chip.dataset.itemId = id;
  chip.textContent = label;

  chip.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", id);
  });

  return chip;
}


// =========================================================
// DROP AKTIVIEREN
// =========================================================

function enableDrop(target) {
  target.addEventListener(
    "dragover",
    e => e.preventDefault()
  );

  target.addEventListener("drop", e => {
    e.preventDefault();

    if (awaitingNext) return;

    const id =
      e.dataTransfer.getData("text/plain");

    const dragged = document.querySelector(
      `.draggable[data-item-id="${CSS.escape(id)}"]`
    );

    if (!dragged) return;

    const bank =
      document.querySelector(".dragBank");

    if (
      target.classList.contains("dropSlot") ||
      target.classList.contains("dropBlank")
    ) {
      const content =
        target.querySelector(".slotContent");

      if (!currentDragMulti) {
        const existing =
          content.querySelector(".draggable");

        if (existing && bank) {
          bank.appendChild(existing);
        }
      }

      content.appendChild(dragged);

      document.getElementById("checkBtn")
        .classList.remove("hidden");

      return;
    }

    if (target.dataset.role === "bank") {
      target.appendChild(dragged);

      document.getElementById("checkBtn")
        .classList.remove("hidden");
    }
  });
}


// =========================================================
// DRAG MATCH PRÜFEN
// =========================================================

function checkDragMatch(q) {
  for (
    const [itemId, neededSlot]
    of Object.entries(q.correct)
  ) {
    const chip = document.querySelector(
      `.draggable[data-item-id="${CSS.escape(itemId)}"]`
    );

    if (!chip) return false;

    const slot = chip.closest(".dropSlot");

    if (
      !slot ||
      slot.dataset.slotId !== neededSlot
    ) {
      return false;
    }
  }

  return true;
}


// =========================================================
// RICHTIGE DRAG-ANTWORT
// =========================================================

function buildDragCorrectText(q) {
  const slotLabelById = Object.fromEntries(
    q.slots.map(s => [s.id, s.label])
  );

  const itemLabelById = Object.fromEntries(
    q.items.map(i => [i.id, i.label])
  );

  const groups = {};

  for (
    const [itemId, slotId]
    of Object.entries(q.correct)
  ) {
    if (!groups[slotId]) {
      groups[slotId] = [];
    }

    groups[slotId].push(
      itemLabelById[itemId] || itemId
    );
  }

  return Object.entries(groups)
    .map(([slotId, items]) => {
      return `${
        slotLabelById[slotId] || slotId
      }: ${items.join(", ")}`;
    })
    .join(" | ");
}


// =========================================================
// DRAG-ANTWORT DES BENUTZERS
// =========================================================

function buildDragUserText(q) {
  const slotLabelById = Object.fromEntries(
    q.slots.map(s => [s.id, s.label])
  );

  const parts = [];

  document
    .querySelectorAll(".dropSlot")
    .forEach(slot => {
      const slotId = slot.dataset.slotId;

      const labels = Array.from(
        slot.querySelectorAll(
          ".slotContent .draggable"
        )
      ).map(ch => ch.textContent.trim());

      parts.push(
        `${
          slotLabelById[slotId] || slotId
        }: ${
          labels.length
            ? labels.join(", ")
            : "—"
        }`
      );
    });

  return parts.join(" | ");
}


// =========================================================
// GAPDRAG
// =========================================================

function renderGapDrag(container, q) {
  const wrap = document.createElement("div");
  wrap.className = "gapDragWrap";

  const sentence = document.createElement("div");
  sentence.className = "gapSentence";

  q.question.split(/(__)/g).forEach(part => {
    if (part === "__") {
      const blank = document.createElement("span");
      blank.className = "dropBlank";

      const content = document.createElement("span");
      content.className = "slotContent";

      blank.appendChild(content);

      enableDrop(blank);

      sentence.appendChild(blank);

    } else {
      const t = document.createElement("span");

      t.textContent = part;

      sentence.appendChild(t);
    }
  });

  const bank = document.createElement("div");
  bank.className = "dragBank";
  bank.dataset.role = "bank";

  enableDrop(bank);

  shuffle([...q.bank]).forEach((label, idx) => {
    bank.appendChild(
      makeDraggableChip(`gap_${idx}`, label)
    );
  });

  wrap.appendChild(sentence);
  wrap.appendChild(bank);

  container.appendChild(wrap);
}


// =========================================================
// GAPDRAG PRÜFEN
// =========================================================

function checkGapDrag(q) {
  const blanks = [
    ...document.querySelectorAll(
      ".dropBlank .slotContent"
    )
  ];

  const correct = q.correct.map(
    c => Array.isArray(c) ? c : [c]
  );

  if (blanks.length !== correct.length) {
    return false;
  }

  return blanks.every((slot, i) => {
    const chip =
      slot.querySelector(".draggable");

    if (!chip) return false;

    const text = chip.textContent
      .trim()
      .toLowerCase();

    return correct[i]
      .map(x => x.toLowerCase())
      .includes(text);
  });
}


// =========================================================
// GAPDRAG-ANTWORT
// =========================================================

function buildGapDragUserText() {
  const blanks = [
    ...document.querySelectorAll(
      ".dropBlank .slotContent"
    )
  ];

  return blanks.map((slot, i) => {
    const chip =
      slot.querySelector(".draggable");

    return `Lücke ${i + 1}: ${
      chip
        ? chip.textContent.trim()
        : "—"
    }`;
  }).join(" | ");
}


// =========================================================
// LISTENFRAGEN
// =========================================================

function normalizeAnswer(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}


function normalizeListInput(text) {
  return text
    .split(/[\n,]+/g)
    .map(normalizeAnswer)
    .filter(Boolean);
}


function checkListAnswer(q) {
  const raw =
    document.querySelector(".listInput")?.value || "";

  const userSet = Array.from(
    new Set(normalizeListInput(raw))
  );

  const correctSet = Array.from(
    new Set(
      (q.correct || []).map(normalizeAnswer)
    )
  );

  if (userSet.length !== correctSet.length) {
    return false;
  }

  userSet.sort();
  correctSet.sort();

  return userSet.every(
    (v, i) => v === correctSet[i]
  );
}


// =========================================================
// ERGEBNIS / XP
// =========================================================

function showResult() {
  stopPronunciation();

  document.getElementById("quizScreen")
    .classList.add("hidden");

  document.getElementById("endScreen")
    .classList.remove("hidden");

  document.getElementById("resultText").textContent =
    `Du hast ${score} von ${questions.length} Fragen richtig beantwortet.`;

  updateXP();
}


// =========================================================
// XP AKTUALISIEREN
// =========================================================

function updateXP() {
  const percent =
    (score / questions.length) * 100;

  xp += Math.round(percent);

  while (xp >= 100) {
    xp -= 100;
    level++;
  }

  localStorage.setItem(
    `${currentUser}_level`,
    level
  );

  localStorage.setItem(
    `${currentUser}_xp`,
    xp
  );

  updateUI();
}


// =========================================================
// ZURÜCK ZUM MENÜ
// =========================================================

function backToMenu() {
  stopPronunciation();

  document.getElementById("endScreen")
    .classList.add("hidden");

  document.getElementById("quizScreen")
    .classList.add("hidden");

  document.getElementById("startScreen")
    .classList.remove("hidden");

  if (currentUser) {
    document.getElementById("difficulty").value =
      getSavedDifficulty(currentUser);
  }

  updateUI();
}


// =========================================================
// QUIZ ABBRECHEN
// =========================================================

function cancelQuiz() {
  stopPronunciation();

  document.getElementById("quizScreen")
    .classList.add("hidden");

  document.getElementById("startScreen")
    .classList.remove("hidden");

  updateUI();
}


// =========================================================
// FORTSCHRITT ZURÜCKSETZEN
// =========================================================

function resetProgress() {
  const user =
    document.getElementById("username").value.trim() ||
    currentUser;

  if (!user) {
    alert("Bitte gib zuerst deinen Benutzernamen ein.");
    return;
  }

  if (
    !confirm(
      `Fortschritt von "${user}" wirklich löschen?`
    )
  ) {
    return;
  }

  localStorage.removeItem(
    `${user}_level`
  );

  localStorage.removeItem(
    `${user}_xp`
  );

  level = 1;
  xp = 0;

  updateUI();
}


// =========================================================
// BENUTZER LADEN
// =========================================================

function loadExistingUser() {
  const name =
    document.getElementById("username").value.trim();

  if (!name) {
    alert("Bitte gib einen Benutzernamen ein.");
    return;
  }

  if (!loadUserData(name)) return;

  localStorage.setItem("lastUser", name);

  document.getElementById("difficulty").value =
    getSavedDifficulty(name);

  showLastUserInfo(name);

  updateUI();
}


// =========================================================
// HTML ESCAPEN
// =========================================================

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =========================================================
// KATEGORIEN
// =========================================================

let currentCategory = "grundlagen";


// Kategorie auswählen
function selectCategory(cat) {
  currentCategory = cat;

  document.getElementById("categoryScreen")
    .classList.add("hidden");

  document.getElementById("startScreen")
    .classList.remove("hidden");
}


// Zurück zur Kategorieauswahl
function backToCategories() {
  stopPronunciation();

  document.getElementById("startScreen")
    .classList.add("hidden");

  document.getElementById("quizScreen")
    .classList.add("hidden");

  document.getElementById("endScreen")
    .classList.add("hidden");

  document.getElementById("categoryScreen")
    .classList.remove("hidden");
}