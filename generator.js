const fs = require("fs");
const path = require("path");

/*
 * Pfade
 *
 * knowledge.jsonc = von dir gepflegte Wissensdatei
 * questions.json = automatisch erzeugter Fragenkatalog
 */
const knowledgePath = path.join(__dirname, "knowledge.jsonc");
const outputPath = path.join(__dirname, "questions.json");

/*
 * JSONC-Datei einlesen.
 * Unterstützt:
 * // Zeilenkommentare
 * /* Blockkommentare *\/
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
   DEUTSCHE FELDNAMEN UNTERSTÜTZEN
   ========================================================= */

function mapEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return entry;
  }

  return {
    ...entry,

    category:
      entry.category ??
      entry.kategorie,

    grades:
      entry.grades ??
      entry.graduierungen,

    korean:
      entry.korean ??
      entry.koreanisch,

    german:
      entry.german ??
      entry.deutsch,

    wrongGerman:
      entry.wrongGerman ??
      entry.falschesDeutsch,

    wrongKorean:
      entry.wrongKorean ??
      entry.falschesKoreanisch,

    tool:
      entry.tool ??
      entry.trefferfläche,

    wrongTools:
      entry.wrongTools ??
      entry.falscheTrefferflächen,

    direction:
      entry.direction ??
      entry.richtung,

    height:
      entry.height ??
      entry.höhe,

    wrongHeights:
      entry.wrongHeights ??
      entry.falscheHöhen,

    description:
      entry.description ??
      entry.beschreibung,

    examples:
      entry.examples ??
      entry.beispiele,

    wrongExamples:
      entry.wrongExamples ??
      entry.falscheBeispiele,

    question:
      entry.question ??
      entry.frage,

    correct:
      entry.correct ??
      entry.richtig,

    wrong:
      entry.wrong ??
      entry.falsch,

    meaning:
      entry.meaning ??
      entry.bedeutung,

    movements:
      entry.movements ??
      entry.bewegungen,

    diagram:
      entry.diagram ??
      entry.diagramm,

    belt:
      entry.belt ??
      entry.gürtel,

    number:
      entry.number ??
      entry.zahl,

    length:
      entry.length ??
      entry.länge,

    wrongLength:
      entry.wrongLength ??
      entry.falscheLänge,

    width:
        entry.width ??
        entry.breite,

    wrongWidth:
        entry.wrongWidth ??
        entry.falscheBreite,

    weightDistribution:
        entry.weightDistribution ??
        entry.gewichtsverteilung,

    wrongWeightDistribution:
        entry.wrongWeightDistribution ??
        entry.falscheGewichtsverteilung,

    leftFootAngle:
        entry.leftFootAngle ??
        entry.winkelLinkerFuß,

    rightFootAngle:
        entry.rightFootAngle ??
        entry.winkelRechterFuß,

    frontFootAngle:
        entry.frontFootAngle ??
        entry.winkelVordererFuß,

    rearFootAngle:
        entry.rearFootAngle ??
        entry.winkelHintererFuß,

    wrongMeanings:
        entry.wrongMeanings ??
        entry.falscheBedeutungen,

    wrongNames:
        entry.wrongNames ??
        entry.falscheNamen,

    wrongNumbers:
        entry.wrongNumbers ??
        entry.falscheZahlen,

    multiple:
        entry.multiple ??
        entry.mehrfach,

    MPBL: entry.MPBL,
    MPBR: entry.MPBR,
    MPBV: entry.MPBV,
    MPBH: entry.MPBH,
    MPLV: entry.MPLV,
    MPLH: entry.MPLH
  };
}

function getSection(...names) {
  for (const name of names) {
    if (knowledge[name]) {
      return knowledge[name].map(mapEntry);
    }
  }

  return [];
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

    output[category][normalizedGrade].push(
      JSON.parse(JSON.stringify(question))
    );
  });
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

  const wrongAnswers = unique([
    ...preferred,
    ...fallback
  ]);

  shuffle(wrongAnswers);

  const selectedWrongAnswers =
    wrongAnswers.slice(0, amount);

  const answers = shuffle([
    correctAnswer,
    ...selectedWrongAnswers
  ]);

  return {
    answers,
    correct: answers.indexOf(correctAnswer)
  };
}

