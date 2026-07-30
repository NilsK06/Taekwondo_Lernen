const fs = require("fs");
const path = require("path");

/*
 * Pfade
 *
 * knowledge.jsonc = von mir gepflegte Wissensdatei
 * questions.json  = automatisch erzeugter Fragenkatalog
 */
const knowledgePath = path.join(__dirname, "knowledge.jsonc");
const outputPath = path.join(__dirname, "questions.json");

/*
 * JSONC-Datei einlesen.
 *
 * Unterstützt:
 * // Zeilenkommentare
 * /* Blockkommentare *\/
 *
 * Hinweis:
 * Diese einfache Lösung kann Probleme verursachen, wenn innerhalb
 * eines Textes tatsächlich "//" vorkommt.
 */
const raw = fs.readFileSync(knowledgePath, "utf8");

const cleaned = raw
  .replace(/\/\/.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "");

let knowledge;

try {
  knowledge = JSON.parse(cleaned);
} catch (error) {
  console.error("Die knowledge.jsonc enthält einen Fehler.");
  console.error(error.message);
  process.exit(1);
}

/* =========================================================
   AUSGABESTRUKTUR
   ========================================================= */

const output = {
  grundlagen: createGradeStructure(),
  theorie: createGradeStructure(),
  technik: createGradeStructure(),
  pruefung: createGradeStructure()
};

function createGradeStructure() {
  return {
    k10: [],
    k9: [],
    k8: [],
    k7: [],
    k6: [],
    k5: [],
    k4: [],
    k3: [],
    k2: [],
    k1: [],
    d1: []
  };
}

/* =========================================================
   ALLGEMEINE HILFSFUNKTIONEN
   ========================================================= */

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return [value];
}

function first(value) {
  return asArray(value)[0] || "";
}

