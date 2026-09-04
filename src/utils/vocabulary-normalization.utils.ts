export const normalizeUnicodeSpacing = (value: string): string =>
    value.normalize("NFKC").trim().replace(/\s+/gu, " ");

export const normalizeVocabularyWord = (value: string): string =>
    normalizeUnicodeSpacing(value).toLocaleLowerCase("en-US");