function createGapQuestion(
  category,
  grades,
  question,
  answers
) {
  addQuestion(category, grades, {
    type: "gap",
    question,
    correct: asArray(answers)
  });
}

function createSingleChoiceQuestion(
  category,
  grades,
  question,
  correct,
  wrong,
  fallback = []
) {
  const choice =
    buildSingleChoiceAnswers(
      first(correct),
      wrong,
      fallback,
      3
    );

  addQuestion(category, grades, {
    type: "sc",
    question,
    answers: choice.answers,
    correct: choice.correct
  });
}

function createMultipleChoiceQuestion(
  question,
  correctAnswers,
  wrongAnswers
) {
  const normalizedCorrect =
    new Set(
      asArray(correctAnswers)
        .map(normalize)
    );

  const answers =
    shuffle(
      unique([
        ...asArray(correctAnswers),
        ...asArray(wrongAnswers)
      ])
    );

  const correct =
    answers
      .map((answer, index) => {
        return normalizedCorrect.has(
          normalize(answer)
        )
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
   SEKTIONEN LADEN
   ========================================================= */

const commands =
  getSection(
    "commands",
    "kommandos"
  );

const techniques =
  getSection(
    "techniques",
    "techniken"
  );

const stances =
  getSection(
    "stances",
    "stellungen"
  );

const bodyParts =
  getSection(
    "bodyParts",
    "körperteile"
  );

const directions =
  getSection(
    "directions",
    "richtungen"
  );

const heights =
  getSection(
    "heights",
    "höhen"
  );

const principles =
  getSection(
    "principles",
    "prinzipien"
  );

const rules =
  getSection(
    "rules",
    "regeln"
  );

const patterns =
  getSection(
    "patterns",
    "formen"
  );

const beltMeanings =
  getSection(
    "beltMeanings",
    "gürtelbedeutungen"
  );

const examSituations =
  getSection(
    "examSituations",
    "prüfungssituationen"
  );

const koreanNumbers =
  getSection(
    "koreanNumbers",
    "koreanischeZahlen"
  );

const manualQuestions =
  getSection(
    "manualQuestions",
    "manuelleFragen"
  );
  /* =========================================================
   KOMMANDOS
   ========================================================= */

const allGermanCommands =
  commands.flatMap(entry =>
    asArray(entry.german)
  );

const allKoreanCommands =
  commands.flatMap(entry =>
    asArray(entry.korean)
  );

commands.forEach(entry => {
  const koreanMain =
    first(entry.korean);

  const germanMain =
    first(entry.german);

  if (!koreanMain || !germanMain) {
    return;
  }

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Was bedeutet ${koreanMain}?`,
    germanMain,
    entry.wrongGerman,
    allGermanCommands
  );

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Welches Kommando bedeutet "${germanMain}"?`,
    koreanMain,
    entry.wrongKorean,
    allKoreanCommands
  );

  createGapQuestion(
    entry.category,
    entry.grades,
    `${koreanMain} bedeutet ___.`,
    entry.german
  );
});

/* =========================================================
   TECHNIKEN
   ========================================================= */

const allGermanTechniques =
  techniques.flatMap(entry =>
    asArray(entry.german)
  );

const allKoreanTechniques =
  techniques.flatMap(entry =>
    asArray(entry.korean)
  );

const allTechniqueTools =
  techniques.flatMap(entry =>
    asArray(entry.tool)
  );

techniques.forEach(entry => {
  const koreanMain =
    first(entry.korean);

  const germanMain =
    first(entry.german);

  if (!koreanMain || !germanMain) {
    return;
  }

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Was bedeutet ${koreanMain}?`,
    germanMain,
    entry.wrongGerman,
    allGermanTechniques
  );

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Wie heißt "${germanMain}" auf Koreanisch?`,
    koreanMain,
    entry.wrongKorean,
    allKoreanTechniques
  );

  createGapQuestion(
    entry.category,
    entry.grades,
    `${koreanMain} bedeutet ___.`,
    entry.german
  );

  if (entry.tool) {
    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Welche Trefferfläche wird bei ${koreanMain} verwendet?`,
      first(entry.tool),
      entry.wrongTools,
      allTechniqueTools
    );

    createGapQuestion(
      entry.category,
      entry.grades,
      `Die Trefferfläche bei ${koreanMain} ist ___.`,
      entry.tool
    );
  }

  if (entry.direction) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `${koreanMain} wird in Richtung ___ ausgeführt.`,
      entry.direction
    );
  }

  if (entry.height) {
    addQuestion(
      entry.category,
      entry.grades,
      createMultipleChoiceQuestion(
        `In welchen Höhen kann ${koreanMain} ausgeführt werden?`,
        entry.height,
        entry.wrongHeights
      )
    );
  }
});

/* =========================================================
   STELLUNGEN
   ========================================================= */

const allGermanStances =
  stances.flatMap(entry =>
    asArray(entry.german)
  );

const allKoreanStances =
  stances.flatMap(entry =>
    asArray(entry.korean)
  );

stances.forEach(entry => {
  const koreanMain =
    first(entry.korean);

  const germanMain =
    first(entry.german);

  if (!koreanMain || !germanMain) {
    return;
  }

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Was bedeutet ${koreanMain}?`,
    germanMain,
    entry.wrongGerman,
    allGermanStances
  );

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Wie heißt "${germanMain}" auf Koreanisch?`,
    koreanMain,
    entry.wrongKorean,
    allKoreanStances
  );

  createGapQuestion(
    entry.category,
    entry.grades,
    `${koreanMain} bedeutet ___.`,
    entry.german
  );

  /* Länge */

  if (entry.length) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Die Länge von ${koreanMain} beträgt ___.`,
      entry.length
    );

    if (entry.wrongLength) {
      createSingleChoiceQuestion(
        entry.category,
        entry.grades,
        `Wie lang ist ${koreanMain}?`,
        first(entry.length),
        entry.wrongLength
      );
    }
  }

  /* Breite */

  if (
    entry.width &&
    entry.width.length > 0
  ) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Die Breite von ${koreanMain} beträgt ___.`,
      entry.width
    );

    if (entry.wrongWidth) {
      createSingleChoiceQuestion(
        entry.category,
        entry.grades,
        `Wie breit ist ${koreanMain}?`,
        first(entry.width),
        entry.wrongWidth
      );
    }
  }

  /* Gewichtsverteilung */

  if (entry.weightDistribution) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Die Gewichtsverteilung bei ${koreanMain} ist ___.`,
      entry.weightDistribution
    );

    if (
      entry.wrongWeightDistribution
    ) {
      createSingleChoiceQuestion(
        entry.category,
        entry.grades,
        `Wie ist die Gewichtsverteilung bei ${koreanMain}?`,
        first(
          entry.weightDistribution
        ),
        entry.wrongWeightDistribution
      );
    }
  }
    /* Winkel des linken Fußes */

  if (entry.leftFootAngle) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der linke Fuß steht bei ${koreanMain} ___.`,
      entry.leftFootAngle
    );
  }

  /* Winkel des rechten Fußes */

  if (entry.rightFootAngle) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der rechte Fuß steht bei ${koreanMain} ___.`,
      entry.rightFootAngle
    );
  }

  /* Winkel des vorderen Fußes */

  if (entry.frontFootAngle) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der vordere Fuß steht bei ${koreanMain} ___.`,
      entry.frontFootAngle
    );
  }

  /* Winkel des hinteren Fußes */

  if (entry.rearFootAngle) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der hintere Fuß steht bei ${koreanMain} ___.`,
      entry.rearFootAngle
    );
  }

  /* Messpunkt Breite linker Fuß */

  if (entry.MPBL) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Breite am linken Fuß bei ${koreanMain} ist ___.`,
      entry.MPBL
    );
  }

  /* Messpunkt Breite rechter Fuß */

  if (entry.MPBR) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Breite am rechten Fuß bei ${koreanMain} ist ___.`,
      entry.MPBR
    );
  }

  /* Messpunkt Breite vorderer Fuß */

  if (entry.MPBV) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Breite am vorderen Fuß bei ${koreanMain} ist ___.`,
      entry.MPBV
    );
  }

  /* Messpunkt Breite hinterer Fuß */

  if (entry.MPBH) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Breite am hinteren Fuß bei ${koreanMain} ist ___.`,
      entry.MPBH
    );
  }

  /* Messpunkt Länge vorderer Fuß */

  if (entry.MPLV) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Länge am vorderen Fuß bei ${koreanMain} ist ___.`,
      entry.MPLV
    );
  }

  /* Messpunkt Länge hinterer Fuß */

  if (entry.MPLH) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Der Messpunkt für die Länge am hinteren Fuß bei ${koreanMain} ist ___.`,
      entry.MPLH
    );
  }
});

