// ===== Fragenkatalog (beliebig erweiterbar) =====
const questionBank = {
  easy: [
    { q: "Was ist 2 + 2?", a: ["3", "4", "5"], c: 1 },
    { q: "Hauptstadt von Deutschland?", a: ["Berlin", "München", "Hamburg"], c: 0 },
    { q: "Welche Farbe hat der Himmel (tagsüber)?", a: ["Blau", "Grün", "Rot"], c: 0 },
    { q: "Wie viele Tage hat eine Woche?", a: ["5", "7", "10"], c: 1 },
    { q: "Welche Zahl ist gerade?", a: ["3", "5", "6"], c: 2 },
  ],
  medium: [
    { q: "Wurzel von 81?", a: ["7", "8", "9"], c: 2 },
    { q: "4. Planet von der Sonne?", a: ["Mars", "Venus", "Jupiter"], c: 0 },
    { q: "Fläche eines Quadrats mit Seite 5?", a: ["10", "20", "25"], c: 2 },
    { q: "Hauptstadt von Italien?", a: ["Rom", "Mailand", "Neapel"], c: 0 },
    { q: "Primzahl?", a: ["21", "19", "27"], c: 1 },
  ],
  hard: [
    { q: "13 × 17 = ?", a: ["221", "231", "241"], c: 1 },
    { q: "Chemisches Symbol für Blei?", a: ["Pb", "Pl", "Be"], c: 0 },
    { q: "π ungefähr?", a: ["3,14", "2,71", "1,41"], c: 0 },
    { q: "log₂(32) = ?", a: ["4", "5", "6"], c: 1 },
    { q: "Hauptstadt von Kanada?", a: ["Toronto", "Ottawa", "Vancouver"], c: 1 },
  ],
  extreme: [
    { q: "log₁₀(100) = ?", a: ["1", "2", "10"], c: 1 },
    { q: "Wie viele Chromosomen hat der Mensch?", a: ["46", "23", "44"], c: 0 },
    { q: "Ableitung von x³?", a: ["3x²", "2x", "x²"], c: 0 },
    { q: "Avogadro-Konstante ~?", a: ["6,02×10²³", "3,00×10⁸", "9,81"], c: 0 },
    { q: "Hauptstadt von Australien?", a: ["Sydney", "Melbourne", "Canberra"], c: 2 },
  ],
};

// Wieviele Fragen je Durchlauf?
const NUM_QUESTIONS = {
  easy: 3,
  medium: 3,
  hard: 3,
  extreme: 3,
};

let currentQuestion = 0;
let score = 0;
let questions = [];
let level = 1;
let xp = 0;
let currentUser = "";

// ===== Utils: Shuffle & Auswahl ohne Doppelungen =====
function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function getRandomQuestions(pool, count) {
  const copy = pool.slice();       // Original nicht verändern
  shuffleInPlace(copy);            // Fisher–Yates
  return copy.slice(0, Math.min(count, copy.length));
}

// ===== App Bootstrap =====
window.onload = function () {
  const lastUser = localStorage.getItem('lastUser') || "";
  if (lastUser) {
    document.getElementById("username").value = lastUser;
    if (loadUserData(lastUser)) {
      // gespeicherte Schwierigkeit nur hier vorwählen
      document.getElementById("difficulty").value = getSavedDifficulty(lastUser);
      updateUI();
      showLastUserInfo(lastUser);
    }
  } else {
    updateUI();
    showLastUserInfo("");
  }
};

function getSavedDifficulty(user) {
  return localStorage.getItem(`${user}_difficulty`) || "easy";
}
function showLastUserInfo(name) {
  document.getElementById("lastUserInfo").textContent = name ? `Zuletzt gespielt: ${name}` : "";
}

// ===== Persistence =====
function loadUserData(username) {
  currentUser = (username || "").trim();
  if (!currentUser) { alert("Bitte gib einen Benutzernamen ein."); return false; }
  level = parseInt(localStorage.getItem(`${currentUser}_level`)) || 1;
  xp = parseInt(localStorage.getItem(`${currentUser}_xp`)) || 0;
  return true;
}
function saveUserMeta() { localStorage.setItem('lastUser', currentUser); }

