"use strict";

// Lernbereich: liest direkt dieselbe knowledge.jsonc wie dein Generator.
// Es wird weder questions.json noch script.js verändert.

const sectionNames = {
  kommandos: "Kommandos",
  "körperteile": "Körperteile / Trefferflächen",
  richtungen: "Richtungen",
  "höhen": "Höhen",
  stellungen: "Stellungen",
  techniken: "Techniken",
  prinzipien: "Prinzipien",
  regeln: "Regeln",
  formen: "Tul / Formen",
  "gürtelbedeutungen": "Gürtelbedeutungen",
  "prüfungssituationen": "Prüfungssituationen",
  "koreanischeZahlen": "Koreanische Zahlen",
  manuelleFragen: "Zusatzwissen"
};

// Nur Lerninhalte anzeigen, keine absichtlich falschen Quiz-Antworten.
const fieldLabels = {
  koreanisch: "Koreanisch",
  korenaisch: "Koreanisch", // Schreibvariante in einigen bestehenden Einträgen
  deutsch: "Deutsch",
  name: "Bezeichnung",
  beschreibung: "Beschreibung",
  beispiele: "Beispiele",
  trefferfläche: "Trefferfläche",
  richtung: "Richtung",
  "höhe": "Höhe",
  "länge": "Länge",
  breite: "Breite",
  gewichtsverteilung: "Gewichtsverteilung",
  winkelLinkerFuß: "Winkel – linker Fuß",
  winkelRechterFuß: "Winkel – rechter Fuß",
  winkelVordererFuß: "Winkel – vorderer Fuß",
  winkelHintererFuß: "Winkel – hinterer Fuß",
  MPBL: "Messpunkt Breite – linker Fuß",
  MPBR: "Messpunkt Breite – rechter Fuß",
  MPBV: "Messpunkt Breite – vorderer Fuß",
  MPBH: "Messpunkt Breite – hinterer Fuß",
  MPLV: "Messpunkt Länge – vorderer Fuß",
  MPLH: "Messpunkt Länge – hinterer Fuß",
  frage: "Frage",
  question: "Frage",
  richtig: "Richtige Antwort",
  correct: "Richtige Antwort",
  bedeutung: "Bedeutung",
  bewegungen: "Bewegungen",
  diagramm: "Diagramm",
  "gürtel": "Gürtel",
  situation: "Situation",
  zahl: "Zahl"
};

const categoryNames = {
  grundlagen: "Grundlagen",
  theorie: "Theorie",
  technik: "Techniken",
  pruefung: "Prüfung"
};

const searchInput = document.getElementById("suche");
const categorySelect = document.getElementById("kategorie");
const gradeSelect = document.getElementById("graduierung");
const sectionSelect = document.getElementById("thema");
const list = document.getElementById("lernListe");
const counter = document.getElementById("trefferzahl");
const errorMessage = document.getElementById("fehlermeldung");

let allEntries = [];
let currentAudio = null;

function asArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function first(value) {
  return asArray(value).find(v => v != null && String(v).trim()) ?? "";
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalized(value) {
  return cleanText(value)
    .toLocaleLowerCase("de")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// JSONC-Kommentare entfernen, ohne // innerhalb von Texten zu beschädigen.
function removeJsoncComments(source) {
  let result = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++;
      } else if (char === "\n" || char === "\r") {
        result += char;
      }
      continue;
    }

    if (inString) {
      result += char;

      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
    } else if (char === "/" && next === "/") {
      inLineComment = true;
      i++;
    } else if (char === "/" && next === "*") {
      inBlockComment = true;
      i++;
    } else {
      result += char;
    }
  }

  return result;
}

function getKorean(entry) {
  return first(
    entry.koreanisch ??
    entry.korean ??
    entry.korenaisch
  );
}

function getTitle(entry) {
  return cleanText(
    getKorean(entry) ||
    first(entry.name) ||
    first(entry.gürtel) ||
    first(entry.frage ?? entry.question) ||
    first(entry.situation) ||
    entry.id ||
    "Lerninhalt"
  );
}

function getSubtitle(entry) {
  return cleanText(
    first(entry.deutsch ?? entry.german) ||
    first(entry.bedeutung) ||
    first(entry.beschreibung) ||
    first(entry.richtig ?? entry.correct)
  );
}

