/**
 * Picks the FAQ answer that best fits a typed question. No AI behind this: it compares meaningful words
 * (ignoring small connecting words and word endings) and only answers when the overlap is convincing,
 * otherwise the caller hands the visitor to the team. Words are compared by their first five letters, so
 * "booking" matches "book" and "chauffeurs" matches "chauffeur".
 */
const STOP_WORDS = new Set(
  (
    "the and for are you your with that this have has can could would will what how where when which who why does did " +
    "from into about there their they them our not but any all get one out use per via " +
    "een het van voor met dat die dit zijn heeft heb kan kunnen zal wat hoe waar wanneer welke wie waarom doet deed " +
    "naar over uit ook niet maar alle ons onze uw mij mijn bij als dan of er om te"
  ).split(" "),
);

const stem = (word: string) => word.slice(0, 5);

const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem);

/** Minimum score to answer. Two question-word hits, or one in the question and a couple in the answer. */
const THRESHOLD = 3;

export function bestAnswer(message: string, faqs: readonly (readonly [question: string, answer: string])[]) {
  const asked = new Set(tokens(message));
  if (asked.size === 0) return null;

  let best: { answer: string; score: number } | null = null;
  for (const [question, answer] of faqs) {
    const inQuestion = new Set(tokens(question));
    const inAnswer = new Set(tokens(answer));
    let score = 0;
    for (const word of asked) {
      if (inQuestion.has(word)) score += 2;
      else if (inAnswer.has(word)) score += 1;
    }
    if (!best || score > best.score) best = { answer, score };
  }
  return best && best.score >= THRESHOLD ? best.answer : null;
}
