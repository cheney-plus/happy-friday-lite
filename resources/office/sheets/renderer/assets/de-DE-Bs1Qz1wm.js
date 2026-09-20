import { m as mergeLocales } from "./index-BBNFp_os.js";
const locale = { "sheets-note-ui": {
  note: { placeholder: "Hier eingeben" },
  rightClick: {
    addNote: "Notiz hinzufügen",
    deleteNote: "Notiz löschen",
    toggleNote: "Notiz anzeigen/ausblenden"
  }
} };
const s = mergeLocales(
  locale
);
export {
  s as default
};
