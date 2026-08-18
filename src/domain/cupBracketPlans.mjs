export const copinhaBracketPlans = {
  2: {
    main: [
      { title: "Semifinal", games: [["m1", "c1", "r2"], ["m2", "c2", "r1"]] },
      { title: "3º lugar", games: [["m3", "l:m1", "l:m2"]] },
      { title: "Final", games: [["m4", "w:m1", "w:m2"]] },
    ],
    repechage: [],
  },
  3: {
    main: [
      { title: "Quartas de final", games: [["m1", "r2", "r3"], ["m2", "r1", "c3"]] },
      { title: "Semifinal", games: [["m3", "c1", "w:m1"], ["m4", "c2", "w:m2"]] },
      { title: "3º lugar", games: [["m5", "l:m3", "l:m4"]] },
      { title: "Final", games: [["m6", "w:m3", "w:m4"]] },
    ],
    repechage: [
      { title: "Semifinal", games: [["r1", "t2", "t3"]] },
      { title: "Final", games: [["r2", "t1", "w:r1"]] },
    ],
  },
  4: {
    main: [
      { title: "Quartas de final", games: [["m1", "c1", "r3"], ["m2", "c4", "r2"], ["m3", "c3", "r1"], ["m4", "c2", "r4"]] },
      { title: "Semifinal", games: [["m5", "w:m1", "w:m2"], ["m6", "w:m3", "w:m4"]] },
      { title: "3º lugar", games: [["m7", "l:m5", "l:m6"]] },
      { title: "Final", games: [["m8", "w:m5", "w:m6"]] },
    ],
    repechage: [
      { title: "Semifinal", games: [["r1", "t1", "t4"], ["r2", "t2", "t3"]] },
      { title: "Final", games: [["r3", "w:r1", "w:r2"]] },
    ],
  },
  5: {
    main: [
      { title: "Oitavas de final", games: [["m1", "r3", "r2"], ["m2", "r4", "r5"]] },
      { title: "Quartas de final", games: [["m3", "c1", "w:m1"], ["m4", "c4", "c5"], ["m5", "c3", "r1"], ["m6", "c2", "w:m2"]] },
      { title: "Semifinal", games: [["m7", "w:m3", "w:m4"], ["m8", "w:m5", "w:m6"]] },
      { title: "3º lugar", games: [["m9", "l:m7", "l:m8"]] },
      { title: "Final", games: [["m10", "w:m7", "w:m8"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t5", "t4"]] },
      { title: "Semifinal", games: [["r2", "t1", "w:r1"], ["r3", "t2", "t3"]] },
      { title: "Final", games: [["r4", "w:r2", "w:r3"]] },
    ],
  },
  6: {
    main: [
      { title: "Oitavas de final", games: [["m1", "r2", "r6"], ["m2", "r3", "c5"], ["m3", "r1", "c6"], ["m4", "r4", "r5"]] },
      { title: "Quartas de final", games: [["m5", "c1", "w:m1"], ["m6", "c4", "w:m2"], ["m7", "c3", "w:m3"], ["m8", "c2", "w:m4"]] },
      { title: "Semifinal", games: [["m9", "w:m5", "w:m6"], ["m10", "w:m7", "w:m8"]] },
      { title: "3º lugar", games: [["m11", "l:m9", "l:m10"]] },
      { title: "Final", games: [["m12", "w:m9", "w:m10"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t4", "t6"], ["r2", "t3", "t5"]] },
      { title: "Semifinal", games: [["r3", "t1", "w:r1"], ["r4", "t2", "w:r2"]] },
      { title: "Final", games: [["r5", "w:r3", "w:r4"]] },
    ],
  },
  7: {
    main: [
      { title: "Oitavas de final", games: [["m1", "c7", "r6"], ["m2", "r3", "c5"], ["m3", "c4", "r2"], ["m4", "r5", "r4"], ["m5", "c6", "r7"], ["m6", "c3", "r1"]] },
      { title: "Quartas de final", games: [["m7", "c1", "w:m1"], ["m8", "w:m2", "w:m3"], ["m9", "w:m5", "w:m6"], ["m10", "c2", "w:m4"]] },
      { title: "Semifinal", games: [["m11", "w:m7", "w:m8"], ["m12", "w:m9", "w:m10"]] },
      { title: "3º lugar", games: [["m13", "l:m11", "l:m12"]] },
      { title: "Final", games: [["m14", "w:m11", "w:m12"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t2", "t7"], ["r2", "t3", "t6"], ["r3", "t4", "t5"]] },
      { title: "Semifinal", games: [["r4", "t1", "w:r3"], ["r5", "w:r1", "w:r2"]] },
      { title: "Final", games: [["r6", "w:r4", "w:r5"]] },
    ],
  },
  8: {
    main: [
      { title: "Oitavas de final", games: [["m1", "c1", "r8"], ["m2", "c5", "r3"], ["m3", "c7", "r2"], ["m4", "c4", "r6"], ["m5", "c3", "r5"], ["m6", "c6", "r4"], ["m7", "c8", "r1"], ["m8", "c2", "r7"]] },
      { title: "Quartas de final", games: [["m9", "w:m1", "w:m2"], ["m10", "w:m3", "w:m4"], ["m11", "w:m5", "w:m6"], ["m12", "w:m7", "w:m8"]] },
      { title: "Semifinal", games: [["m13", "w:m9", "w:m10"], ["m14", "w:m11", "w:m12"]] },
      { title: "3º lugar", games: [["m15", "l:m13", "l:m14"]] },
      { title: "Final", games: [["m16", "w:m13", "w:m14"]] },
    ],
    repechage: [
      { title: "Quartas de final", games: [["r1", "t1", "t8"], ["r2", "t2", "t7"], ["r3", "t3", "t6"], ["r4", "t4", "t5"]] },
      { title: "Semifinal", games: [["r5", "w:r1", "w:r2"], ["r6", "w:r3", "w:r4"]] },
      { title: "Final", games: [["r7", "w:r5", "w:r6"]] },
    ],
  },
  9: {
    main: [
      { title: "1ª Rodada", games: [["m1", "r8", "r6"], ["m2", "r9", "r7"]] },
      { title: "Oitavas de final", games: [["m3", "c1", "w:m1"], ["m4", "c5", "r3"], ["m5", "c7", "c9"], ["m6", "c4", "r2"], ["m7", "c2", "w:m2"], ["m8", "c8", "r4"], ["m9", "c6", "r5"], ["m10", "c3", "r1"]] },
      { title: "Quartas de final", games: [["m11", "w:m3", "w:m4"], ["m12", "w:m5", "w:m6"], ["m13", "w:m7", "w:m8"], ["m14", "w:m9", "w:m10"]] },
      { title: "Semifinal", games: [["m15", "w:m11", "w:m12"], ["m16", "w:m13", "w:m14"]] },
      { title: "3º lugar", games: [["m17", "l:m15", "l:m16"]] },
      { title: "Final", games: [["m18", "w:m15", "w:m16"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r2", "t1", "w:r1"], ["r3", "t2", "t7"], ["r4", "t3", "t6"], ["r5", "t4", "t5"]] },
      { title: "Semifinal", games: [["r6", "w:r2", "w:r3"], ["r7", "w:r4", "w:r5"]] },
      { title: "Final", games: [["r8", "w:r6", "w:r7"]] },
    ],
  },
  10: {
    main: [
      { title: "1ª Rodada", games: [["m1", "r3", "r6"], ["m2", "r8", "r10"], ["m3", "r4", "r5"], ["m4", "r7", "r9"]] },
      { title: "Oitavas de final", games: [["m5", "c1", "w:m1"], ["m6", "c5", "r2"], ["m7", "c7", "c9"], ["m8", "c4", "w:m2"], ["m9", "c3", "w:m3"], ["m10", "r1", "c6"], ["m11", "c8", "c10"], ["m12", "c2", "w:m4"]] },
      { title: "Quartas de final", games: [["m13", "w:m5", "w:m6"], ["m14", "w:m7", "w:m8"], ["m15", "w:m9", "w:m10"], ["m16", "w:m11", "w:m12"]] },
      { title: "Semifinal", games: [["m17", "w:m13", "w:m14"], ["m18", "w:m15", "w:m16"]] },
      { title: "3º lugar", games: [["m19", "l:m17", "l:m18"]] },
      { title: "Final", games: [["m20", "w:m17", "w:m18"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t9", "t10"], ["r2", "t7", "t8"]] },
      { title: "Quartas de final", games: [["r3", "t1", "w:r1"], ["r4", "t2", "w:r2"], ["r5", "t3", "t4"], ["r6", "t5", "t6"]] },
      { title: "Semifinal", games: [["r7", "w:r3", "w:r4"], ["r8", "w:r5", "w:r6"]] },
      { title: "Final", games: [["r9", "w:r7", "w:r8"]] },
    ],
  },
  11: {
    main: [
      { title: "1ª Rodada", games: [["m1", "c11", "r10"], ["m2", "r1", "r11"], ["m3", "r2", "r9"], ["m4", "r3", "r8"], ["m5", "r4", "r7"], ["m6", "r5", "r6"]] },
      { title: "Oitavas de final", games: [["m7", "c1", "w:m1"], ["m8", "c8", "w:m2"], ["m9", "c4", "w:m3"], ["m10", "c5", "w:m4"], ["m11", "c2", "w:m5"], ["m12", "c7", "w:m6"], ["m13", "c3", "c10"], ["m14", "c6", "c9"]] },
      { title: "Quartas de final", games: [["m15", "w:m7", "w:m8"], ["m16", "w:m9", "w:m10"], ["m17", "w:m11", "w:m12"], ["m18", "w:m13", "w:m14"]] },
      { title: "Semifinal", games: [["m19", "w:m15", "w:m16"], ["m20", "w:m17", "w:m18"]] },
      { title: "3º lugar", games: [["m21", "l:m19", "l:m20"]] },
      { title: "Final", games: [["m22", "w:m19", "w:m20"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t6", "t11"], ["r2", "t7", "t10"], ["r3", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r4", "t1", "w:r1"], ["r5", "t4", "w:r2"], ["r6", "t2", "w:r3"], ["r7", "t3", "t5"]] },
      { title: "Semifinal", games: [["r8", "w:r4", "w:r5"], ["r9", "w:r6", "w:r7"]] },
      { title: "Final", games: [["r10", "w:r8", "w:r9"]] },
    ],
  },
  12: {
    main: [
      { title: "1ª Rodada", games: [["m1", "c9", "r12"], ["m2", "c10", "r11"], ["m3", "c11", "r10"], ["m4", "c12", "r9"], ["m5", "r1", "r8"], ["m6", "r2", "r7"], ["m7", "r3", "r6"], ["m8", "r4", "r5"]] },
      { title: "Oitavas de final", games: [["m9", "c1", "w:m1"], ["m10", "c8", "w:m2"], ["m11", "c4", "w:m3"], ["m12", "c5", "w:m4"], ["m13", "c2", "w:m5"], ["m14", "c3", "w:m6"], ["m15", "c7", "w:m7"], ["m16", "c6", "w:m8"]] },
      { title: "Quartas de final", games: [["m17", "w:m9", "w:m10"], ["m18", "w:m11", "w:m12"], ["m19", "w:m13", "w:m14"], ["m20", "w:m15", "w:m16"]] },
      { title: "Semifinal", games: [["m21", "w:m17", "w:m18"], ["m22", "w:m19", "w:m20"]] },
      { title: "3º lugar", games: [["m23", "l:m21", "l:m22"]] },
      { title: "Final", games: [["m24", "w:m21", "w:m22"]] },
    ],
    repechage: [
      { title: "1ª Rodada", games: [["r1", "t5", "t12"], ["r2", "t6", "t11"], ["r3", "t7", "t10"], ["r4", "t8", "t9"]] },
      { title: "Quartas de final", games: [["r5", "t1", "w:r1"], ["r6", "t4", "w:r2"], ["r7", "t2", "w:r3"], ["r8", "t3", "w:r4"]] },
      { title: "Semifinal", games: [["r9", "w:r5", "w:r6"], ["r10", "w:r7", "w:r8"]] },
      { title: "Final", games: [["r11", "w:r9", "w:r10"]] },
    ],
  },
};

export const cearenseMainBracketPlans = {
  2: copinhaBracketPlans[2].main,
  3: copinhaBracketPlans[3].main,
  4: copinhaBracketPlans[4].main,
  5: copinhaBracketPlans[5].main,
  6: copinhaBracketPlans[6].main,
  7: copinhaBracketPlans[7].main,
  8: copinhaBracketPlans[8].main,
  9: copinhaBracketPlans[9].main,
  10: [
    { title: "1ª Rodada", games: [["m1", "r8", "r10"], ["m2", "r3", "r6"], ["m3", "r4", "r5"], ["m4", "r7", "r9"]] },
    { title: "Oitavas de final", games: [["m5", "c1", "w:m1"], ["m6", "r2", "c5"], ["m7", "c7", "c9"], ["m8", "w:m2", "c4"], ["m9", "c3", "w:m3"], ["m10", "r1", "c6"], ["m11", "c8", "c10"], ["m12", "w:m4", "c2"]] },
    { title: "Quartas de final", games: [["m13", "w:m5", "w:m6"], ["m14", "w:m7", "w:m8"], ["m15", "w:m9", "w:m10"], ["m16", "w:m11", "w:m12"]] },
    { title: "Semifinal", games: [["m17", "w:m13", "w:m14"], ["m18", "w:m15", "w:m16"]] },
    { title: "3º lugar", games: [["m19", "l:m17", "l:m18"]] },
    { title: "Final", games: [["m20", "w:m17", "w:m18"]] },
  ],
};