function flattenKnowledge(knowledge) {
  const entries = [];

  for (const [section, items] of Object.entries(knowledge)) {
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;

      const entry = {
        ...item,
        _section: section,
        _category: cleanText(item.kategorie ?? item.category),
        _grades: asArray(item.graduierungen ?? item.grades)
          .map(g => cleanText(g).toLowerCase()),
        _title: getTitle(item),
        _subtitle: getSubtitle(item)
      };

      const searchable = [
        entry._title,
        entry._subtitle,
        section
      ];

      for (const field of Object.keys(fieldLabels)) {
        searchable.push(
          ...asArray(item[field]).map(cleanText)
        );
      }

      entry._search = normalized(searchable.join(" "));
      entries.push(entry);
    }
  }

  return entries;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text != null) {
    element.textContent = String(text);
  }

  return element;
}

function safeMediaPath(value, directory, extensions) {
  const path = cleanText(first(value)).replace(/^\.\//, "");

  if (
    !path.startsWith(`${directory}/`) ||
    path.includes("..") ||
    path.includes("\\")
  ) {
    return "";
  }

  const extension = path.split(".").pop().toLowerCase();

  return extensions.includes(extension) ? path : "";
}

// Laufende Audioausgabe stoppen
function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

// Koreanische Aussprache über den Browser
function speakHangul(hangul) {
  if (!("speechSynthesis" in window)) {
    alert("Dein Browser unterstützt keine automatische Sprachausgabe.");
    return;
  }

  const speech = new SpeechSynthesisUtterance(hangul);

  speech.lang = "ko-KR";
  speech.rate = 0.85;

  const voices = window.speechSynthesis.getVoices();

  const koreanVoice = voices.find(voice =>
    voice.lang.toLowerCase().startsWith("ko")
  );

  if (koreanVoice) {
    speech.voice = koreanVoice;
  }

  window.speechSynthesis.speak(speech);
}

// MP3 oder Browser-Aussprache abspielen
function playPronunciation(entry) {
  stopAudio();

  const audioPath = safeMediaPath(
    entry.audiodatei ?? entry.audio,
    "audio",
    ["mp3", "wav", "ogg", "m4a"]
  );

  const hangul = cleanText(
    first(entry.hangul ?? entry.hangeul)
  );

  if (audioPath) {
    currentAudio = new Audio(audioPath);

    currentAudio.play().catch(() => {
      currentAudio = null;

      if (hangul) {
        speakHangul(hangul);
      } else {
        alert("Die Audiodatei konnte nicht abgespielt werden.");
      }
    });
  } else if (hangul) {
    speakHangul(hangul);
  }
}

// Lernkarte erstellen
function makeCard(entry) {
  const card = createElement("details", "learn-card");

  const summary = createElement("summary");
  const top = createElement("div", "card-top");

  top.appendChild(
    createElement(
      "span",
      "card-badge",
      sectionNames[entry._section] || entry._section
    )
  );

  top.appendChild(
    createElement("span", "expand-icon", "+")
  );

  summary.appendChild(top);

  summary.appendChild(
    createElement("h2", "card-title", entry._title)
  );

  if (
    entry._subtitle &&
    normalized(entry._subtitle) !== normalized(entry._title)
  ) {
    summary.appendChild(
      createElement("p", "card-subtitle", entry._subtitle)
    );
  }

  const hangul = cleanText(
    first(entry.hangul ?? entry.hangeul)
  );

  if (hangul) {
    const korean = createElement(
      "p",
      "card-hangul",
      hangul
    );

    korean.lang = "ko";
    summary.appendChild(korean);
  }

  card.appendChild(summary);

  const content = createElement("div", "card-details");

  const descriptionList = createElement(
    "dl",
    "detail-list"
  );

  // Informationen aus dem Wissenseintrag anzeigen
  for (const [field, label] of Object.entries(fieldLabels)) {
    const values = asArray(entry[field]).filter(
      value => value != null && cleanText(value) !== ""
    );

    if (values.length === 0) continue;

    const row = createElement("div", "detail-row");

    row.appendChild(
      createElement("dt", "", label)
    );

    const dd = createElement("dd");

    if (
      ["beispiele", "richtig", "correct"].includes(field) &&
      values.length > 1
    ) {
      const ul = createElement("ul");

      for (const value of values) {
        ul.appendChild(
          createElement("li", "", value)
        );
      }

      dd.appendChild(ul);
    } else {
      dd.textContent = values.map(cleanText).join(" · ");
    }

    row.appendChild(dd);
    descriptionList.appendChild(row);
  }

  content.appendChild(descriptionList);

  // Bild anzeigen, falls vorhanden
  const imagePath = safeMediaPath(
    entry.bild ?? entry.image,
    "images",
    ["png", "jpg", "jpeg", "webp", "gif", "svg"]
  );

  if (imagePath) {
    const img = createElement("img", "learn-image");

    img.src = imagePath;

    img.alt = cleanText(
      first(entry.bildbeschreibung ?? entry.imageAlt)
    ) || `Bild zu ${entry._title}`;

    img.loading = "lazy";

    content.appendChild(img);

    const caption = first(
      entry.bildbeschreibung ?? entry.imageAlt
    );

    if (caption) {
      content.appendChild(
        createElement("p", "image-caption", caption)
      );
    }
  }

  // Aussprache-Button anzeigen, falls Audio oder Hangul vorhanden
  const audioPath = safeMediaPath(
    entry.audiodatei ?? entry.audio,
    "audio",
    ["mp3", "wav", "ogg", "m4a"]
  );

  if (audioPath || hangul) {
    const audioButton = createElement(
      "button",
      "audio-button",
      "🔊 Aussprache anhören"
    );

    audioButton.type = "button";

    audioButton.addEventListener("click", () => {
      playPronunciation(entry);
    });

    content.appendChild(audioButton);
  }

  // Hinweis, wenn noch keine Details vorhanden sind
  if (
    descriptionList.childElementCount === 0 &&
    !imagePath &&
    !audioPath &&
    !hangul
  ) {
    content.appendChild(
      createElement(
        "p",
        "",
        "Für diesen Eintrag sind noch keine Details hinterlegt."
      )
    );
  }

  card.appendChild(content);

  return card;
}

// Lernkarten anhand der Filter anzeigen
function render() {
  const search = normalized(searchInput.value);
  const category = categorySelect.value;
  const grade = gradeSelect.value;
  const section = sectionSelect.value;

  const filtered = allEntries.filter(entry => {
    return (
      (category === "alle" || entry._category === category) &&
      (grade === "alle" || entry._grades.includes(grade)) &&
      (section === "alle" || entry._section === section) &&
      (!search || entry._search.includes(search))
    );
  });

  counter.textContent =
    `${filtered.length} von ${allEntries.length} Lerninhalten`;

  list.replaceChildren();

  if (filtered.length === 0) {
    list.appendChild(
      createElement(
        "p",
        "empty-message",
        "Keine passenden Lerninhalte gefunden. Probiere andere Filter aus."
      )
    );

    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of filtered) {
    fragment.appendChild(makeCard(entry));
  }

  list.appendChild(fragment);
}

// Themenbereiche im Dropdown ergänzen
function setupSectionOptions(knowledge) {
  for (const [section, items] of Object.entries(knowledge)) {
    if (!Array.isArray(items) || items.length === 0) {
      continue;
    }

    const option = createElement(
      "option",
      "",
      sectionNames[section] || section
    );

    option.value = section;
    sectionSelect.appendChild(option);
  }
}

// Wissensdatei laden
async function loadKnowledge() {
  try {
    const response = await fetch(
      "knowledge.jsonc",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const source = await response.text();

    const knowledge = JSON.parse(
      removeJsoncComments(source)
    );

    allEntries = flattenKnowledge(knowledge);

    setupSectionOptions(knowledge);

    // Suche auch über URL ermöglichen
    const params = new URLSearchParams(
      window.location.search
    );

    if (params.has("suche")) {
      searchInput.value = params.get("suche");
    }

    render();
  } catch (error) {
    console.error(
      "Fehler beim Laden des Lernstoffs:",
      error
    );

    counter.textContent =
      "Lernstoff konnte nicht geladen werden";

    errorMessage.hidden = false;

    errorMessage.textContent =
      "Die knowledge.jsonc konnte nicht geladen werden. " +
      "Starte die Webseite über Live Server und prüfe, " +
      "ob die Datei im selben Ordner wie lernen.html liegt.";
  }
}

// Suchfeld und Filter aktivieren
for (const input of [
  searchInput,
  categorySelect,
  gradeSelect,
  sectionSelect
]) {
  input.addEventListener(
    input === searchInput ? "input" : "change",
    render
  );
}

// Filter zurücksetzen
document
  .getElementById("zuruecksetzen")
  .addEventListener("click", () => {
    searchInput.value = "";
    categorySelect.value = "alle";
    gradeSelect.value = "alle";
    sectionSelect.value = "alle";

    render();
  });

// Lernbereich starten
loadKnowledge();