/* =========================================================
   EINFACHE BEGRIFFSPAARE
   ========================================================= */

function processTermSection(entries) {
  const allGerman =
    entries.flatMap(entry =>
      asArray(entry.german)
    );

  const allKorean =
    entries.flatMap(entry =>
      asArray(entry.korean)
    );

  entries.forEach(entry => {
    const koreanMain =
      first(entry.korean);

    const germanMain =
      first(entry.german);

    if (!koreanMain || !germanMain) {
      return;
    }

    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Was bedeutet ${koreanMain}?`,
      germanMain,
      entry.wrongGerman,
      allGerman
    );

    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Welcher koreanische Begriff bedeutet "${germanMain}"?`,
      koreanMain,
      entry.wrongKorean,
      allKorean
    );

    createGapQuestion(
      entry.category,
      entry.grades,
      `${koreanMain} bedeutet ___.`,
      entry.german
    );
  });
}

processTermSection(bodyParts);
processTermSection(directions);
processTermSection(heights);

/* =========================================================
   PRINZIPIEN
   ========================================================= */

const allPrincipleNames =
  principles.flatMap(entry =>
    asArray(entry.name)
  );

principles.forEach(entry => {
  const nameMain =
    first(entry.name);

  const descriptionMain =
    first(entry.description);

  if (!nameMain) {
    return;
  }

  if (descriptionMain) {
    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Welches Prinzip beschreibt "${descriptionMain}"?`,
      nameMain,
      entry.wrongNames,
      allPrincipleNames
    );
  }

  if (
    asArray(entry.examples).length > 0
  ) {
    addQuestion(
      entry.category,
      entry.grades,
      createMultipleChoiceQuestion(
        `Welche Beispiele gehören zum Prinzip "${nameMain}"?`,
        entry.examples,
        entry.wrongExamples
      )
    );
  }
});

/* =========================================================
   REGELN
   ========================================================= */

rules.forEach(entry => {
  const correctAnswers =
    asArray(entry.correct);

  const wrongAnswers =
    asArray(entry.wrong);

  if (
    !entry.question ||
    correctAnswers.length === 0
  ) {
    return;
  }

  if (
    entry.multiple ||
    correctAnswers.length > 1
  ) {
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
    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      entry.question,
      correctAnswers[0],
      wrongAnswers
    );
  }
});
/* =========================================================
   FORMEN / TUL
   ========================================================= */

const allPatternNames =
  patterns.flatMap(entry =>
    asArray(entry.name)
  );

const allPatternMeanings =
  patterns.flatMap(entry =>
    asArray(entry.meaning)
  );

patterns.forEach(entry => {
  const nameMain =
    first(entry.name);

  const meaningMain =
    first(entry.meaning);

  if (!nameMain) {
    return;
  }

  if (meaningMain) {
    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Was bedeutet die Tul ${nameMain}?`,
      meaningMain,
      entry.wrongMeanings,
      allPatternMeanings
    );

    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      `Welche Tul bedeutet "${meaningMain}"?`,
      nameMain,
      entry.wrongNames,
      allPatternNames
    );

    createGapQuestion(
      entry.category,
      entry.grades,
      `${nameMain} bedeutet ___.`,
      entry.meaning
    );
  }

  if (entry.movements !== undefined) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Wie viele Bewegungen hat ${nameMain}?`,
      asArray(entry.movements).map(String)
    );
  }

  if (entry.diagram) {
    createGapQuestion(
      entry.category,
      entry.grades,
      `Welches Diagramm hat ${nameMain}?`,
      entry.diagram
    );
  }
});

/* =========================================================
   GÜRTELBEDEUTUNGEN
   ========================================================= */

const allBeltMeanings =
  beltMeanings.flatMap(entry =>
    asArray(entry.meaning)
  );

beltMeanings.forEach(entry => {
  const beltMain =
    first(entry.belt);

  const meaningMain =
    first(entry.meaning);

  if (!beltMain || !meaningMain) {
    return;
  }

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Wofür steht die Gürtelfarbe ${beltMain}?`,
    meaningMain,
    entry.wrongMeanings,
    allBeltMeanings
  );

  createGapQuestion(
    entry.category,
    entry.grades,
    `Die Gürtelfarbe ${beltMain} steht für ___.`,
    entry.meaning
  );
});