function normalize(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function unique(values) {
  const seen = new Set();

  return values.filter(value => {
    if (value === undefined || value === null || value === "") {
      return false;
    }

    const normalized = normalize(value);

    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [array[i], array[randomIndex]] = [
      array[randomIndex],
      array[i]
    ];
  }

  return array;
}

function addQuestion(category, grades, question) {
  const gradeList = asArray(grades);

  if (!output[category]) {
    console.warn(
      `Unbekannte Kategorie "${category}" bei Frage: ${question.question}`
    );
    return;
  }

  if (gradeList.length === 0) {
    console.warn(
      `Keine Graduierung angegeben bei Frage: ${question.question}`
    );
    return;
  }

  gradeList.forEach(grade => {
    const normalizedGrade = String(grade).toLowerCase();

    if (!output[category][normalizedGrade]) {
      console.warn(
        `Unbekannte Graduierung "${grade}" bei Frage: ${question.question}`
      );
      return;
    }

    /*
     * Neue Kopie anlegen, damit jede Graduierung ein eigenes
     * Fragenobjekt erhält.
     */
    output[category][normalizedGrade].push(
      JSON.parse(JSON.stringify(question))
    );
  });
}

function randomWrongAnswers(
  allValues,
  correctValues,
  amount = 3
) {
  const acceptedCorrect = new Set(
    asArray(correctValues).map(normalize)
  );

  const possible = unique(asArray(allValues)).filter(value => {
    return !acceptedCorrect.has(normalize(value));
  });

  shuffle(possible);

  return possible.slice(0, amount);
}

function buildSingleChoiceAnswers(
  correctAnswer,
  preferredWrongAnswers,
  fallbackPool,
  amount = 3
) {
  const correctNormalized = normalize(correctAnswer);

  const preferred = unique(
    asArray(preferredWrongAnswers)
  ).filter(answer => {
    return normalize(answer) !== correctNormalized;
  });

  const fallback = unique(
    asArray(fallbackPool)
  ).filter(answer => {
    return normalize(answer) !== correctNormalized;
  });

  /*
   * Bevorzugte Ablenker zuerst verwenden.
   * Danach wird der allgemeine Pool ergänzt.
   */
  const wrongAnswers = unique([
    ...preferred,
    ...fallback
  ]);

  shuffle(wrongAnswers);

  const selectedWrongAnswers = wrongAnswers.slice(0, amount);

  const answers = shuffle([
    correctAnswer,
    ...selectedWrongAnswers
  ]);

  return {
    answers,
    correct: answers.indexOf(correctAnswer)
  };
}

function warnIfTooFewAnswers(choice, questionText) {
  if (choice.answers.length < 2) {
    console.warn(
      `Zu wenige Antwortmöglichkeiten für: ${questionText}`
    );
  }
}

function createMultipleChoiceQuestion(
  question,
  correctAnswers,
  wrongAnswers
) {
  const normalizedCorrect = new Set(
    asArray(correctAnswers).map(normalize)
  );

  const answers = shuffle(
    unique([
      ...asArray(correctAnswers),
      ...asArray(wrongAnswers)
    ])
  );

  const correct = answers
    .map((answer, index) => {
      return normalizedCorrect.has(normalize(answer))
        ? index
        : null;
    })
    .filter(index => index !== null);

  return {
    type: "mc",
    question,
    answers,
    correct
  };
}

/* =========================================================
   KOMMANDOS
   ========================================================= */

const commands = knowledge.commands || [];

const allGermanCommands = commands.flatMap(entry =>
  asArray(entry.german)
);

const allKoreanCommands = commands.flatMap(entry =>
  asArray(entry.korean)
);

commands.forEach(entry => {
  const koreanMain = first(entry.korean);
  const germanMain = first(entry.german);

  if (!koreanMain || !germanMain) {
    console.warn(
      `Unvollständiger Kommando-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  const germanChoice = buildSingleChoiceAnswers(
    germanMain,
    entry.wrongGerman,
    allGermanCommands,
    3
  );

  warnIfTooFewAnswers(
    germanChoice,
    `Was bedeutet ${koreanMain}?`
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Was bedeutet ${koreanMain}?`,
    answers: germanChoice.answers,
    correct: germanChoice.correct
  });

  const koreanChoice = buildSingleChoiceAnswers(
    koreanMain,
    entry.wrongKorean,
    allKoreanCommands,
    3
  );

  warnIfTooFewAnswers(
    koreanChoice,
    `Welches Kommando bedeutet „${germanMain}“?`
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Welches Kommando bedeutet „${germanMain}“?`,
    answers: koreanChoice.answers,
    correct: koreanChoice.correct
  });

  addQuestion(entry.category, entry.grades, {
    type: "gap",
    question: `${koreanMain} bedeutet ___.`,
    correct: asArray(entry.german)
  });

  if (entry.contextQuestion && entry.contextCorrect) {
    const contextChoice = buildSingleChoiceAnswers(
      first(entry.contextCorrect),
      entry.contextWrong,
      [],
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: entry.contextQuestion,
      answers: contextChoice.answers,
      correct: contextChoice.correct
    });
  }
});

/* =========================================================
   TECHNIKEN
   ========================================================= */

const techniques = knowledge.techniques || [];

const allGermanTechniques = techniques.flatMap(entry =>
  asArray(entry.german)
);

const allKoreanTechniques = techniques.flatMap(entry =>
  asArray(entry.korean)
);

const allTechniqueTools = techniques.flatMap(entry =>
  asArray(entry.tool)
);

techniques.forEach(entry => {
  const koreanMain = first(entry.korean);
  const germanMain = first(entry.german);

  if (!koreanMain || !germanMain) {
    console.warn(
      `Unvollständiger Technik-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  const germanChoice = buildSingleChoiceAnswers(
    germanMain,
    entry.wrongGerman,
    allGermanTechniques,
    3
  );

  warnIfTooFewAnswers(
    germanChoice,
    `Was bedeutet ${koreanMain}?`
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Was bedeutet ${koreanMain}?`,
    answers: germanChoice.answers,
    correct: germanChoice.correct
  });

  const koreanChoice = buildSingleChoiceAnswers(
    koreanMain,
    entry.wrongKorean,
    allKoreanTechniques,
    3
  );

  warnIfTooFewAnswers(
    koreanChoice,
    `Wie heißt „${germanMain}“ auf Koreanisch?`
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Wie heißt „${germanMain}“ auf Koreanisch?`,
    answers: koreanChoice.answers,
    correct: koreanChoice.correct
  });

  addQuestion(entry.category, entry.grades, {
    type: "gap",
    question: `${koreanMain} bedeutet ___.`,
    correct: asArray(entry.german)
  });

  if (entry.tool) {
    const toolMain = first(entry.tool);

    const toolChoice = buildSingleChoiceAnswers(
      toolMain,
      entry.wrongTools,
      allTechniqueTools,
      3
    );

    warnIfTooFewAnswers(
      toolChoice,
      `Welche Trefferfläche wird bei ${koreanMain} verwendet?`
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: `Welche Trefferfläche wird bei ${koreanMain} verwendet?`,
      answers: toolChoice.answers,
      correct: toolChoice.correct
    });

    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Die Trefferfläche bei ${koreanMain} ist ___.`,
      correct: asArray(entry.tool)
    });
  }

  if (entry.direction) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `${koreanMain} wird in Richtung ___ ausgeführt.`,
      correct: asArray(entry.direction)
    });
  }

  if (entry.height) {
    addQuestion(entry.category, entry.grades, {
      type: "mc",
      question: `In welchen Höhen kann ${koreanMain} ausgeführt werden?`,
      answers: shuffle(
        unique([
          ...asArray(entry.height),
          ...asArray(entry.wrongHeights)
        ])
      ),
      correct: []
    });

    const generatedQuestion =
      output[entry.category]?.[
        String(asArray(entry.grades)[0]).toLowerCase()
      ]?.at(-1);

    /*
     * Die korrekten Indizes nach dem Mischen bestimmen.
     */
    if (generatedQuestion?.type === "mc") {
      const normalizedCorrect = new Set(
        asArray(entry.height).map(normalize)
      );

      generatedQuestion.correct = generatedQuestion.answers
        .map((answer, index) =>
          normalizedCorrect.has(normalize(answer))
            ? index
            : null
        )
        .filter(index => index !== null);
    }
  }
});

/* =========================================================
   PRINZIPIEN
   ========================================================= */

const principles = knowledge.principles || [];

const allPrincipleNames = principles.flatMap(entry =>
  asArray(entry.name)
);

principles.forEach(entry => {
  const nameMain = first(entry.name);
  const descriptionMain = first(entry.description);

  if (!nameMain) {
    console.warn(
      `Unvollständiger Prinzip-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  if (descriptionMain) {
    const principleChoice = buildSingleChoiceAnswers(
      nameMain,
      entry.wrongNames,
      allPrincipleNames,
      3
    );

    warnIfTooFewAnswers(
      principleChoice,
      `Welches Prinzip beschreibt „${descriptionMain}“?`
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: `Welches Prinzip beschreibt „${descriptionMain}“?`,
      answers: principleChoice.answers,
      correct: principleChoice.correct
    });
  }

  if (
    asArray(entry.examples).length > 0 &&
    asArray(entry.wrongExamples).length > 0
  ) {
    addQuestion(
      entry.category,
      entry.grades,
      createMultipleChoiceQuestion(
        `Welche Beispiele gehören zum Prinzip „${nameMain}“?`,
        entry.examples,
        entry.wrongExamples
      )
    );
  }
});

/*
 * Zusätzliche Listenfrage mit allen Prinzipien.
 *
 * Dafür kann in knowledge.jsonc stehen:
 *
 * "principlesList": {
 *   "category": "theorie",
 *   "grades": ["k9", "k8"],
 *   "question": "Nenne die Prinzipien des Taekwon-Do.",
 *   "answers": [
 *     ["Höflichkeit", "Hoeflichkeit"],
 *     ["Integrität", "Integritaet"],
 *     ["Ausdauer"],
 *     ["Selbstkontrolle"],
 *     ["Unbezwinglicher Wille"]
 *   ]
 * }
 */
if (knowledge.principlesList) {
  const entry = knowledge.principlesList;

  addQuestion(entry.category, entry.grades, {
    type: "list",
    question:
      entry.question ||
      "Nenne die Prinzipien des Taekwon-Do.",
    correct: asArray(entry.answers)
  });
}

/* =========================================================
   STELLUNGEN
   ========================================================= */

const stances = knowledge.stances || [];

const allGermanStances = stances.flatMap(entry =>
  asArray(entry.german)
);

const allKoreanStances = stances.flatMap(entry =>
  asArray(entry.korean)
);

stances.forEach(entry => {
  const koreanMain = first(entry.korean);
  const germanMain = first(entry.german);

  if (!koreanMain || !germanMain) {
    console.warn(
      `Unvollständiger Stellungs-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  const germanChoice = buildSingleChoiceAnswers(
    germanMain,
    entry.wrongGerman,
    allGermanStances,
    3
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Was bedeutet ${koreanMain}?`,
    answers: germanChoice.answers,
    correct: germanChoice.correct
  });

  const koreanChoice = buildSingleChoiceAnswers(
    koreanMain,
    entry.wrongKorean,
    allKoreanStances,
    3
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Wie heißt die „${germanMain}“ auf Koreanisch?`,
    answers: koreanChoice.answers,
    correct: koreanChoice.correct
  });

  addQuestion(entry.category, entry.grades, {
    type: "gap",
    question: `${koreanMain} bedeutet ___.`,
    correct: asArray(entry.german)
  });

  if (entry.length) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Die Länge von ${koreanMain} beträgt ___.`,
      correct: asArray(entry.length)
    });
  }

  if (entry.width) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Die Breite von ${koreanMain} beträgt ___.`,
      correct: asArray(entry.width)
    });
  }

  if (entry.weightDistribution) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Die Gewichtsverteilung bei ${koreanMain} ist ___.`,
      correct: asArray(entry.weightDistribution)
    });
  }
});

