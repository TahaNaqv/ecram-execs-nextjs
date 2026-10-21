/**
 * Picks the FAQ answer that best fits a typed question. No AI behind this: it compares meaningful words
 * (ignoring small connecting words and word endings) and only answers when the overlap is convincing,
 * otherwise the caller hands the visitor to the team. Words are compared by their first four letters, so
 * "booking" matches "book" and "chauffeurs" matches "chauffeur"; a few everyday synonyms are folded together first
 * ("reserve" is "book", "cost" is "price", "phone" is "contact") so a question is not missed over its wording.
 */
const STOP_WORDS = new Set(
  (
    "the and for are you your with that this have has can could would will what how where when which who why does did " +
    "from into about there their they them our not but any all get one out use per via " +
    "een het van voor met dat die dit zijn heeft heb kan kunnen zal wat hoe waar wanneer welke wie waarom doet deed " +
    "naar over uit ook niet maar alle ons onze uw mij mijn bij als dan of er om te"
  ).split(" "),
);

const SYNONYMS: Record<string, string> = {
  reserve: "booking", reserved: "booking", reservation: "booking", reservations: "booking", reserveren: "booking", reservering: "booking", reserveer: "booking", boeken: "booking", boeking: "booking",
  cost: "price", costs: "price", prices: "price", pricing: "price", fee: "price", fees: "price", rate: "price", rates: "price", quote: "price", quotation: "price", prijs: "price", prijzen: "price", kosten: "price", tarief: "price", tarieven: "price", offerte: "price", prijsopgave: "price",
  phone: "contact", call: "contact", email: "contact", mail: "contact", reach: "contact", telefoon: "contact", bellen: "contact", mailen: "contact", bereiken: "contact", bereikbaar: "contact",
};

const stem = (word: string) => word.slice(0, 4);

const tokens = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map((word) => stem(SYNONYMS[word] ?? word));

/** Minimum score to answer. Two question-word hits, or one in the question and a couple in the answer. */
const THRESHOLD = 3;

/**
 * The FAQ that best fits a typed question — its position in `faqs` and its answer — or null when none fits well enough.
 * Equal scores go to the question the visitor's words cover the most of ("how do I book" fits "How do I make a booking?"
 * better than "How far in advance should I book?").
 */
export function bestMatch(message: string, faqs: readonly (readonly [question: string, answer: string])[]) {
  const asked = new Set(tokens(message));
  if (asked.size === 0) return null;

  let best: { index: number; answer: string; score: number; coverage: number } | null = null;
  faqs.forEach(([question, answer], index) => {
    const inQuestion = new Set(tokens(question));
    const inAnswer = new Set(tokens(answer));
    let score = 0;
    let hits = 0;
    for (const word of asked) {
      if (inQuestion.has(word)) {
        score += 2;
        hits++;
      } else if (inAnswer.has(word)) score += 1;
    }
    const coverage = hits / Math.max(inQuestion.size, 1);
    if (!best || score > best.score || (score === best.score && coverage > best.coverage)) best = { index, answer, score, coverage };
  });
  // A short question ("prices?", "airport transfers") can only ever hit one or two words: one word in a question is enough for it
  const needed = asked.size <= 2 ? 2 : THRESHOLD;
  const found = best as { index: number; answer: string; score: number } | null;
  return found && found.score >= needed ? { index: found.index, answer: found.answer } : null;
}

export const bestAnswer = (message: string, faqs: readonly (readonly [question: string, answer: string])[]) => bestMatch(message, faqs)?.answer ?? null;
