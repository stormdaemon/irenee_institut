export const ANNUAL_PASS_NAME = "Pass annuel de l'institut d'apologétique saint Irénée";
export const ANNUAL_PASS_PRODUCT_ID = "annual-pass-saint-irenee";
export const ANNUAL_PASS_SLUG = "pass-annuel-institut-apologetique-saint-irenee";
export const ANNUAL_PASS_DURATION_DAYS = 365;
export const FINAL_EXAM_PASS_SCORE = 70;

export type FinalExamQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: number;
};

export const FINAL_EXAM_QUESTIONS: FinalExamQuestion[] = [
  {
    id: "hope-reason",
    question: "Quel principe résume le mieux la démarche apologétique chrétienne ?",
    options: [
      "Rendre raison de l'espérance avec vérité et charité",
      "Éviter toute discussion portant sur la foi",
      "Remporter un débat par la seule rhétorique",
      "Réduire la foi à une opinion privée"
    ],
    answer: 0
  },
  {
    id: "scripture-tradition",
    question: "Dans la perspective catholique, comment articuler Écriture et Tradition ?",
    options: [
      "Comme deux réalités sans aucun rapport",
      "Comme deux modes liés de transmission de la foi apostolique",
      "Comme deux opinions facultatives",
      "En supprimant toute lecture historique"
    ],
    answer: 1
  },
  {
    id: "faith-reason",
    question: "Quelle affirmation décrit correctement le rapport entre foi et raison ?",
    options: [
      "Elles sont nécessairement ennemies",
      "La foi interdit toute recherche intellectuelle",
      "Elles peuvent coopérer dans la recherche de la vérité",
      "La raison suffit à épuiser tout mystère"
    ],
    answer: 2
  },
  {
    id: "science-scientism",
    question: "Pourquoi distinguer science et scientisme ?",
    options: [
      "Parce que la science est une méthode et le scientisme une prétention philosophique",
      "Parce que toute science est une croyance religieuse",
      "Parce que le scientisme est une branche de la biologie",
      "Parce que les découvertes scientifiques sont sans intérêt"
    ],
    answer: 0
  },
  {
    id: "historical-objection",
    question: "Face à une objection historique, quelle méthode convient le mieux ?",
    options: [
      "Ignorer les sources contraires",
      "Répondre immédiatement sans vérifier",
      "Distinguer les faits, leur contexte et leur interprétation",
      "Remplacer l'étude par une affirmation d'autorité"
    ],
    answer: 2
  },
  {
    id: "dialogue",
    question: "Le dialogue interreligieux catholique demande principalement de :",
    options: [
      "Dissimuler les désaccords",
      "Associer clarté doctrinale, écoute et respect des personnes",
      "Considérer toutes les doctrines comme identiques",
      "Refuser toute rencontre"
    ],
    answer: 1
  },
  {
    id: "moral-question",
    question: "Pour traiter une question morale sensible, il faut d'abord :",
    options: [
      "Caricaturer l'objection",
      "Écouter la question et clarifier les termes",
      "Éviter toute nuance",
      "Répondre uniquement par un slogan"
    ],
    answer: 1
  },
  {
    id: "philosophy",
    question: "Quel est l'intérêt de la philosophie en apologétique ?",
    options: [
      "Elle aide à examiner les raisonnements et leurs présupposés",
      "Elle remplace entièrement la théologie",
      "Elle dispense de connaître son interlocuteur",
      "Elle rend inutile toute source"
    ],
    answer: 0
  },
  {
    id: "public-engagement",
    question: "Dans l'engagement public, une réponse apologétique juste cherche à :",
    options: [
      "Humilier l'interlocuteur",
      "Produire uniquement de la polémique",
      "Servir la vérité sans renoncer à la charité",
      "Éviter toute responsabilité"
    ],
    answer: 2
  },
  {
    id: "certificate",
    question: "Que certifie l'examen final de l'Institut ?",
    options: [
      "La participation à un unique module",
      "L'achèvement du cursus et la réussite de son évaluation finale",
      "Un diplôme universitaire national",
      "Une habilitation professionnelle réglementée"
    ],
    answer: 1
  }
];