/* =========================================================
   EINFACHE BEGRIFFSPAARE
   ========================================================= */

function processTermSection(sectionName) {
  const entries = knowledge[sectionName] || [];

  const allGerman = entries.flatMap(entry =>
    asArray(entry.german)
  );

  const allKorean = entries.flatMap(entry =>
    asArray(entry.korean)
  );

  entries.forEach(entry => {
    const koreanMain = first(entry.korean);
    const germanMain = first(entry.german);

    if (!koreanMain || !germanMain) {
      console.warn(
        `Unvollständiger Eintrag in "${sectionName}": ` +
        `${entry.id || "ohne ID"}`
      );
      return;
    }

    const germanChoice = buildSingleChoiceAnswers(
      germanMain,
      entry.wrongGerman,
      allGerman,
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: `Was bedeutet ${koreanMain}?`,
      answers: germanChoice.answers,
      correct: germanChoice.correct
    });

    const koreanChoice = buildSingleChoiceAnswers(
      koreanMain,
      entry.wrongKorean,
      allKorean,
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question:
        `Welcher koreanische Begriff bedeutet „${germanMain}“?`,
      answers: koreanChoice.answers,
      correct: koreanChoice.correct
    });

    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `${koreanMain} bedeutet ___.`,
      correct: asArray(entry.german)
    });
  });
}

