/**
 * Color palette configuration for the voting system
 * All colors use HSL format for consistency with Tailwind
 */

export const colors = {
  // Primary palette - Monochrome
  primary: {
    DEFAULT: '0 0% 8%',
    foreground: '0 0% 100%',
  },

  // Secondary palette
  secondary: {
    DEFAULT: '0 0% 96%',
    foreground: '0 0% 8%',
  },

  // Muted colors
  muted: {
    DEFAULT: '0 0% 96%',
    foreground: '0 0% 45%',
  },

  // Accent colors
  accent: {
    DEFAULT: '0 0% 96%',
    foreground: '0 0% 8%',
  },

  // Semantic colors
  success: {
    DEFAULT: '142 72% 29%',
    foreground: '0 0% 100%',
  },

  destructive: {
    DEFAULT: '0 72% 51%',
    foreground: '0 0% 100%',
  },

  // Background and foreground
  background: '0 0% 100%',
  foreground: '0 0% 8%',

  // Card
  card: {
    DEFAULT: '0 0% 100%',
    foreground: '0 0% 8%',
  },

  // Border and input
  border: '0 0% 90%',
  input: '0 0% 90%',
  ring: '0 0% 8%',
};

export const darkColors = {
  // Primary palette - Monochrome (inverted)
  primary: {
    DEFAULT: '0 0% 98%',
    foreground: '0 0% 8%',
  },

  // Secondary palette
  secondary: {
    DEFAULT: '0 0% 15%',
    foreground: '0 0% 98%',
  },

  // Muted colors
  muted: {
    DEFAULT: '0 0% 15%',
    foreground: '0 0% 65%',
  },

  // Background and foreground
  background: '0 0% 5%',
  foreground: '0 0% 98%',

  // Card
  card: {
    DEFAULT: '0 0% 8%',
    foreground: '0 0% 98%',
  },

  // Border and input
  border: '0 0% 18%',
  input: '0 0% 18%',
  ring: '0 0% 85%',
};
