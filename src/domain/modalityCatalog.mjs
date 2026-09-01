export const modalityDisplayNames = {
  "Super 08": "Super 8",
  "Super 12": "Super 12",
  Reizinho: "Reizinho",
  "Super 10 Mista (Dupla Aleatória)": "Super 10 mista",
  "Super 12 Mista (Dupla Aleatória)": "Super 12 mista",
  "Super 16 Mista (Dupla Aleatória)": "Super 16 mista",
  "Super 20 Mista (Dupla Aleatória)": "Super 20 mista",
  "Super 12 Mista (Dupla Fixa)": "Super 6 (dupla fixa)",
  "Super 16 Mista (Dupla Fixa)": "Super 8 (dupla fixa)",
  "Super 10 (Dupla Fixa)": "Super 10 (dupla fixa)",
  "Super 12 (Dupla Fixa)": "Super 12 (dupla fixa)",
  "Simples 8": "Simples (1 contra 1 por jogo)",
  "Campeonato Cearense": "Torneio modelo Campeonato Cearense",
  "Campeonato Cearense Individual": "Torneio modelo Campeonato Cearense — Individual",
  "Modelo Play Ranking": "Modelo Torneio 360",
  "Copa Sunset": "Copa Sunset",
};

export function getModalityDisplayName(type) {
  return modalityDisplayNames[type] || type;
}

export const modalityPickerGroups = [
  {
    id: "fixed",
    title: "Duplas fixas",
    subtitle: "Os parceiros permanecem juntos durante todo o torneio.",
    types: [
      "Super 12 Mista (Dupla Fixa)",
      "Super 16 Mista (Dupla Fixa)",
      "Super 10 (Dupla Fixa)",
      "Super 12 (Dupla Fixa)",
    ],
  },
  {
    id: "individual",
    title: "Ranking individual",
    subtitle: "O desempenho é acumulado separadamente por atleta.",
    types: ["Reizinho", "Super 08", "Super 12", "Simples 8"],
  },
  {
    id: "mixed",
    title: "Mistas",
    subtitle: "Homens e mulheres participam com combinações de parceiros.",
    types: [
      "Super 10 Mista (Dupla Aleatória)",
      "Super 12 Mista (Dupla Aleatória)",
      "Super 16 Mista (Dupla Aleatória)",
      "Super 20 Mista (Dupla Aleatória)",
    ],
  },
  {
    id: "cups",
    title: "Copas e modelos",
    subtitle: "Formatos com grupos, eliminatórias ou regras especiais.",
    types: ["Copa - 18 duplas", "Campeonato Cearense", "Campeonato Cearense Individual", "Modelo Play Ranking", "Copa Sunset"],
  },
];

export const platformV2ModalityFamilies = [
  {
    id: "super",
    label: "Super",
    choiceLabel: "Escolha a quantidade",
    choices: [
      { type: "Reizinho", count: 4, label: "Super 4" },
      { type: "Reizinho", count: 6, label: "Super 6" },
      { type: "Super 08", count: 8, label: "Super 8" },
      { type: "Super 12", count: 12, label: "Super 12" },
    ],
  },
  {
    id: "fixed",
    label: "Super (dupla fixa)",
    choiceLabel: "Escolha a quantidade de duplas",
    choices: [
      { type: "Super 12 Mista (Dupla Fixa)", count: 6, label: "Super 6" },
      { type: "Super 16 Mista (Dupla Fixa)", count: 8, label: "Super 8" },
      { type: "Super 10 (Dupla Fixa)", count: 10, label: "Super 10" },
      { type: "Super 12 (Dupla Fixa)", count: 12, label: "Super 12" },
    ],
  },
  {
    id: "simple",
    label: "Simples/Individual (1 contra 1)",
    choiceLabel: "Escolha a quantidade de jogadores",
    choices: [4, 6, 8, 10, 12, 14].map((count) => ({
      type: "Simples 8",
      count,
      label: `${count} jogadores`,
    })),
  },
  {
    id: "mixed",
    label: "Super Mista",
    choiceLabel: "Escolha a quantidade de participantes",
    choices: [
      { type: "Super 10 Mista (Dupla Aleatória)", count: 10, label: "Super Mista 10" },
      { type: "Super 12 Mista (Dupla Aleatória)", count: 12, label: "Super Mista 12" },
      { type: "Super 16 Mista (Dupla Aleatória)", count: 16, label: "Super Mista 16" },
      { type: "Super 20 Mista (Dupla Aleatória)", count: 20, label: "Super Mista 20" },
    ],
  },
  {
    id: "championships",
    label: "Campeonatos/Copas",
    choiceLabel: "Escolha o modelo",
    choices: [
      { type: "Campeonato Cearense", label: "Campeonato Cearense" },
      { type: "Campeonato Cearense Individual", label: "Campeonato Cearense Individual" },
    ],
  },
];

export const platformV2SpecificModalities = [
  { type: "Copa - 18 duplas", count: 18, label: "Copa 18 duplas" },
  { type: "Copa Sunset", label: "Copa Sunset" },
  { type: "Modelo Play Ranking", label: "Modelo Torneio 360" },
];

export const modalityPickerDescriptions = {
  "Super 12 Mista (Dupla Fixa)": "6 duplas definidas e classificação por equipe.",
  "Super 16 Mista (Dupla Fixa)": "8 duplas definidas e classificação por equipe.",
  "Super 10 (Dupla Fixa)": "10 duplas fixas, 9 rodadas e 45 jogos sem repetir adversários.",
  "Super 12 (Dupla Fixa)": "12 duplas fixas, 11 rodadas e 66 jogos sem repetir adversários.",
  "Super 08": "8 participantes, parceiros variados e um ranking individual.",
  "Super 12": "12 participantes, parceiros variados e um ranking individual.",
  Reizinho: "Escolha 4 atletas no formato tradicional ou 6 conforme o Super 6.",
  "Simples 8": "De 4 a 14 jogadores em partidas individuais de todos contra todos.",
  "Super 10 Mista (Dupla Aleatória)": "5 homens e 5 mulheres, com rankings separados.",
  "Super 12 Mista (Dupla Aleatória)": "6 homens e 6 mulheres, com rankings separados.",
  "Super 16 Mista (Dupla Aleatória)": "8 homens e 8 mulheres, com rankings separados.",
  "Super 20 Mista (Dupla Aleatória)": "10 homens e 10 mulheres, com rankings separados.",
  "Copa - 18 duplas": "Fase de grupos seguida por chave eliminatória.",
  "Campeonato Cearense": "Grupos, chave principal e disputas paralelas configuráveis.",
  "Campeonato Cearense Individual": "O modelo cearense completo em partidas individuais, um contra um.",
  "Modelo Play Ranking": "Modelo Torneio 360 com chave principal e disputa paralela.",
  "Copa Sunset": "Grupos, quatro chaves independentes e encontro final entre as campeãs.",
};

export function normalizeModalitySearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
