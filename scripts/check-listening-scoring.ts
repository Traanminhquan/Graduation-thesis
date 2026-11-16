/**
 * Unit checks for the Listening grading rules and speech helpers.
 * No database, no network.
 *
 *   npx tsx scripts/check-listening-scoring.ts
 */
import {
  isAnswerCorrect,
  isListeningAnswerCorrect,
  isMatchingAnswerComplete,
  matchingEntries,
  normalizeAnswer,
  type GradableListeningQuestion,
} from "../src/lib/listening/scoring";
import {
  DEFAULT_SPEECH_RATE,
  SPEECH_RATES,
  estimateSpeechLabel,
  estimateSpeechSeconds,
  isSpeechSynthesisSupported,
  speechRateLabel,
} from "../src/lib/listening/speech";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${
      ok
        ? ""
        : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`
    }`,
  );
}

const mcq: GradableListeningQuestion = {
  type: "MULTIPLE_CHOICE",
  correctAnswer: "On Saturdays and Sundays",
  correctOptionIndex: 0,
  acceptedAnswers: [],
  options: [
    "On Saturdays and Sundays",
    "On Sunday mornings only",
    "Every weekday afternoon",
  ],
  matchingPairs: [],
};

const trueFalse: GradableListeningQuestion = {
  type: "TRUE_FALSE",
  correctAnswer: "true",
  correctOptionIndex: null,
  acceptedAnswers: [],
  options: [],
  matchingPairs: [],
};

const fillBlank: GradableListeningQuestion = {
  type: "FILL_BLANK",
  correctAnswer: "noon",
  correctOptionIndex: null,
  acceptedAnswers: ["noon", "12", "twelve", "midday"],
  options: [],
  matchingPairs: [],
};

const matchingPairs = [
  { left: "Press one", right: "Change an appointment" },
  { left: "Press two", right: "Talk about a dental emergency" },
  { left: "Arrive fifteen minutes early", right: "Fill in the new-patient forms" },
];

const matching: GradableListeningQuestion = {
  type: "MATCHING",
  correctAnswer: JSON.stringify({
    "Press one": "Change an appointment",
    "Press two": "Talk about a dental emergency",
    "Arrive fifteen minutes early": "Fill in the new-patient forms",
  }),
  correctOptionIndex: null,
  acceptedAnswers: [],
  options: [],
  matchingPairs,
};

console.log("-- multiple choice --");
check(
  "chosen correct option text",
  isAnswerCorrect(mcq, "On Saturdays and Sundays"),
  true,
);
check("chosen wrong option text", isAnswerCorrect(mcq, "On Sunday mornings only"), false);
check("matches option at correctOptionIndex", isAnswerCorrect(mcq, mcq.options[0]), true);
check("case-insensitive option", isAnswerCorrect(mcq, "on saturdays AND sundays"), true);

console.log("-- true / false --");
check("stored lowercase true", isAnswerCorrect(trueFalse, "true"), true);
check("capitalised True", isAnswerCorrect(trueFalse, "True"), true);
check("padded uppercase TRUE", isAnswerCorrect(trueFalse, " TRUE "), true);
check("opposite answer", isAnswerCorrect(trueFalse, "false"), false);
check("empty answer", isAnswerCorrect(trueFalse, ""), false);

console.log("-- fill in the blank --");
check("exact word", isAnswerCorrect(fillBlank, "noon"), true);
check("accepted numeric variant", isAnswerCorrect(fillBlank, "12"), true);
check("accepted synonym with capital", isAnswerCorrect(fillBlank, "Twelve"), true);
check("padded + trailing period", isAnswerCorrect(fillBlank, "  noon. "), true);
check("wrong word", isAnswerCorrect(fillBlank, "sunset"), false);
check("null response", isAnswerCorrect(fillBlank, null), false);

