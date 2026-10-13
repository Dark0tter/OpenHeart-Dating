import type { CSSProperties } from "react";

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export type FlagTheme = {
  id: string;
  label: string;
  /** Flag stripes, top to bottom. */
  stripes: string[];
  /** Full CSS background for flags that aren't plain stripes. */
  swatch?: string;
  /** Button and accent color. Must read well under light text (light mode) and dark text (dark mode). */
  accentLight: string;
  accentDark: string;
  /** Small labels and highlights on the page background. */
  secondaryLight: string;
  secondaryDark: string;
  /** Three flag colors for the soft background glow. */
  glow: [string, string, string];
};

export const FLAG_THEMES: FlagTheme[] = [
  {
    id: "rainbow",
    label: "Rainbow Pride",
    stripes: ["#E40303", "#FF8C00", "#FFED00", "#008026", "#004DFF", "#750787"],
    accentLight: "#750787",
    accentDark: "#FFB347",
    secondaryLight: "#1E4FD8",
    secondaryDark: "#7FB2FF",
    glow: ["#E40303", "#FFED00", "#004DFF"],
  },
  {
    id: "progress",
    label: "Progress Pride",
    stripes: [
      "#000000",
      "#784F17",
      "#5BCEFA",
      "#F5A9B8",
      "#FFFFFF",
      "#E40303",
      "#FF8C00",
      "#FFED00",
      "#008026",
      "#004DFF",
      "#750787",
    ],
    swatch:
      "linear-gradient(135deg, #FFFFFF 0 10%, #F5A9B8 10% 17%, #5BCEFA 17% 24%, #784F17 24% 31%, #000000 31% 38%, transparent 38%), linear-gradient(to bottom, #E40303 0 16.66%, #FF8C00 16.66% 33.33%, #FFED00 33.33% 50%, #008026 50% 66.66%, #004DFF 66.66% 83.33%, #750787 83.33%)",
    accentLight: "#750787",
    accentDark: "#F5A9B8",
    secondaryLight: "#1A6FA0",
    secondaryDark: "#5BCEFA",
    glow: ["#5BCEFA", "#F5A9B8", "#FF8C00"],
  },
  {
    id: "trans",
    label: "Transgender",
    stripes: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"],
    accentLight: "#B03A68",
    accentDark: "#F5A9B8",
    secondaryLight: "#1A6FA0",
    secondaryDark: "#5BCEFA",
    glow: ["#5BCEFA", "#F5A9B8", "#FFFFFF"],
  },
  {
    id: "bisexual",
    label: "Bisexual",
    stripes: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"],
    accentLight: "#9B4F96",
    accentDark: "#F08CC0",
    secondaryLight: "#0038A8",
    secondaryDark: "#8AA8FF",
    glow: ["#D60270", "#9B4F96", "#0038A8"],
  },
  {
    id: "pansexual",
    label: "Pansexual",
    stripes: ["#FF218C", "#FFD800", "#21B1FF"],
    accentLight: "#B8166A",
    accentDark: "#FFD800",
    secondaryLight: "#0A6FAD",
    secondaryDark: "#4CC2FF",
    glow: ["#FF218C", "#FFD800", "#21B1FF"],
  },
  {
    id: "lesbian",
    label: "Lesbian",
    stripes: [
      "#D52D00",
      "#EF7627",
      "#FF9A56",
      "#FFFFFF",
      "#D162A4",
      "#B55690",
      "#A30262",
    ],
    accentLight: "#A30262",
    accentDark: "#FF9A56",
    secondaryLight: "#A83E00",
    secondaryDark: "#E58FC2",
    glow: ["#D52D00", "#FF9A56", "#D162A4"],
  },
  {
    id: "gay",
    label: "Gay men (MLM)",
    stripes: [
      "#078D70",
      "#26CEAA",
      "#98E8C1",
      "#FFFFFF",
      "#7BADE2",
      "#5049CC",
      "#3D1A78",
    ],
    accentLight: "#3D1A78",
    accentDark: "#98E8C1",
    secondaryLight: "#05735B",
    secondaryDark: "#7BADE2",
    glow: ["#26CEAA", "#7BADE2", "#5049CC"],
  },
  {
    id: "nonbinary",
    label: "Nonbinary",
    stripes: ["#FCF434", "#FFFFFF", "#9C59D1", "#2C2C2C"],
    accentLight: "#6E3A9E",
    accentDark: "#FCF434",
    secondaryLight: "#6B5A00",
    secondaryDark: "#C79BEC",
    glow: ["#FCF434", "#9C59D1", "#2C2C2C"],
  },
  {
    id: "genderqueer",
    label: "Genderqueer",
    stripes: ["#B57EDC", "#FFFFFF", "#4A8123"],
    accentLight: "#6B3FA0",
    accentDark: "#C9A0E8",
    secondaryLight: "#3E6E1D",
    secondaryDark: "#8FC96A",
    glow: ["#B57EDC", "#4A8123", "#FFFFFF"],
  },
  {
    id: "genderfluid",
    label: "Genderfluid",
    stripes: ["#FF76A4", "#FFFFFF", "#C011D7", "#000000", "#2F3CBE"],
    accentLight: "#9A0EAD",
    accentDark: "#FF8FB5",
    secondaryLight: "#2F3CBE",
    secondaryDark: "#9AA2FF",
    glow: ["#FF76A4", "#C011D7", "#2F3CBE"],
  },
  {
    id: "agender",
    label: "Agender",
    stripes: [
      "#000000",
      "#BCC4C7",
      "#FFFFFF",
      "#B7F684",
      "#FFFFFF",
      "#BCC4C7",
      "#000000",
    ],
    accentLight: "#2F6B2A",
    accentDark: "#B7F684",
    secondaryLight: "#555F62",
    secondaryDark: "#BCC4C7",
    glow: ["#B7F684", "#BCC4C7", "#000000"],
  },
  {
    id: "asexual",
    label: "Asexual",
    stripes: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"],
    accentLight: "#800080",
    accentDark: "#D49BE8",
    secondaryLight: "#555555",
    secondaryDark: "#B5B5B5",
    glow: ["#800080", "#A3A3A3", "#000000"],
  },
  {
    id: "aromantic",
    label: "Aromantic",
    stripes: ["#3DA542", "#A7D379", "#FFFFFF", "#A9A9A9", "#000000"],
    accentLight: "#2B6E2F",
    accentDark: "#A7D379",
    secondaryLight: "#555555",
    secondaryDark: "#B5B5B5",
    glow: ["#3DA542", "#A7D379", "#A9A9A9"],
  },
  {
    id: "demisexual",
    label: "Demisexual",
    stripes: ["#FFFFFF", "#FFFFFF", "#6E0070", "#D2D2D2", "#D2D2D2"],
    swatch:
      "linear-gradient(to top right, #000000 50%, transparent 50%) top left / 40% 50% no-repeat, linear-gradient(to bottom right, #000000 50%, transparent 50%) bottom left / 40% 50% no-repeat, linear-gradient(to bottom, #FFFFFF 0 42%, #6E0070 42% 58%, #D2D2D2 58%)",
    accentLight: "#6E0070",
    accentDark: "#D08FD3",
    secondaryLight: "#555555",
    secondaryDark: "#D2D2D2",
    glow: ["#6E0070", "#D2D2D2", "#000000"],
  },
  {
    id: "intersex",
    label: "Intersex",
    stripes: ["#FFD800", "#7902AA", "#FFD800"],
    swatch:
      "radial-gradient(circle at center, transparent 0 22%, #7902AA 22% 32%, transparent 32%), #FFD800",
    accentLight: "#7902AA",
    accentDark: "#FFD800",
    secondaryLight: "#6B5A00",
    secondaryDark: "#C98AE8",
    glow: ["#FFD800", "#7902AA", "#FFD800"],
  },
  {
    id: "polyamorous",
    label: "Polyamorous",
    stripes: ["#009FE3", "#E50051", "#340C46"],
    accentLight: "#B8003F",
    accentDark: "#FF7AA3",
    secondaryLight: "#00699A",
    secondaryDark: "#4FC3F7",
    glow: ["#009FE3", "#E50051", "#340C46"],
  },
  {
    id: "omnisexual",
    label: "Omnisexual",
    stripes: ["#FE9ACE", "#FF53BF", "#200044", "#6760FE", "#8EA6FF"],
    accentLight: "#4B44D6",
    accentDark: "#FE9ACE",
    secondaryLight: "#A8127C",
    secondaryDark: "#8EA6FF",
    glow: ["#FE9ACE", "#FF53BF", "#6760FE"],
  },
  {
    id: "polysexual",
    label: "Polysexual",
    stripes: ["#F714BA", "#01D66A", "#1594F6"],
    accentLight: "#A30E7E",
    accentDark: "#01D66A",
    secondaryLight: "#0B64AD",
    secondaryDark: "#5DB5F9",
    glow: ["#F714BA", "#01D66A", "#1594F6"],
  },
  {
    id: "leather",
    label: "Leather Pride",
    stripes: [
      "#000000",
      "#23238E",
      "#000000",
      "#23238E",
      "#FFFFFF",
      "#23238E",
      "#000000",
      "#23238E",
      "#000000",
    ],
    swatch:
      "radial-gradient(circle at 16% 30%, #E40303 0 4px, transparent 4.5px), linear-gradient(to bottom, #000 0 11%, #23238E 11% 22%, #000 22% 33%, #23238E 33% 44%, #FFF 44% 56%, #23238E 56% 67%, #000 67% 78%, #23238E 78% 89%, #000 89%)",
    accentLight: "#23238E",
    accentDark: "#FF6B6B",
    secondaryLight: "#B31B1B",
    secondaryDark: "#9C9CF0",
    glow: ["#23238E", "#E40303", "#000000"],
  },
];

export const FLAG_IDS = FLAG_THEMES.map((f) => f.id);

export function flagById(id: string | null | undefined): FlagTheme | null {
  return FLAG_THEMES.find((f) => f.id === id) ?? null;
}

export function stripeGradient(stripes: string[], direction: string): string {
  const step = 100 / stripes.length;
  const stops = stripes.map(
    (c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`,
  );
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}

/** Preview of the flag itself, for the theme picker. */
export function flagSwatch(flag: FlagTheme): string {
  return flag.swatch ?? stripeGradient(flag.stripes, "to bottom");
}

/** CSS variables consumed by the `[data-flag="on"]` rules in globals.css. */
export function flagStyle(flag: FlagTheme | null): CSSProperties | undefined {
  if (!flag) return undefined;
  return {
    "--flag-stripe": stripeGradient(flag.stripes, "to right"),
    "--flag-a-l": flag.accentLight,
    "--flag-a-d": flag.accentDark,
    "--flag-b-l": flag.secondaryLight,
    "--flag-b-d": flag.secondaryDark,
    "--flag-c1": flag.glow[0],
    "--flag-c2": flag.glow[1],
    "--flag-c3": flag.glow[2],
  } as CSSProperties;
}
