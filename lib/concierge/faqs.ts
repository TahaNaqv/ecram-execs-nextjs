/** The concierge's questions and answers live in the dictionary as faq1Q/faq1A … faq16Q/faq16A. */
export const FAQ_COUNT = 16;

export type Faq = readonly [question: string, answer: string];

export const faqsFrom = (section: object): Faq[] => {
  const strings = section as Record<string, string>;
  return Array.from({ length: FAQ_COUNT }, (_, i) => [strings[`faq${i + 1}Q`], strings[`faq${i + 1}A`]] as const);
};