console.log("-- matching --");
const allCorrect = JSON.stringify({
  "Press one": "Change an appointment",
  "Press two": "Talk about a dental emergency",
  "Arrive fifteen minutes early": "Fill in the new-patient forms",
});
check("all pairs correct", isMatchingCorrectForTest(matching, allCorrect), true);
check(
  "order of keys does not matter",
  isMatchingCorrectForTest(
    matching,
    JSON.stringify({
      "Arrive fifteen minutes early": "Fill in the new-patient forms",
      "Press two": "Talk about a dental emergency",
      "Press one": "Change an appointment",
    }),
  ),
  true,
);
check(
  "case and spacing tolerated",
  isMatchingCorrectForTest(
    matching,
    JSON.stringify({
      "press ONE": " change an appointment ",
      "press two": "talk about a dental EMERGENCY",
      "ARRIVE FIFTEEN MINUTES EARLY": "fill in the new-patient forms",
    }),
  ),
  true,
);
check(
  "one wrong pair fails the question",
  isMatchingCorrectForTest(
    matching,
    JSON.stringify({
      "Press one": "Change an appointment",
      "Press two": "Fill in the new-patient forms",
      "Arrive fifteen minutes early": "Talk about a dental emergency",
    }),
  ),
  false,
);
check(
  "partial mapping is not correct",
  isMatchingCorrectForTest(
    matching,
    JSON.stringify({ "Press one": "Change an appointment" }),
  ),
  false,
);
check(
  "extra answer fails the question",
  isMatchingCorrectForTest(
    matching,
    JSON.stringify({
      ...JSON.parse(allCorrect),
      "Press three": "Change an appointment",
    }),
  ),
  false,
);
check("null response", isMatchingCorrectForTest(matching, null), false);
check("unparseable response", isMatchingCorrectForTest(matching, "not json"), false);
check(
  "partial mapping is not complete",
  isMatchingAnswerComplete(
    matching,
    JSON.stringify({ "Press one": "Change an appointment" }),
  ),
  false,
);
check("full mapping is complete", isMatchingAnswerComplete(matching, allCorrect), true);
check(
  "matching entries are readable in stored order",
  matchingEntries(allCorrect).map((entry) => entry.left),
  ["Press one", "Press two", "Arrive fifteen minutes early"],
);

const matchingFallback: GradableListeningQuestion = {
  ...matching,
  correctAnswer: "{broken",
};
check(
  "falls back to matchingPairs when correctAnswer is malformed",
  isMatchingCorrectForTest(matchingFallback, allCorrect),
  true,
);

check(
  "single entry point routes MATCHING to the mapping rule",
  isListeningAnswerCorrect(matching, allCorrect),
  true,
);

console.log("-- normalisation --");
check("collapses whitespace", normalizeAnswer("  flat   roads "), "flat roads");
check("curly apostrophes", normalizeAnswer("we'll\u2019s trip"), "we'll's trip");
check("strips trailing punctuation", normalizeAnswer("noon?!"), "noon");
check("keeps inner punctuation", normalizeAnswer("Press one, then two"), "press one, then two");

console.log("-- speech helpers --");
check("rate options", [...SPEECH_RATES], [0.75, 1, 1.25, 1.5]);
check("default rate", DEFAULT_SPEECH_RATE, 1);
check("rate label", speechRateLabel(1.25), "1.25×");
check(
  "detects a speech synthesis-like object",
  isSpeechSynthesisSupported({ speak() {}, cancel() {} }),
  true,
);
check("rejects null synthesis", isSpeechSynthesisSupported(null), false);
check("rejects an object without speak", isSpeechSynthesisSupported({ cancel() {} }), false);
check(
  "estimates a 150-word transcript at one minute",
  estimateSpeechSeconds(Array(150).fill("word").join(" ")),
  60,
);
check(
  "faster rate estimates a shorter duration",
  estimateSpeechSeconds(Array(150).fill("word").join(" "), 2),
  30,
);
check(
  "label for a short transcript",
  estimateSpeechLabel(Array(40).fill("word").join(" "), 1),
  "about 16 sec",
);

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);

/** Local alias so the matching checks read clearly above. */
function isMatchingCorrectForTest(
  question: GradableListeningQuestion,
  response: string | null,
): boolean {
  return isListeningAnswerCorrect(question, response);
}
