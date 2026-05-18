export type CustomQuestion =
  | { id: string; type: 'SHORT_TEXT';    label: string; required: boolean }
  | { id: string; type: 'LONG_TEXT';     label: string; required: boolean }
  | { id: string; type: 'SINGLE_CHOICE'; label: string; required: boolean; options: string[] }
  | { id: string; type: 'YES_NO';        label: string; required: boolean };

export type CustomAnswers = Record<string, string>;
