const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#E5E5E5",
  neutral300: "#A0A0A0",
  neutral400: "#717171",
  neutral500: "#4A4A4A",
  neutral600: "#2C2C2C",
  neutral700: "#1F1F1F",
  neutral800: "#121212",
  neutral900: "#000000",

  primary100: "#FFE8DD",
  primary200: "#FFD1BB",
  primary300: "#FFB799",
  primary400: "#FF9D77",
  primary500: "#FF8355",
  primary600: "#CC6944",

  secondary100: "#E8E9F3",
  secondary200: "#D1D3E7",
  secondary300: "#A3A7CF",
  secondary400: "#7579B3",
  secondary500: "#474D97",

  accent100: "#FFF4E0",
  accent200: "#FFE9C1",
  accent300: "#FFDE9F",
  accent400: "#FFD37D",
  accent500: "#FFC85B",

  angry100: "#FFE5E5",
  angry500: "#D32F2F",

  overlay20: "rgba(0, 0, 0, 0.2)",
  overlay50: "rgba(0, 0, 0, 0.5)",

  success: "#66BB6A",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral100, // White text for dark theme
  textDim: palette.neutral300, // Light gray for secondary text
  background: palette.neutral800, // Dark background
  border: palette.neutral600, // Dark borders
  tint: palette.primary400, // Bright accent
  tintInactive: palette.neutral500,
  separator: palette.neutral700,
  error: palette.angry500,
  errorBackground: palette.angry100,
} as const
