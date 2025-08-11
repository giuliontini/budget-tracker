// src/utils/categories.ts

export const macroCategories = ['Needs', 'Wants', 'Savings'] as const;
export type MacroCategory = typeof macroCategories[number];

export const microCategories = [
  'Housing/Rent',
  'Utilities',
  'Food/Dining',
  'Travel/Transportation',
  'Personal Wellbeing',
  'Entertainment',
  'Misc',
] as const;
export type MicroCategory = typeof microCategories[number];

/**
 * Map each micro to its macro. Adjust “Misc” or add savings-specific micros as you like.
 */
export const microToMacro: Record<MicroCategory, MacroCategory> = {
  'Housing/Rent':   'Needs',
  'Utilities':      'Needs',
  'Food/Dining':    'Needs',
  'Travel/Transportation': 'Wants',
  'Personal Wellbeing':   'Wants',
  'Entertainment':  'Wants',
  'Misc':           'Savings',
};
