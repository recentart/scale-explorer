// Side-view silhouettes (everyday). Each shape is drawn in its own unit box:
// x runs 0..w left to right, y runs 0..h top to bottom, and the object rests on the ground at y = h.
// refX / refY: unit length of the measured extent (x from 0, y from the ground); default w / h.
export const SHAPES = {
  // One grain of long rice lying on its side (about 7 x 2 mm). refX = full length.
  'grain-of-rice': {
    w: 140, h: 40,
    refX: 140,
    layers: [
      { d: 'M0 21 C0 9 24 0 66 0 C104 0 140 8 140 20 C140 32 106 40 70 40 C28 40 0 33 0 21 Z', fill: '#d4c8a4' },
      { d: 'M2 27 C6 33 12 35 16 31 C14 27 8 25 2 27 Z', fill: '#b5a57a' },
      { d: 'M26 11 C52 5 96 5 124 13 C98 10 54 10 26 15 Z', fill: '#f1ecdc', opacity: 0.9 },
      { d: 'M20 25 C54 22 100 22 132 25 C100 24.5 54 24.5 20 26.5 Z', fill: '#bfb189' },
    ],
  },

  // Penny standing on its edge, face-on (19.05 mm across). refX = diameter.
  'us-penny': {
    w: 100, h: 100,
    refX: 100,
    layers: [
      { d: 'M0 50 A50 50 0 1 1 100 50 A50 50 0 1 1 0 50 Z', fill: '#b8733d' },
      { d: 'M0 50 A50 50 0 1 1 100 50 A50 50 0 1 1 0 50 Z M5 50 A45 45 0 1 0 95 50 A45 45 0 1 0 5 50 Z', fill: '#96592b', rule: 'evenodd' },
      { d: 'M37 83 C37 73 39 67 43 63 C37 58 33 50 34 40 C35 28 43 20 53 20 C61 20 67 25 68 32 L69 38 L72 44 L69 46 L69.5 49 L68.5 51 C69 55 67 58 63 60 C61 62 61 64 63 66 C67 70 71 76 71 83 Z', fill: '#9c5f30', opacity: 0.65 },
      { d: 'M14 64 H20 V67 H14 Z M80 64 H86 V67 H80 Z M40 12 H60 V14 H40 Z', fill: '#96592b' },
      { d: 'M20 22 A40 40 0 0 1 44 11 L45 13 A38 38 0 0 0 22 24 Z', fill: '#dca06c', opacity: 0.7 },
    ],
  },

  // Bank card standing on its long edge, face-on (85.6 x 54 mm). refX = long side.
  'credit-card': {
    w: 214, h: 135,
    refX: 214,
    layers: [
      { d: 'M8 0 H206 A8 8 0 0 1 214 8 V127 A8 8 0 0 1 206 135 H8 A8 8 0 0 1 0 127 V8 A8 8 0 0 1 8 0 Z', fill: '#3d6db0' },
      { d: 'M122 0 H172 L112 135 H62 Z', fill: '#4f80c4' },
      { d: 'M28 42 H56 A4 4 0 0 1 60 46 V68 A4 4 0 0 1 56 72 H28 A4 4 0 0 1 24 68 V46 A4 4 0 0 1 28 42 Z', fill: '#d9b45a' },
      { d: 'M24 52 H36 V53.5 H24 Z M48 52 H60 V53.5 H48 Z M24 61 H36 V62.5 H24 Z M48 61 H60 V62.5 H48 Z M36 46 H48 V68 H36 Z M37.5 47.5 V66.5 H46.5 V47.5 Z', fill: '#a8853a', rule: 'evenodd' },
      { d: 'M24 90 H56 V97 H24 Z M64 90 H96 V97 H64 Z M104 90 H136 V97 H104 Z M144 90 H176 V97 H144 Z M24 110 H96 V114 H24 Z', fill: '#e6ecf5', opacity: 0.85 },
      { d: 'M167 115 A11 11 0 1 1 189 115 A11 11 0 1 1 167 115 Z', fill: '#e0a33a' },
    ],
  },

  // One-dollar bill standing on its long edge, face-on (156 x 66 mm). refX = length.
  'dollar-bill': {
    w: 312, h: 133,
    refX: 312,
    layers: [
      { d: 'M0 0 H312 V133 H0 Z', fill: '#7f9a74' },
      { d: 'M8 8 H304 V125 H8 Z', fill: '#a4b898' },
      { d: 'M126 66.5 A30 40 0 1 1 186 66.5 A30 40 0 1 1 126 66.5 Z', fill: '#6b8660' },
      { d: 'M131 66.5 A25 35 0 1 1 181 66.5 A25 35 0 1 1 131 66.5 Z', fill: '#90a984' },
      { d: 'M143 101 C143 91 146 86 150 83 C144 79 141 71 142 62 C143 51 149 44 157 44 C164 44 169 49 170 55 L171 60 L174 65 L171 67 L171 72 C171 76 168 79 165 80 C167 85 172 90 173 97 Z', fill: '#5c7753' },
      { d: 'M16 26 A11 11 0 1 1 38 26 A11 11 0 1 1 16 26 Z M274 26 A11 11 0 1 1 296 26 A11 11 0 1 1 274 26 Z M16 107 A11 11 0 1 1 38 107 A11 11 0 1 1 16 107 Z M274 107 A11 11 0 1 1 296 107 A11 11 0 1 1 274 107 Z M66 76 A15 15 0 1 1 96 76 A15 15 0 1 1 66 76 Z M216 76 A15 15 0 1 1 246 76 A15 15 0 1 1 216 76 Z M60 30 H106 V35 H60 Z M206 30 H252 V35 H206 Z', fill: '#5c7753' },
    ],
  },

  // A4 sheet standing upright, face-on (210 x 297 mm), top-right corner folded over. refY = height.
  'a4-paper': {
    w: 210, h: 297,
    refY: 297,
    layers: [
      { d: 'M0 0 H186 L210 24 V297 H0 Z', fill: '#d8d3c4' },
      { d: 'M186 0 V24 H210 Z', fill: '#b3ac98' },
      { d: 'M24 30 H130 V38 H24 Z M24 62 H150 V65 H24 Z M24 75 H186 V78 H24 Z M24 88 H172 V91 H24 Z M24 101 H186 V104 H24 Z M24 114 H160 V117 H24 Z M24 127 H186 V130 H24 Z M24 140 H186 V143 H24 Z M24 153 H120 V156 H24 Z M24 176 H186 V179 H24 Z M24 189 H178 V192 H24 Z M24 202 H186 V205 H24 Z M24 215 H186 V218 H24 Z M24 228 H140 V231 H24 Z M24 241 H186 V244 H24 Z M24 254 H170 V257 H24 Z M24 267 H186 V270 H24 Z M24 280 H102 V283 H24 Z', fill: '#a39c89' },
    ],
  },

  // AA cell standing upright, positive nub on top (50.5 x 14.5 mm). refY = height with the nub.
  'aa-battery': {
    w: 58, h: 202,
    refY: 202,
    layers: [
      { d: 'M20 0 H38 Q40 0 40 2 V4 H54 Q58 4 58 8 V198 Q58 202 54 202 H4 Q0 202 0 198 V8 Q0 4 4 4 H18 V2 Q18 0 20 0 Z', fill: '#4f586c' },
      { d: 'M4 4 H54 Q58 4 58 8 V64 H0 V8 Q0 4 4 4 Z', fill: '#c9822c' },
      { d: 'M20 0 H38 Q40 0 40 2 V4 H54 Q58 4 58 8 V9 H0 V8 Q0 4 4 4 H18 V2 Q18 0 20 0 Z M0 196 H58 V198 Q58 202 54 202 H4 Q0 202 0 198 Z', fill: '#aab0ba' },
      { d: 'M26 22 H32 V29 H39 V35 H32 V42 H26 V35 H19 V29 H26 Z', fill: '#f2e8d4' },
      { d: 'M7 12 H12 V192 H7 Z', fill: '#e8ecf2', opacity: 0.22 },
    ],
  },

  // Hexagonal yellow pencil lying down, eraser left, sharpened tip right (190 x 7 mm). refX = length.
  'pencil': {
    w: 380, h: 14,
    refX: 380,
    layers: [
      { d: 'M3 0 H342 L372 5.2 L380 7 L372 8.8 L342 14 H3 Q0 14 0 11 V3 Q0 0 3 0 Z', fill: '#dcb47e' },
      { d: 'M38 0 H342 L345 0.5 Q348.5 7 345 13.5 L342 14 H38 Z', fill: '#e6b422' },
      { d: 'M38 4.3 H343.5 V5.1 H38 Z M38 8.9 H343.5 V9.7 H38 Z', fill: '#c4941a' },
      { d: 'M3 0 H20 V14 H3 Q0 14 0 11 V3 Q0 0 3 0 Z', fill: '#e58f96' },
      { d: 'M20 0 H38 V14 H20 Z', fill: '#b4b9c1' },
      { d: 'M372 5.2 L380 7 L372 8.8 Z M24 0 H25.5 V14 H24 Z M32.5 0 H34 V14 H32.5 Z', fill: '#565c68' },
    ],
  },

  // Smartphone standing upright, face-on (about 147 x 71.5 mm). refY = height.
  'smartphone': {
    w: 143, h: 294,
    refY: 294,
    layers: [
      { d: 'M22 0 H121 A22 22 0 0 1 143 22 V272 A22 22 0 0 1 121 294 H22 A22 22 0 0 1 0 272 V22 A22 22 0 0 1 22 0 Z', fill: '#747e91' },
      { d: 'M22 6 H121 A16 16 0 0 1 137 22 V272 A16 16 0 0 1 121 288 H22 A16 16 0 0 1 6 272 V22 A16 16 0 0 1 22 6 Z', fill: '#262c38' },
      { d: 'M60 13 H83 A5 5 0 0 1 83 23 H60 A5 5 0 0 1 60 13 Z', fill: '#454d5e' },
      { d: 'M86 6 H121 A16 16 0 0 1 137 22 V40 L40 288 H6 V272 Z', fill: '#3a4252', opacity: 0.45 },
      { d: 'M52 277 H91 A1.5 1.5 0 0 1 91 280 H52 A1.5 1.5 0 0 1 52 277 Z', fill: '#9aa3b4' },
    ],
  },

  // 12 oz (355 ml) drinks can standing upright, side view (122 x 66 mm). refY = height.
  'soda-can': {
    w: 132, h: 244,
    refY: 244,
    layers: [
      { d: 'M14 0 H118 Q120 0 120 2 V4 C124 8 132 16 132 26 V226 C132 234 124 240 116 244 H16 C8 240 0 234 0 226 V26 C0 16 8 8 12 4 V2 Q12 0 14 0 Z', fill: '#a9afb8' },
      { d: 'M0 30 H132 V222 H0 Z', fill: '#c43d3a' },
      { d: 'M0 118 C34 96 70 150 132 108 V122 C70 164 34 110 0 132 Z', fill: '#f1e6e2' },
      { d: 'M12 3 H120 V5.5 H12 Z M0 222 H132 V225 H0 Z', fill: '#878d98' },
      { d: 'M16 30 H25 V222 H16 Z', fill: '#f0b4ae', opacity: 0.35 },
    ],
  },

  // 40 ft ISO container, long side (12.19 x 2.59 m), corrugated steel. refX = length.
  'shipping-container': {
    w: 376, h: 80,
    refX: 376,
    layers: [
      { d: 'M0 0 H376 V80 H0 Z', fill: '#a8492f' },
      { d: 'M9 5 H13 V74 H9 Z M17 5 H21 V74 H17 Z M25 5 H29 V74 H25 Z M33 5 H37 V74 H33 Z M41 5 H45 V74 H41 Z M49 5 H53 V74 H49 Z M57 5 H61 V74 H57 Z M65 5 H69 V74 H65 Z M73 5 H77 V74 H73 Z M81 5 H85 V74 H81 Z M89 5 H93 V74 H89 Z M97 5 H101 V74 H97 Z M105 5 H109 V74 H105 Z M113 5 H117 V74 H113 Z M121 5 H125 V74 H121 Z M129 5 H133 V74 H129 Z M137 5 H141 V74 H137 Z M145 5 H149 V74 H145 Z M153 5 H157 V74 H153 Z M161 5 H165 V74 H161 Z M169 5 H173 V74 H169 Z M177 5 H181 V74 H177 Z M185 5 H189 V74 H185 Z M193 5 H197 V74 H193 Z M201 5 H205 V74 H201 Z M209 5 H213 V74 H209 Z M217 5 H221 V74 H217 Z M225 5 H229 V74 H225 Z M233 5 H237 V74 H233 Z M241 5 H245 V74 H241 Z M249 5 H253 V74 H249 Z M257 5 H261 V74 H257 Z M265 5 H269 V74 H265 Z M273 5 H277 V74 H273 Z M281 5 H285 V74 H281 Z M289 5 H293 V74 H289 Z M297 5 H301 V74 H297 Z M305 5 H309 V74 H305 Z M313 5 H317 V74 H313 Z M321 5 H325 V74 H321 Z M329 5 H333 V74 H329 Z M337 5 H341 V74 H337 Z M345 5 H349 V74 H345 Z M353 5 H357 V74 H353 Z M361 5 H365 V74 H361 Z', fill: '#8f3c26' },
      { d: 'M13 5 H14 V74 H13 Z M21 5 H22 V74 H21 Z M29 5 H30 V74 H29 Z M37 5 H38 V74 H37 Z M45 5 H46 V74 H45 Z M53 5 H54 V74 H53 Z M61 5 H62 V74 H61 Z M69 5 H70 V74 H69 Z M77 5 H78 V74 H77 Z M85 5 H86 V74 H85 Z M93 5 H94 V74 H93 Z M101 5 H102 V74 H101 Z M109 5 H110 V74 H109 Z M117 5 H118 V74 H117 Z M125 5 H126 V74 H125 Z M133 5 H134 V74 H133 Z M141 5 H142 V74 H141 Z M149 5 H150 V74 H149 Z M157 5 H158 V74 H157 Z M165 5 H166 V74 H165 Z M173 5 H174 V74 H173 Z M181 5 H182 V74 H181 Z M189 5 H190 V74 H189 Z M197 5 H198 V74 H197 Z M205 5 H206 V74 H205 Z M213 5 H214 V74 H213 Z M221 5 H222 V74 H221 Z M229 5 H230 V74 H229 Z M237 5 H238 V74 H237 Z M245 5 H246 V74 H245 Z M253 5 H254 V74 H253 Z M261 5 H262 V74 H261 Z M269 5 H270 V74 H269 Z M277 5 H278 V74 H277 Z M285 5 H286 V74 H285 Z M293 5 H294 V74 H293 Z M301 5 H302 V74 H301 Z M309 5 H310 V74 H309 Z M317 5 H318 V74 H317 Z M325 5 H326 V74 H325 Z M333 5 H334 V74 H333 Z M341 5 H342 V74 H341 Z M349 5 H350 V74 H349 Z M357 5 H358 V74 H357 Z M365 5 H366 V74 H365 Z', fill: '#c0624a' },
      { d: 'M0 0 H376 V5 H0 Z M0 74 H376 V80 H0 Z M0 0 H6 V80 H0 Z M370 0 H376 V80 H370 Z', fill: '#7c3321' },
      { d: 'M0 0 H10 V7 H0 Z M366 0 H376 V7 H366 Z M0 73 H10 V80 H0 Z M366 73 H376 V80 H366 Z', fill: '#4f2519' },
    ],
  },
}
