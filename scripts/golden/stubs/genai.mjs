// Stand-in for @google/genai (legacy/ has no node_modules): the plan
// generators only read the Type enum, which serializes to these strings.
export const Type = {
  OBJECT: "OBJECT",
  ARRAY: "ARRAY",
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
};
