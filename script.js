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

// ---------- Utils ----------
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getSavedDifficulty(user){
  return localStorage.getItem(`${user}_difficulty`) || "10-9";
}

// ---------- Boot ----------
window.onload = function(){
  const lastUser = localStorage.getItem("lastUser") || "";
  if (lastUser){
    document.getElementById("username").value = lastUser;
    if (loadUserData(lastUser)){
      document.getElementById("difficulty").value = getSavedDifficulty(lastUser);
      updateUI();
      showLastUserInfo(lastUser);
    }
  } else {
    updateUI();
    showLastUserInfo("");
  }
};

function showLastUserInfo(name){
  const info = document.getElementById("lastUserInfo");
  if (info) info.textContent = name ? `Zuletzt gespielt: ${name}` : "";
}

// ---------- Persistence ----------
function loadUserData(username){
  currentUser = (username || "").trim();
  if (!currentUser){ alert("Bitte gib einen Benutzernamen ein."); return false; }
  level = parseInt(localStorage.getItem(`${currentUser}_level`)) || 1;
  xp = parseInt(localStorage.getItem(`${currentUser}_xp`)) || 0;
  return true;
}

function updateUI(){
  document.getElementById("userLevel").innerText = level;
  document.getElementById("levelBar").value = xp % 100;
  document.getElementById("xpHint").innerText = `(${xp % 100} / 100 XP bis zum nächsten Level)`;

  const k10 = document.querySelector("#difficulty option[value='k10']");
  const k9 = document.querySelector("#difficulty option[value= 'k9']");
  const k8 = document.querySelector("#difficulty option[value='k8']");
  const k7 = document.querySelector("#diffuculty option[value='k7']");
  const k6 = document.querySelector("#difficulty option[value='k6']");
  const k5 = document.querySelector("#difficulty option[value='k5']");
  const k4 = document.querySelector("#difficulty option[value='k4']");
  const k3 = document.querySelector("#difficulty option[value='k3']");
  const k2 = document.querySelector("#difficulty option[value='k2']");
  const k1 = document.querySelector("#difficulty option[value='k1']");
  const d1 = document.querySelector("#difficulty option[value='d1']");  
}

// ---------- Quiz Flow ----------
function startQuiz(){
  const usernameInput = document.getElementById("username").value;
  if (!loadUserData(usernameInput)) return;

  localStorage.setItem("lastUser", currentUser);

  const difficulty = document.getElementById("difficulty").value;
  localStorage.setItem(`${currentUser}_difficulty`, difficulty);

  // Zufällige Auswahl:
  // Medium soll genau 4 Fragen haben (aus 5 -> List ist zufällig dabei oder nicht)
  const pool = [...questionsByCategory[currentCategory][difficulty]];
  shuffle(pool);

  const questionCountByDifficulty = {
    k10: 5,
    k8: 7,
    k6: 10,
    k4: 12
  };

  const COUNT = questionCountByDifficulty[difficulty] || 5;

  questions = pool.slice(0, Math.min(COUNT, pool.length));

  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");
  document.getElementById("endScreen").classList.add("hidden");

  currentQuestion = 0;
  score = 0;
  awaitingNext = false;

  showQuestion();

  if (!questionsLoaded) {
  alert("Die Fragen werden noch geladen oder konnten nicht geladen werden.");
  return;
}
}