/* =========================================================
   PRÜFUNGSSITUATIONEN
   ========================================================= */

examSituations.forEach(entry => {
  const correctAnswers =
    asArray(entry.correct);

  const wrongAnswers =
    asArray(entry.wrong);

  if (
    !entry.situation ||
    correctAnswers.length === 0
  ) {
    return;
  }

  if (
    entry.multiple ||
    correctAnswers.length > 1
  ) {
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
    createSingleChoiceQuestion(
      entry.category,
      entry.grades,
      entry.situation,
      correctAnswers[0],
      wrongAnswers
    );
  }
});

/* =========================================================
   KOREANISCHE ZAHLEN
   ========================================================= */

const allKoreanNumberNames =
  koreanNumbers.flatMap(entry =>
    asArray(entry.korean)
  );

const allNumberValues =
  koreanNumbers.flatMap(entry =>
    asArray(entry.number).map(String)
  );

koreanNumbers.forEach(entry => {
  const koreanMain =
    first(entry.korean);

  const numberMain =
    String(first(entry.number));

  if (!koreanMain || !numberMain) {
    return;
  }

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Welche Zahl bedeutet ${koreanMain}?`,
    numberMain,
    entry.wrongNumbers,
    allNumberValues
  );

  createSingleChoiceQuestion(
    entry.category,
    entry.grades,
    `Wie heißt die Zahl ${numberMain} auf Koreanisch?`,
    koreanMain,
    entry.wrongKorean,
    allKoreanNumberNames
  );

  createGapQuestion(
    entry.category,
    entry.grades,
    `${koreanMain} ist die Zahl ___.`,
    asArray(entry.number).map(String)
  );
});

/* =========================================================
   MANUELLE FRAGEN
   ========================================================= */

manualQuestions.forEach(entry => {
  const {
    category,
    grades,
    ...question
  } = entry;

  if (
    !question.type ||
    !question.question
  ) {
    console.warn(
      `Ungültige manuelle Frage: ${entry.id || "ohne ID"}`
    );
    return;
  }

  addQuestion(
    category,
    grades,
    question
  );
});

/* =========================================================
   AUSGABE PRÜFEN UND SPEICHERN
   ========================================================= */

let totalQuestions = 0;

for (
  const [category, grades]
  of Object.entries(output)
) {
  for (
    const [grade, questionList]
    of Object.entries(grades)
  ) {
    const count =
      questionList.length;

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
  JSON.stringify(
    output,
    null,
    2
  ),
  "utf8"
);

console.log("");

console.log(
  `questions.json wurde erfolgreich mit ${totalQuestions} Fragen erzeugt.`
);