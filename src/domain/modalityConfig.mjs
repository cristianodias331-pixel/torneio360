export const allowedByPlan = {
  basic: [
    "Reizinho",
    "Super 08",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
  ],
  pro: [
    "Super 12 Mista (Dupla Fixa)",
    "Reizinho",
    "Super 08",
    "Super 16 Mista (Dupla Fixa)",
    "Super 10 (Dupla Fixa)",
    "Super 12 (Dupla Fixa)",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
  ],
  premium: [
    "Super 12 Mista (Dupla Fixa)",
    "Reizinho",
    "Super 08",
    "Super 16 Mista (Dupla Fixa)",
    "Super 10 (Dupla Fixa)",
    "Super 12 (Dupla Fixa)",
    "Super 12",
    "Super 10 Mista (Dupla Aleatória)",
    "Super 12 Mista (Dupla Aleatória)",
    "Super 16 Mista (Dupla Aleatória)",
    "Super 20 Mista (Dupla Aleatória)",
    "Simples 8",
    "Copa - 18 duplas",
    "Campeonato Cearense",
    "Campeonato Cearense Individual",
    "Modelo Play Ranking",
    "Copa Sunset",
  ],
};

export const modalityConfig = {
  "Reizinho": {
    type: "reizinho",
    allowedPlayerCounts: [4, 6],
    defaultPlayers: 4,
    total: 4,
    label: "Atleta",
    courts: 1,
  },

  "Super 08": {
    type: "super8",
    total: 8,
    label: "Participante",
    courts: 2,
  },

  "Super 12": {
    type: "super12",
    total: 12,
    label: "Participante",
    courts: 3,
  },

  "Super 10 Mista (Dupla Aleatória)": {
    type: "mixed10",
    men: 5,
    women: 5,
    courts: 2,
  },

  "Super 12 Mista (Dupla Aleatória)": {
    type: "mixed12",
    men: 6,
    women: 6,
    courts: 3,
  },

  "Super 16 Mista (Dupla Aleatória)": {
    type: "mixed16",
    men: 8,
    women: 8,
    courts: 4,
  },

  "Super 20 Mista (Dupla Aleatória)": {
    type: "mixed20",
    men: 10,
    women: 10,
    courts: 5,
  },

  "Super 12 Mista (Dupla Fixa)": {
    type: "fixed12",
    teams: 6,
    courts: 3,
  },

  "Super 16 Mista (Dupla Fixa)": {
    type: "fixed16",
    teams: 8,
    courts: 4,
  },

  "Super 10 (Dupla Fixa)": {
    type: "fixed20",
    teams: 10,
    courts: 5,
  },

  "Super 12 (Dupla Fixa)": {
    type: "fixed24",
    teams: 12,
    courts: 6,
  },

  "Simples 8": {
    type: "simple8",
    allowedPlayerCounts: [4, 6, 8, 10, 12, 14],
    defaultPlayers: 8,
    total: 8,
    label: "Jogador",
    courts: 4,
  },

  "Copa - 12 ou 24 duplas": {
    type: "cup",
    cupMode: "standard",
    allowedTeamCounts: [12, 24],
    defaultTeams: 12,
    groupSize: 3,
    defaultMainBracketName: "Principal",
    defaultRepechageName: "Repescagem",
    courts: 4,
  },

  "Copa - 18 duplas": {
    type: "cup18",
    cupMode: "cup18",
    allowedTeamCounts: [18],
    defaultTeams: 18,
    groupSize: 3,
    defaultMainBracketName: "Principal",
    defaultRepechageName: "Disputa Paralela",
    courts: 6,
  },

  "Copa - 21 duplas": {
    type: "cup21",
    cupMode: "cup21",
    allowedTeamCounts: [21],
    defaultTeams: 21,
    groupSize: 3,
    defaultMainBracketName: "Chave Principal",
    defaultRepechageName: "Disputa Paralela",
    courts: 7,
  },

  "Copinha - grupos de 3": {
    type: "copinha",
    cupMode: "copinha",
    allowedTeamCounts: [6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
    defaultTeams: 6,
    groupSize: 3,
    defaultMainBracketName: "Chave Principal",
    defaultRepechageName: "Consolação",
    courts: 4,
  },

  "Campeonato Cearense": {
    type: "cearense",
    cupMode: "cearense",
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "Consolation",
    defaultThirdRepechageName: "Caridade",
    courts: 6,
  },

  "Campeonato Cearense Individual": {
    type: "cearenseIndividual",
    cupMode: "cearense-individual",
    individualCup: true,
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "Consolation",
    defaultThirdRepechageName: "Caridade",
    courts: 6,
  },

  "Modelo Play Ranking": {
    type: "playranking",
    cupMode: "playranking",
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "Consolation",
    courts: 6,
  },

  "Copa Sunset": {
    type: "sunset",
    cupMode: "sunset",
    allowedTeamCounts: Array.from({ length: 29 }, (_, index) => index + 4),
    defaultTeams: 4,
    defaultMainBracketName: "Eliminatória Principal",
    defaultRepechageName: "Consolation",
    defaultSecondParallelName: "Caridade",
    defaultThirdRepechageName: "Também Ganhei",
    defaultSunsetBracketName: "Etapa Sunset",
    courts: 6,
  },
};
