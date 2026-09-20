import { m as mergeLocales } from "./index-BBNFp_os.js";
const locale = { "sheets-note-ui": {
  note: { placeholder: "Wpisz tutaj" },
  rightClick: {
    addNote: "Dodaj notatkę",
    deleteNote: "Usuń notatkę",
    toggleNote: "Pokaż/Ukryj notatkę"
  }
} };
const s = mergeLocales(
  locale
);
export {
  s as default
};