// ===== UI =====
function updateUI() {
  document.getElementById("userLevel").innerText = level;
  document.getElementById("levelBar").value = xp % 100;
  document.getElementById("levelBar").max = 100;
  document.getElementById("xpHint").innerText = `(${xp % 100} / 100 XP bis zum nächsten Level)`;

  const medium = document.querySelector("#difficulty option[value='medium']");
  const hard = document.querySelector("#difficulty option[value='hard']");
  const extreme = document.querySelector("#difficulty option[value='extreme']");
  medium.disabled = level < 2;
  hard.disabled = level < 4;
  extreme.disabled = level < 6;
}

function startQuiz() {
  const usernameInput = document.getElementById("username").value;
  if (!loadUserData(usernameInput)) return;
  saveUserMeta();
  updateUI();

  const difficulty = document.getElementById("difficulty").value;
  localStorage.setItem(`${currentUser}_difficulty`, difficulty);

  // >>> Zufällige Auswahl ohne Doppelungen für diesen Durchlauf:
  const pool = questionBank[difficulty] || [];
  const count = NUM_QUESTIONS[difficulty] ?? pool.length;
  questions = getRandomQuestions(pool, count);

  // Screens
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");
  document.getElementById("endScreen").classList.add("hidden");

  currentQuestion = 0;
  score = 0;
  showQuestion();
}

function showQuestion() {
  const container = document.getElementById("questionContainer");
  container.innerHTML = "";
  const q = questions[currentQuestion];

  const questionEl = document.createElement("div");
  questionEl.className = "question";
  questionEl.innerText = `Frage ${currentQuestion + 1}: ${q.q}`;
  container.appendChild(questionEl);

  const answersEl = document.createElement("div");
  answersEl.className = "answers";
  q.a.forEach((answer, index) => {
    const btn = document.createElement("button");
    btn.innerText = answer;
    btn.onclick = () => handleAnswer(index);
    answersEl.appendChild(btn);
  });
  container.appendChild(answersEl);

  document.getElementById("progressBar").value = (currentQuestion / questions.length) * 100;
}

function handleAnswer(selectedIndex) {
  if (selectedIndex === questions[currentQuestion].c) score++;
  currentQuestion++;
  if (currentQuestion < questions.length) showQuestion(); else showResult();
}

function showResult() {
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("endScreen").classList.remove("hidden");
  document.getElementById("resultText").innerText =
    `Du hast ${score} von ${questions.length} Fragen richtig beantwortet.`;
  updateXP();
}

function updateXP() {
  const percent = (score / questions.length) * 100;
  let gainedXP = Math.round(percent);
  xp += gainedXP;
  while (xp >= 100) { xp -= 100; level++; }
  localStorage.setItem(`${currentUser}_level`, level);
  localStorage.setItem(`${currentUser}_xp`, xp);
  updateUI();
}

function backToMenu() {
  document.getElementById("endScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  if (currentUser) document.getElementById("difficulty").value = getSavedDifficulty(currentUser);
  updateUI();
}

function cancelQuiz() {
  document.getElementById("quizScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
  updateUI();
}

function resetProgress() {
  const usernameInput = document.getElementById("username").value.trim();
  const user = usernameInput || currentUser;
  if (!user) { alert("Bitte gib zuerst deinen Benutzernamen ein."); return; }
  if (!confirm(`Fortschritt von "${user}" wirklich löschen?`)) return;
  localStorage.removeItem(`${user}_level`);
  localStorage.removeItem(`${user}_xp`);
  level = 1; xp = 0; updateUI();
}

function loadExistingUser() {
  const name = document.getElementById("username").value.trim();
  if (!name) { alert("Bitte gib einen Benutzernamen ein."); return; }
  if (!loadUserData(name)) return;
  saveUserMeta();
  document.getElementById("difficulty").value = getSavedDifficulty(name);
  showLastUserInfo(name);
  updateUI();
}