function showQuestion(){
  const container = document.getElementById("questionContainer");
  const checkBtn  = document.getElementById("checkBtn");
  const nextBtn   = document.getElementById("nextBtn");
  const feedback  = document.getElementById("feedback");

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
  header.innerText = `Frage ${currentQuestion + 1}:`;
  container.appendChild(header);

  if (q.type !== "gapdrag"){
    const text = document.createElement("div");
    text.className = "muted";
    text.style.marginBottom = ".75rem";
    text.textContent = q.question;
    container.appendChild(text);
  }

  if (q.type === "sc"){
    const answersEl = document.createElement("div");
    answersEl.className = "answers";
    const shuffledAnswers = q.answers.map((answer, idx) => ({
      text: answer,
      originalIndex: idx
    }));

  shuffle(shuffledAnswers);

  shuffledAnswers.forEach(answerObj => {
    const btn = document.createElement("button");
    btn.textContent = answerObj.text;

    btn.onclick = () => {
      if (awaitingNext) return;

      const ok = answerObj.originalIndex === q.correct;

      submitAnswer(ok, {
        userText: answerObj.text,
        correctText: q.answers[q.correct]
      });
    };

    answersEl.appendChild(btn);
  });
    container.appendChild(answersEl);
  }

  if (q.type === "mc"){
  const answersEl = document.createElement("div");
  answersEl.className = "answers multiAnswers";

  const shuffledAnswers = q.answers.map((answer, idx) => ({
    text: answer,
    originalIndex: idx
  }));

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

  if (q.type === "gap"){
    const input = document.createElement("input");
    input.type = "text";
    input.className = "gapInput";
    input.placeholder = "Antwort hier eingeben…";
    input.addEventListener("input", () => {
      checkBtn.classList.toggle("hidden", input.value.trim().length === 0);
    });
    container.appendChild(input);
  }

  if (q.type === "drag"){
    renderDragMatch(container, q);
    checkBtn.classList.remove("hidden");
  }

  if (q.type === "gapdrag"){
    renderGapDrag(container, q);
    checkBtn.classList.remove("hidden");
  }

  if (q.type === "list"){
    const info = document.createElement("p");
    info.className = "muted";
    info.innerText = q.hint || "Eine Antwort pro Zeile (oder mit Kommas trennen).";
    container.appendChild(info);

    const area = document.createElement("textarea");
    area.className = "listInput";
    area.rows = 5;
    area.placeholder = "z. B.\nrot\nblau\ngelb";
    area.addEventListener("input", () => {
      const hasText = area.value.trim().length > 0;
      checkBtn.classList.toggle("hidden", !hasText);
    });
    container.appendChild(area);
  }

  document.getElementById("progressBar").value = (currentQuestion / questions.length) * 100;
}

// Klick auf "Antwort prüfen"
function checkInteractiveAnswer(){
  if (awaitingNext) return;
  const q = questions[currentQuestion];

  if (q.type === "gap"){
    const val = (document.querySelector(".gapInput")?.value || "").trim();
    const ok = (Array.isArray(q.correct) ? q.correct : [q.correct])
      .map(x => x.toLowerCase())
      .includes(val.toLowerCase());
    submitAnswer(ok, { userText: val, correctText: (q.correct || []).join(" / ") });
    return;
  }

  if (q.type === "drag"){
    const ok = checkDragMatch(q);
    submitAnswer(ok, { userText: buildDragUserText(q), correctText: buildDragCorrectText(q) });
    return;
  }

  if (q.type === "gapdrag"){
    const ok = checkGapDrag(q);
    const correctText = q.correct.map(arr => arr.join(" / ")).join(" | ");
    submitAnswer(ok, { userText: buildGapDragUserText(), correctText });
    return;
  }

  if (q.type === "list"){
    const ok = checkListAnswer(q);
    const raw = document.querySelector(".listInput")?.value || "";
    submitAnswer(ok, { userText: raw.trim(), correctText: q.correct.join(", ") });
    return;
  }

  if (q.type === "mc"){
    const selected = [...document.querySelectorAll(".multiOption input:checked")]
      .map(cb => Number(cb.value))
      .sort((a,b) => a-b);

    const correct = [...q.correct].sort((a,b) => a-b);

    const ok =
      selected.length === correct.length &&
      selected.every((v, i) => v === correct[i]);

    const userText = selected.map(i => q.answers[i]).join(", ");
    const correctText = correct.map(i => q.answers[i]).join(", ");

    submitAnswer(ok, {
      userText: userText || "–",
      correctText
    });
  }
}

function submitAnswer(isCorrect, details){
  const checkBtn  = document.getElementById("checkBtn");
  const nextBtn   = document.getElementById("nextBtn");
  const feedback  = document.getElementById("feedback");

  if (isCorrect) score++;
  disableQuestionInputs();

  feedback.classList.remove("hidden");
  feedback.innerHTML = `
    <div class="fbTitle">${isCorrect ? "✅ Richtig!" : "❌ Falsch"}</div>
    <div class="fbLine"><strong>Deine Antwort:</strong> ${escapeHtml(details?.userText ?? "") || "–"}</div>
    <div class="fbLine"><strong>Richtige Antwort:</strong> ${escapeHtml(details?.correctText ?? "") || "–"}</div>
  `;

  checkBtn.classList.add("hidden");
  nextBtn.classList.remove("hidden");
  awaitingNext = true;
}

function nextQuestion(){
  if (!awaitingNext) return;

  currentQuestion++;
  if (currentQuestion < questions.length){
    showQuestion();
  } else {
    showResult();
  }
}

function disableQuestionInputs(){
  document.querySelectorAll("#questionContainer button").forEach(b => b.disabled = true);
  const gap = document.querySelector(".gapInput");
  if (gap) gap.disabled = true;
  const list = document.querySelector(".listInput");
  if (list) list.disabled = true;
  document.querySelectorAll(".draggable").forEach(chip => chip.draggable = false);
}

// ---------- Drag & Drop MATCH ----------
function renderDragMatch(container, q){
  const wrap = document.createElement("div");
  wrap.className = "dragWrap";

  const bank = document.createElement("div");
  bank.className = "dragBank";
  bank.dataset.role = "bank";
  enableDrop(bank);

  shuffle([...q.items]).forEach(item => {
    bank.appendChild(makeDraggableChip(item.id, item.label));
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

function makeDraggableChip(id, label){
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

function enableDrop(target){
  target.addEventListener("dragover", e => e.preventDefault());
  target.addEventListener("drop", e => {
    e.preventDefault();
    if (awaitingNext) return;

    const id = e.dataTransfer.getData("text/plain");
    const dragged = document.querySelector(`.draggable[data-item-id="${CSS.escape(id)}"]`);
    if (!dragged) return;

    const bank = document.querySelector(".dragBank");

    if (target.classList.contains("dropSlot") || target.classList.contains("dropBlank")){
      const content = target.querySelector(".slotContent");

      if (!currentDragMulti){
        const existing = content.querySelector(".draggable");
        if (existing && bank) bank.appendChild(existing);
      }
      content.appendChild(dragged);
      document.getElementById("checkBtn").classList.remove("hidden");
      return;
    }

    if (target.dataset.role === "bank"){
      target.appendChild(dragged);
      document.getElementById("checkBtn").classList.remove("hidden");
    }
  });
}

function checkDragMatch(q){
  for (const [itemId, neededSlot] of Object.entries(q.correct)){
    const chip = document.querySelector(`.draggable[data-item-id="${CSS.escape(itemId)}"]`);
    if (!chip) return false;

    const slot = chip.closest(".dropSlot");

    if (!slot || slot.dataset.slotId !== neededSlot){
      return false;
    }
  }

  return true;
}

function buildDragCorrectText(q){
  const slotLabelById = Object.fromEntries(q.slots.map(s => [s.id, s.label]));
  const itemLabelById = Object.fromEntries(q.items.map(i => [i.id, i.label]));

  const groups = {};
  for (const [itemId, slotId] of Object.entries(q.correct)){
    if (!groups[slotId]) groups[slotId] = [];
    groups[slotId].push(itemLabelById[itemId] || itemId);
  }
  return Object.entries(groups)
    .map(([slotId, items]) => `${slotLabelById[slotId] || slotId}: ${items.join(", ")}`)
    .join(" | ");
}

function buildDragUserText(q){
  const slotLabelById = Object.fromEntries(q.slots.map(s => [s.id, s.label]));
  const parts = [];
  document.querySelectorAll(".dropSlot").forEach(slot => {
    const slotId = slot.dataset.slotId;
    const labels = Array.from(slot.querySelectorAll(".slotContent .draggable")).map(ch => ch.textContent.trim());
    parts.push(`${slotLabelById[slotId] || slotId}: ${labels.length ? labels.join(", ") : "—"}`);
  });
  return parts.join(" | ");
}

// ---------- GapDrag ----------
function renderGapDrag(container, q){
  const wrap = document.createElement("div");
  wrap.className = "gapDragWrap";

  const sentence = document.createElement("div");
  sentence.className = "gapSentence";

  q.question.split(/(__)/g).forEach(part => {
    if (part === "__"){
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
    bank.appendChild(makeDraggableChip(`gap_${idx}`, label));
  });

  wrap.appendChild(sentence);
  wrap.appendChild(bank);
  container.appendChild(wrap);
}

function checkGapDrag(q){
  const blanks = [...document.querySelectorAll(".dropBlank .slotContent")];
  const correct = q.correct.map(c => Array.isArray(c) ? c : [c]);

  if (blanks.length !== correct.length) return false;

  return blanks.every((slot, i) => {
    const chip = slot.querySelector(".draggable");
    if (!chip) return false;
    const text = chip.textContent.trim().toLowerCase();
    return correct[i].map(x => x.toLowerCase()).includes(text);
  });
}

function buildGapDragUserText(){
  const blanks = [...document.querySelectorAll(".dropBlank .slotContent")];
  return blanks.map((slot, i) => {
    const chip = slot.querySelector(".draggable");
    return `Lücke ${i+1}: ${chip ? chip.textContent.trim() : "—"}`;
  }).join(" | ");
}

// ---------- List ----------
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
  const raw = document.querySelector(".listInput")?.value || "";

  const userSet = Array.from(new Set(normalizeListInput(raw)));
  const correctSet = Array.from(new Set((q.correct || []).map(normalizeAnswer)));

  if (userSet.length !== correctSet.length) return false;

  userSet.sort();
  correctSet.sort();

  return userSet.every((v, i) => v === correctSet[i]);
}

// ---------- Result / XP ----------
function showResult(){
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("endScreen").classList.remove("hidden");

  document.getElementById("resultText").textContent =
    `Du hast ${score} von ${questions.length} Fragen richtig beantwortet.`;

  updateXP();
}

function updateXP(){
  const percent = (score / questions.length) * 100;
  xp += Math.round(percent);

  while (xp >= 100){
    xp -= 100;
    level++;
  }

  localStorage.setItem(`${currentUser}_level`, level);
  localStorage.setItem(`${currentUser}_xp`, xp);
  updateUI();
}

function backToMenu(){
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");

  if (currentUser){
    document.getElementById("difficulty").value = getSavedDifficulty(currentUser);
  }
  updateUI();
}

function cancelQuiz(){
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  updateUI();
}

function resetProgress(){
  const user = document.getElementById("username").value.trim() || currentUser;
  if (!user){ alert("Bitte gib zuerst deinen Benutzernamen ein."); return; }
  if (!confirm(`Fortschritt von "${user}" wirklich löschen?`)) return;

  localStorage.removeItem(`${user}_level`);
  localStorage.removeItem(`${user}_xp`);

  level = 1;
  xp = 0;
  updateUI();
}

function loadExistingUser(){
  const name = document.getElementById("username").value.trim();
  if (!name){ alert("Bitte gib einen Benutzernamen ein."); return; }
  if (!loadUserData(name)) return;

  localStorage.setItem("lastUser", name);
  document.getElementById("difficulty").value = getSavedDifficulty(name);
  showLastUserInfo(name);
  updateUI();
}

// ---------- Helpers ----------
function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

//--------- Kategorien -------
let currentCategory = "grundlagen";

function selectCategory(cat){
  currentCategory = cat;

  document.getElementById("categoryScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
}

function backToCategories(){
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("categoryScreen").classList.remove("hidden");
}
