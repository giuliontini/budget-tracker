// src/utils/categories.ts

export const macroCategories = ['Needs', 'Wants', 'Savings'] as const;
export type MacroCategory = typeof macroCategories[number];

export const microCategories = [
  'Housing/Rent',
  'Utilities',
  'Food',
  'Dining',
  'Travel',
  'Transportation',
  'Personal Wellbeing',
  'Entertainment',
  'Loans',
  'Shopping',
  'Investments',
  'Misc',
] as const;
export type MicroCategory = typeof microCategories[number];

/**
 * Map each micro to its macro. Adjust “Misc” or add savings-specific micros as you like.
 */
export const microToMacro: Record<MicroCategory, MacroCategory> = {
  'Housing/Rent':   'Needs',
  'Utilities':      'Needs',
  'Food':    'Needs',
  'Dining': 'Wants',
  'Transportation': 'Wants',
  'Shopping': 'Wants',
  'Personal Wellbeing':   'Wants',
  'Entertainment':  'Wants',
  'Investments': 'Savings',
  'Misc': 'Wants',
  'Travel': 'Savings',
  'Loans': 'Savings',
};