processTermSection("bodyParts");
processTermSection("directions");
processTermSection("heights");
processTermSection("targets");

/* =========================================================
   TUL / FORMEN
   ========================================================= */

const patterns = knowledge.patterns || [];

const allPatternNames = patterns.flatMap(entry =>
  asArray(entry.name)
);

const allPatternMeanings = patterns.flatMap(entry =>
  asArray(entry.meaning)
);

patterns.forEach(entry => {
  const nameMain = first(entry.name);
  const meaningMain = first(entry.meaning);

  if (!nameMain) {
    console.warn(
      `Unvollständiger Tul-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  if (meaningMain) {
    const meaningChoice = buildSingleChoiceAnswers(
      meaningMain,
      entry.wrongMeanings,
      allPatternMeanings,
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: `Was bedeutet die Tul ${nameMain}?`,
      answers: meaningChoice.answers,
      correct: meaningChoice.correct
    });

    const nameChoice = buildSingleChoiceAnswers(
      nameMain,
      entry.wrongNames,
      allPatternNames,
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: `Welche Tul bedeutet „${meaningMain}“?`,
      answers: nameChoice.answers,
      correct: nameChoice.correct
    });

    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `${nameMain} bedeutet ___.`,
      correct: asArray(entry.meaning)
    });
  }

  if (entry.movements !== undefined) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Wie viele Bewegungen hat ${nameMain}?`,
      correct: asArray(entry.movements).map(String)
    });
  }

  if (entry.diagram) {
    addQuestion(entry.category, entry.grades, {
      type: "gap",
      question: `Welches Diagramm hat ${nameMain}?`,
      correct: asArray(entry.diagram)
    });
  }
});

/* =========================================================
   GÜRTELBEDEUTUNGEN
   ========================================================= */

const beltMeanings = knowledge.beltMeanings || [];

const allBeltMeanings = beltMeanings.flatMap(entry =>
  asArray(entry.meaning)
);

beltMeanings.forEach(entry => {
  const beltMain = first(entry.belt);
  const meaningMain = first(entry.meaning);

  if (!beltMain || !meaningMain) {
    console.warn(
      `Unvollständiger Gürtel-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  const meaningChoice = buildSingleChoiceAnswers(
    meaningMain,
    entry.wrongMeanings,
    allBeltMeanings,
    3
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Wofür steht die Gürtelfarbe ${beltMain}?`,
    answers: meaningChoice.answers,
    correct: meaningChoice.correct
  });

  addQuestion(entry.category, entry.grades, {
    type: "gap",
    question: `Die Gürtelfarbe ${beltMain} steht für ___.`,
    correct: asArray(entry.meaning)
  });
});

/* =========================================================
   REGELN
   ========================================================= */

const rules = knowledge.rules || [];

