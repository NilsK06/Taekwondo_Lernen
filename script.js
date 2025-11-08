const questionsByDifficulty = {
  easy: [
    { question: "Was ist 2 + 2?", answers: ["3", "4", "5"], correct: 1 },
    { question: "Wie heißt die Hauptstadt von Deutschland?", answers: ["Berlin", "München", "Hamburg"], correct: 0 }
  ],
  medium: [
    { question: "Was ist die Wurzel von 81?", answers: ["7", "8", "9"], correct: 2 },
    { question: "Welcher Planet ist der vierte von der Sonne?", answers: ["Mars", "Venus", "Jupiter"], correct: 0 }
  ],
  hard: [
    { question: "Was ist 13 x 17?", answers: ["221", "231", "241"], correct: 1 },
    { question: "Wie lautet das chemische Symbol für Blei?", answers: ["Pb", "Pl", "Be"], correct: 0 }
  ],
  extreme: [
    { question: "Was ist der Logarithmus von 100 zur Basis 10?", answers: ["1", "2", "10"], correct: 1 },
    { question: "Wie viele Chromosomen hat ein Mensch?", answers: ["46", "23", "44"], correct: 0 }
  ]
};

let currentQuestion = 0;
let score = 0;
let questions = [];
let level = 1;
let xp = 0;
let currentUser = "";

window.onload = function () {
  // Nichts laden, bis Benutzername eingegeben wurde
  updateUI();
};

function loadUserData(username) {
  currentUser = username.trim();
  if (!currentUser) {
    alert("Bitte gib einen Benutzernamen ein.");
    return false;
  }

  level = parseInt(localStorage.getItem(`${currentUser}_level`)) || 1;
  xp = parseInt(localStorage.getItem(`${currentUser}_xp`)) || 0;
  return true;
}

function updateUI() {
  document.getElementById("userLevel").innerText = level;
  document.getElementById("levelBar").value = xp % 100;
  document.getElementById("levelBar").max = 100;

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

  updateUI();

  const difficulty = document.getElementById("difficulty").value;
  questions = questionsByDifficulty[difficulty];

  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("quizScreen").classList.remove("hidden");

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
  questionEl.innerText = `Frage ${currentQuestion + 1}: ${q.question}`;
  container.appendChild(questionEl);

  const answersEl = document.createElement("div");
  answersEl.className = "answers";

  q.answers.forEach((answer, index) => {
    const btn = document.createElement("button");
    btn.innerText = answer;
    btn.onclick = () => handleAnswer(index);
    answersEl.appendChild(btn);
  });

  container.appendChild(answersEl);

  document.getElementById("progressBar").value = (currentQuestion / questions.length) * 100;
}

function handleAnswer(selectedIndex) {
  if (selectedIndex === questions[currentQuestion].correct) {
    score++;
  }

  currentQuestion++;

  if (currentQuestion < questions.length) {
    showQuestion();
  } else {
    showResult();
  }
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

  while (xp >= 100) {
    xp -= 100;
    level++;
  }

  // Benutzerdaten speichern
  localStorage.setItem(`${currentUser}_level`, level);
  localStorage.setItem(`${currentUser}_xp`, xp);

  updateUI();
}
