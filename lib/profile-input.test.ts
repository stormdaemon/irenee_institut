import assert from "node:assert/strict";
import { test } from "node:test";
import { ProfileInputError, parseProfileUpdate, parseRegistrationInput } from "./profile-input";

test("profile updates normalize personal data and safe social URLs", () => {
  assert.deepEqual(parseProfileUpdate({
    adresse: "  1 rue de Lyon ",
    civilite: "Mme",
    date_naissance: "1991-04-12",
    instagram_url: "https://www.instagram.com/irenee/",
    nom: "  Dupont ",
    prenom: " Marie  Anne ",
    specialites: ["Patristique", " Patristique ", "Apologétique"]
  }, false), {
    adresse: "1 rue de Lyon",
    civilite: "Mme",
    date_naissance: "1991-04-12",
    instagram_url: "https://www.instagram.com/irenee/",
    nom: "Dupont",
    prenom: "Marie Anne",
    specialites: ["Patristique", "Apologétique"]
  });
});

test("profile updates reject executable URLs, invalid dates and director-only fields", () => {
  assert.throws(() => parseProfileUpdate({ instagram_url: "javascript:alert(1)" }, false), ProfileInputError);
  assert.throws(() => parseProfileUpdate({ date_naissance: "2099-01-01" }, false), ProfileInputError);
  assert.throws(() => parseProfileUpdate({ statut_inscription: "validee" }, false), ProfileInputError);
  assert.throws(() => parseProfileUpdate({ unexpected: "value" }, true), ProfileInputError);
});

test("registration input is bounded to declared payment choices", () => {
  assert.deepEqual(parseRegistrationInput({
    formation_choisie: ["Pass annuel"],
    modalite_paiement: "annuel",
    moyen_paiement: "stripe",
    nom: "Dupont",
    prenom: "Marie",
    tarif_applicable: "standard",
    telephone: "+33 6 12 34 56 78"
  }), {
    formation_choisie: ["Pass annuel"],
    modalite_paiement: "annuel",
    moyen_paiement: "stripe",
    nom: "Dupont",
    prenom: "Marie",
    tarif_applicable: "standard",
    telephone: "+33 6 12 34 56 78"
  });
  assert.throws(() => parseRegistrationInput({ moyen_paiement: "crypto-admin" }), ProfileInputError);
});