rules.forEach(entry => {
  const correctAnswers = asArray(entry.correct);
  const wrongAnswers = asArray(entry.wrong);

  if (!entry.question || correctAnswers.length === 0) {
    console.warn(
      `Unvollständiger Regel-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  if (entry.multiple || correctAnswers.length > 1) {
    addQuestion(
      entry.category,
      entry.grades,
      createMultipleChoiceQuestion(
        entry.question,
        correctAnswers,
        wrongAnswers
      )
    );
  } else {
    const choice = buildSingleChoiceAnswers(
      correctAnswers[0],
      wrongAnswers,
      [],
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: entry.question,
      answers: choice.answers,
      correct: choice.correct
    });
  }
});

/* =========================================================
   PRÜFUNGSSITUATIONEN
   ========================================================= */

const examSituations = knowledge.examSituations || [];

examSituations.forEach(entry => {
  const correctAnswers = asArray(entry.correct);
  const wrongAnswers = asArray(entry.wrong);

  if (!entry.situation || correctAnswers.length === 0) {
    console.warn(
      `Unvollständige Prüfungssituation: ${entry.id || "ohne ID"}`
    );
    return;
  }

  if (entry.multiple || correctAnswers.length > 1) {
    addQuestion(
      entry.category,
      entry.grades,
      createMultipleChoiceQuestion(
        entry.situation,
        correctAnswers,
        wrongAnswers
      )
    );
  } else {
    const choice = buildSingleChoiceAnswers(
      correctAnswers[0],
      wrongAnswers,
      [],
      3
    );

    addQuestion(entry.category, entry.grades, {
      type: "sc",
      question: entry.situation,
      answers: choice.answers,
      correct: choice.correct
    });
  }
});

/* =========================================================
   KOREANISCHE ZAHLEN
   ========================================================= */

const koreanNumbers = knowledge.koreanNumbers || [];

const allKoreanNumberNames = koreanNumbers.flatMap(entry =>
  asArray(entry.korean)
);

const allNumberValues = koreanNumbers.flatMap(entry =>
  asArray(entry.number).map(String)
);

koreanNumbers.forEach(entry => {
  const koreanMain = first(entry.korean);
  const numberMain = String(first(entry.number));

  if (!koreanMain || !numberMain) {
    console.warn(
      `Unvollständiger Zahlen-Eintrag: ${entry.id || "ohne ID"}`
    );
    return;
  }

  const numberChoice = buildSingleChoiceAnswers(
    numberMain,
    entry.wrongNumbers,
    allNumberValues,
    3
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Welche Zahl bedeutet ${koreanMain}?`,
    answers: numberChoice.answers,
    correct: numberChoice.correct
  });

  const koreanChoice = buildSingleChoiceAnswers(
    koreanMain,
    entry.wrongKorean,
    allKoreanNumberNames,
    3
  );

  addQuestion(entry.category, entry.grades, {
    type: "sc",
    question: `Wie heißt die Zahl ${numberMain} auf Koreanisch?`,
    answers: koreanChoice.answers,
    correct: koreanChoice.correct
  });

  addQuestion(entry.category, entry.grades, {
    type: "gap",
    question: `${koreanMain} ist die Zahl ___.`,
    correct: asArray(entry.number).map(String)
  });
});

/* =========================================================
   MANUELLE FRAGEN
   ========================================================= */

/*
 * Für Fragen, die sich nicht sinnvoll automatisch erzeugen lassen,
 * kann man in knowledge.jsonc zusätzlich "manualQuestions" pflegen:
 *
 * "manualQuestions": [
 *   {
 *     "category": "grundlagen",
 *     "grades": ["k10"],
 *     "type": "sc",
 *     "question": "Wie heißt unsere Trainingskleidung?",
 *     "answers": ["Dobok", "Gi", "Hakama"],
 *     "correct": 0
 *   }
 * ]
 */
const manualQuestions = knowledge.manualQuestions || [];

manualQuestions.forEach(entry => {
  const {
    category,
    grades,
    ...question
  } = entry;

  if (!question.type || !question.question) {
    console.warn(
      `Ungültige manuelle Frage: ${entry.id || "ohne ID"}`
    );
    return;
  }

  addQuestion(category, grades, question);
});

/* =========================================================
   AUSGABE PRÜFEN UND SPEICHERN
   ========================================================= */

let totalQuestions = 0;

for (const [category, grades] of Object.entries(output)) {
  for (const [grade, questionList] of Object.entries(grades)) {
    const count = questionList.length;
    totalQuestions += count;

    if (count > 0) {
      console.log(
        `${category} / ${grade}: ${count} Fragen`
      );
    }
  }
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(output, null, 2),
  "utf8"
);

console.log("");
console.log(
  `questions.json wurde erfolgreich mit ${totalQuestions} Fragen erzeugt.`
);