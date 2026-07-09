export type PublicQuizQuestion = {
  id: string;
  options: string[];
  question: string;
};

// Quiz correction data is server-owned. Build the public representation from a
// strict allowlist so present and future answer/solution fields cannot leak.
export function projectPublicQuiz(value: unknown): PublicQuizQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const question = entry as Record<string, unknown>;
    const options = Array.isArray(question.options)
      ? question.options.slice(0, 20).map(option => String(option).slice(0, 500))
      : [];
    return [{
      id: String(question.id || `question-${index + 1}`).slice(0, 100),
      options,
      question: String(question.question || "").slice(0, 2_000)
    }];
  });
}
