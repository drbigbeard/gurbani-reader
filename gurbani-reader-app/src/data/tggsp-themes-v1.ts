export interface TggspTheme {
  id: string;
  label: string;
  aliases: string[];
  searchTerms: string[];
  reviewStatus: "proof-of-concept-reviewed";
  sensitive: boolean;
}

export const TGGSP_THEME_INDEX_VERSION = "tggsp-themes-v1";

export const tggspThemes: TggspTheme[] = [
  {
    id: "ego",
    label: "Ego and self-centredness",
    aliases: [
      "ego",
      "egotism",
      "pride",
      "self centred",
      "self-centered",
      "haumai",
    ],
    searchTerms: [
      "ego",
      "egotism",
      "pride",
      "self-centred",
      "self-centered",
      "haumai",
    ],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "diet",
    label: "Diet and food",
    aliases: ["diet", "food", "eating", "meat", "vegetarian", "vegetarianism"],
    searchTerms: ["diet", "food", "eating", "meat", "vegetarian"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: true,
  },
  {
    id: "compassion",
    label: "Compassion",
    aliases: ["compassion", "compassionate", "mercy"],
    searchTerms: ["compassion", "compassionate", "mercy"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "contentment",
    label: "Contentment",
    aliases: ["contentment", "contented", "satisfaction"],
    searchTerms: ["contentment", "contented", "satisfaction"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "calmness",
    label: "Calmness and inner stillness",
    aliases: ["calm", "calmness", "stillness", "inner peace"],
    searchTerms: ["calm", "stillness", "peace"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "humility",
    label: "Humility",
    aliases: ["humility", "humble"],
    searchTerms: ["humility", "humble"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "courage",
    label: "Courage and fearlessness",
    aliases: ["courage", "courageous", "fearless", "fearlessness"],
    searchTerms: ["courage", "courageous", "fearless", "fearlessness"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: false,
  },
  {
    id: "gender",
    label: "Gender",
    aliases: ["gender", "women", "woman"],
    searchTerms: ["gender", "women", "woman", "feminine", "masculine"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: true,
  },
  {
    id: "afterlife",
    label: "Afterlife language",
    aliases: ["afterlife", "heaven", "hell"],
    searchTerms: ["afterlife", "heaven", "hell"],
    reviewStatus: "proof-of-concept-reviewed",
    sensitive: true,
  },
];

export function resolveTggspTheme(query: string): TggspTheme | null {
  if (/[^a-z\s-]/iu.test(query) || /[\u0A00-\u0A7F]/u.test(query)) return null;
  const folded = query.toLowerCase().trim().replace(/\s+/gu, " ");
  if (!folded || folded.split(" ").length > 6) return null;
  return tggspThemes.find((theme) => theme.aliases.includes(folded)) ?? null;
}
