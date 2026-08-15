import sharp from "sharp";

export const guestSelectionLandmarks = Object.freeze({
  crown: 12,
  chin: 96,
  shoulder: 110,
  waist: 158,
  pelvis: 184,
  knee: 224,
  foot: 264
});

export const guestSelectionDirections = Object.freeze(["down", "left", "right", "up"]);
export const guestSelectionSteps = Object.freeze([-1, 0, 1]);

const outline = "#493a38";
const skin = "#f8d8c8";
const skinShade = "#eab8a3";
const ivory = "#fffaf2";
const white = "#ffffff";

function shade(hex, amount) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255]
    .map((channel) => Math.max(0, Math.min(255, channel + amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export const guestSelectionVectorConfigs = Object.freeze({
  "guest-01": {
    hair: "long-wave", hairColor: "#5b382d", hairShade: "#3d241e",
    outfit: "dress", top: "#fff9f2", bottom: "#e9bfc2", accent: "#b7957d",
    accessory: "handbag", accessoryColor: "#b9906d"
  },
  "guest-02": {
    hair: "updo", hairColor: "#4e3028", hairShade: "#341f1b",
    outfit: "hanbok-f", top: "#fff9ee", bottom: "#c96f7d", accent: "#b68b5d",
    accessory: "norigae", accessoryColor: "#c39a52"
  },
  "guest-03": {
    hair: "male-part", hairColor: "#171b25", hairShade: "#0b0e15",
    outfit: "suit", top: "#172d56", bottom: "#172d56", accent: "#243f73",
    shirt: white, tie: "#122142"
  },
  "guest-04": {
    hair: "male-wave", hairColor: "#563523", hairShade: "#362116",
    outfit: "open-suit", top: "#28292d", bottom: "#28292d", accent: "#111216",
    shirt: "#15161a"
  },
  "guest-05": {
    hair: "updo", hairColor: "#604338", hairShade: "#3e2b25",
    outfit: "dress", top: "#f8f2e8", bottom: "#91a48d", accent: "#71836d",
    accessory: "handbag", accessoryColor: "#c6a983"
  },
  "guest-06": {
    hair: "long-wave", hairColor: "#765341", hairShade: "#4e362d",
    outfit: "blouse-skirt", top: "#fffaf0", bottom: "#233b69", accent: "#d6b06d",
    accessory: "crossbody", accessoryColor: "#c7a276"
  },
  "guest-07": {
    hair: "long-wave", hairColor: "#704a37", hairShade: "#482e24",
    outfit: "dress", top: "#f8f3ee", bottom: "#bca5df", accent: "#9f86c7",
    accessory: "clutch", accessoryColor: "#c8c4c2"
  },
  "guest-08": {
    hair: "long-wave", hairColor: "#70422f", hairShade: "#48291f",
    outfit: "wrap-dress", top: "#bd7781", bottom: "#bd7781", accent: "#965962",
    accessory: "handbag", accessoryColor: "#9e826d"
  },
  "guest-09": {
    hair: "male-part", hairColor: "#5a3826", hairShade: "#382219",
    outfit: "suit", top: "#cbb89f", bottom: "#cbb89f", accent: "#a99478",
    shirt: white, tie: null, boutonniere: true
  },
  "guest-10": {
    hair: "bob", hairColor: "#17191f", hairShade: "#090b10",
    outfit: "wrap-dress", top: "#182b50", bottom: "#182b50", accent: "#a9a2b0",
    accessory: "clutch", accessoryColor: "#16171a"
  },
  "guest-11": {
    hair: "male-wave", hairColor: "#171b22", hairShade: "#090b10",
    outfit: "open-suit", top: "#16402f", bottom: "#e7dfcf", accent: "#b58a57",
    shirt: "#fff8e9"
  },
  "guest-12": {
    hair: "male-part", hairColor: "#171b24", hairShade: "#090b11",
    outfit: "hanbok-m", top: "#27436f", bottom: "#5e6780", accent: "#d8dde5",
    shirt: "#fffaf0", accessory: "norigae", accessoryColor: "#d2d7df"
  }
});

function mirrorTransform(direction) {
  return direction === "right" ? "translate(192 0) scale(-1 1)" : "";
}

function hairBack(config, direction) {
  const fill = "url(#hairPaint)";
  const shade = config.hairShade;
  if (config.hair === "long-wave") {
    if (direction === "left" || direction === "right") {
      return `<g transform="${mirrorTransform(direction)}">
        <path d="M61 33Q65 7 100 8Q137 9 141 42L139 124Q130 145 109 151L96 139Q80 151 64 137Q54 120 57 87Z" fill="${shade}" stroke="${outline}" stroke-width="2"/>
        <path d="M73 54Q61 78 72 106Q60 123 72 143M91 48Q81 76 91 104Q77 124 91 143M112 49Q100 78 112 107Q99 128 110 146" fill="none" stroke="${fill}" stroke-width="7" stroke-linecap="round" opacity=".92"/>
      </g>`;
    }
    return `<g>
      <path d="M47 38Q49 7 96 7Q143 8 145 38L143 126Q137 150 119 151Q105 145 96 153Q86 145 72 151Q53 146 49 126Z" fill="${shade}" stroke="${outline}" stroke-width="2"/>
      <path d="M59 48Q48 76 61 101Q49 124 63 144M78 42Q68 71 80 102Q68 125 78 147M114 42Q125 70 113 102Q126 124 114 147M133 48Q144 76 131 101Q143 124 129 144" fill="none" stroke="${fill}" stroke-width="8" stroke-linecap="round" opacity=".94"/>
    </g>`;
  }
  if (config.hair === "updo") {
    if (direction === "left" || direction === "right") {
      return `<g transform="${mirrorTransform(direction)}">
        <ellipse cx="119" cy="74" rx="28" ry="31" fill="${shade}" stroke="${outline}" stroke-width="2"/>
        <circle cx="132" cy="91" r="23" fill="${fill}" stroke="${outline}" stroke-width="2"/>
      </g>`;
    }
    return `<g><circle cx="96" cy="88" r="30" fill="${shade}" stroke="${outline}" stroke-width="2"/>
      <ellipse cx="96" cy="103" rx="32" ry="24" fill="${fill}" stroke="${outline}" stroke-width="2"/></g>`;
  }
  if (config.hair === "bob") {
    if (direction === "left" || direction === "right") {
      return `<g transform="${mirrorTransform(direction)}"><path d="M58 46Q59 8 99 8Q139 11 140 54L132 111Q111 124 70 110Q55 84 58 46Z" fill="${shade}" stroke="${outline}" stroke-width="2"/></g>`;
    }
    return `<path d="M48 44Q51 7 96 7Q141 7 144 44L137 111Q117 124 96 116Q75 124 55 111Z" fill="${shade}" stroke="${outline}" stroke-width="2"/>`;
  }
  return "";
}

function headAndFace(config, direction) {
  const side = direction === "left" || direction === "right";
  const back = direction === "up";
  const transform = side ? mirrorTransform(direction) : "";
  const head = side
    ? `<g transform="${transform}"><path d="M62 48Q62 12 98 12Q128 12 134 43L141 67L133 76Q128 91 108 96H91Q67 93 61 69Z" fill="url(#skinPaint)" stroke="${outline}" stroke-width="1.8"/></g>`
    : `<path d="M52 50Q52 12 96 12Q140 12 140 50Q140 78 120 91Q109 96 96 96Q83 96 72 91Q52 78 52 50Z" fill="url(#skinPaint)" stroke="${outline}" stroke-width="1.8"/>`;
  if (back) return `${head}${hairFront(config, direction)}`;
  if (side) {
    return `${head}${hairFront(config, direction)}<g transform="${transform}">
      <path d="M103 45Q112 40 120 46" fill="none" stroke="${config.hairShade}" stroke-width="2"/>
      <ellipse cx="113" cy="58" rx="8" ry="11" fill="#3b2a27"/><ellipse cx="115" cy="54" rx="2.5" ry="3.5" fill="${white}"/>
      <path d="M106 47Q116 42 123 50" fill="none" stroke="#2c2222" stroke-width="2"/>
      <path d="M137 68L143 72L137 76" fill="${skin}" stroke="${outline}" stroke-width="1.4"/>
      <path d="M119 83Q125 87 131 82" fill="none" stroke="#b96e6c" stroke-width="1.5"/>
      <ellipse cx="123" cy="75" rx="7" ry="3.5" fill="#edb3b3" opacity=".55"/>
    </g>`;
  }
  const feminine = !["suit", "open-suit", "hanbok-m"].includes(config.outfit);
  return `${head}${hairFront(config, direction)}<g>
    <path d="M68 45Q79 39 88 46M104 46Q113 39 124 45" fill="none" stroke="${config.hairShade}" stroke-width="2"/>
    <ellipse cx="78" cy="59" rx="9" ry="12" fill="#352726"/><ellipse cx="114" cy="59" rx="9" ry="12" fill="#352726"/>
    <ellipse cx="80" cy="54" rx="3" ry="4" fill="${white}"/><ellipse cx="116" cy="54" rx="3" ry="4" fill="${white}"/>
    <circle cx="76" cy="63" r="2" fill="#8a5744"/><circle cx="112" cy="63" r="2" fill="#8a5744"/>
    <path d="M69 49Q78 43 87 50M105 50Q114 43 123 49" fill="none" stroke="#251e20" stroke-width="2.2"/>
    <path d="M94 69L92 75L97 75" fill="none" stroke="#d39787" stroke-width="1.2"/>
    <path d="M87 82Q96 89 105 82" fill="none" stroke="#b96e6c" stroke-width="1.7"/>
    <ellipse cx="69" cy="75" rx="8" ry="4" fill="#edb3b3" opacity=".55"/><ellipse cx="123" cy="75" rx="8" ry="4" fill="#edb3b3" opacity=".55"/>
    ${feminine ? `<circle cx="54" cy="74" r="3" fill="#f0e6d9" stroke="#a98e77" stroke-width="1"/><circle cx="138" cy="74" r="3" fill="#f0e6d9" stroke="#a98e77" stroke-width="1"/>` : ""}
  </g>`;
}

function hairFront(config, direction) {
  const fill = "url(#hairPaint)";
  const shade = config.hairShade;
  const side = direction === "left" || direction === "right";
  const transform = side ? mirrorTransform(direction) : "";
  if (direction === "up") {
    if (config.hair === "long-wave") return `<path d="M51 50Q49 8 96 7Q143 8 141 50Q128 78 96 86Q64 78 51 50Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
    if (config.hair === "updo") return `<path d="M52 52Q51 8 96 8Q141 8 140 52Q125 79 96 84Q67 79 52 52Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
    if (config.hair === "bob") return `<path d="M48 53Q50 7 96 7Q142 7 144 53Q130 91 96 105Q62 91 48 53Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
    return `<path d="M51 51Q52 7 96 7Q140 7 141 51Q127 78 96 88Q65 78 51 51Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
  }
  if (side) {
    return `<g transform="${transform}"><path d="M61 53Q60 9 99 7Q134 9 137 44Q125 30 105 28Q94 46 65 53Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>
      <path d="M72 32Q92 18 117 23" fill="none" stroke="${shade}" stroke-width="3" opacity=".7"/><path d="M78 22Q98 10 121 22" fill="none" stroke="#ffffff" stroke-width="2" opacity=".16"/></g>`;
  }
  if (config.hair === "male-wave") {
    return `<path d="M51 49Q48 25 61 13Q70 5 80 13Q91 1 101 12Q116 2 122 16Q141 12 141 34Q147 49 137 57Q126 38 110 35Q96 43 81 34Q67 43 55 57Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>
      <path d="M61 25Q73 16 82 24M88 20Q98 11 108 21M113 23Q124 14 134 27" fill="none" stroke="${shade}" stroke-width="3" opacity=".75"/>`;
  }
  if (config.hair === "male-part") {
    return `<path d="M51 52Q49 9 89 7Q119 3 138 26Q145 43 137 57Q123 34 102 31L94 48L86 31Q68 36 55 58Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>
      <path d="M93 11Q107 16 119 31" fill="none" stroke="${shade}" stroke-width="3" opacity=".75"/>`;
  }
  if (config.hair === "bob") {
    return `<path d="M49 51Q48 8 91 7Q124 3 140 29Q146 45 137 62Q123 35 103 31Q91 48 54 61Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
  }
  return `<path d="M50 54Q49 8 92 7Q131 4 142 37Q144 52 136 61Q126 37 105 31Q95 46 82 32Q64 39 55 63Z" fill="${fill}" stroke="${outline}" stroke-width="2"/>`;
}

function legGeometry(config, direction, step) {
  const side = direction === "left" || direction === "right";
  const back = direction === "up";
  const pants = ["suit", "open-suit", "hanbok-m"].includes(config.outfit);
  const longSkirt = ["hanbok-f", "dress", "wrap-dress", "blouse-skirt"].includes(config.outfit);
  const legFill = pants ? "url(#bottomFabric)" : skin;
  const shoe = config.outfit === "hanbok-m" ? "#17191d" : pants ? "#382d28" : "#8d6d62";
  if (side) {
    const transform = mirrorTransform(direction);
    const forward = step * 9;
    if (longSkirt) {
      return `<g transform="${transform}"><path d="M86 219L84 251L${82 - forward} 258" fill="none" stroke="${skin}" stroke-width="10"/>
        <path d="M105 219L105 250L${109 + forward} 258" fill="none" stroke="${skinShade}" stroke-width="10" opacity=".8"/>
        <path d="M${72 - forward} 258Q${82 - forward} 253 ${93 - forward} 259L${92 - forward} 264H${70 - forward}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
        <path d="M${99 + forward} 258Q${109 + forward} 253 ${120 + forward} 259L${119 + forward} 264H${97 + forward}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/></g>`;
    }
    return `<g transform="${transform}">
      <path d="M83 177Q92 174 100 182L${99 + forward * .35} 222L${86 - forward} 254H${74 - forward}L84 220Z" fill="${legFill}" stroke="${outline}" stroke-width="2"/>
      <path d="M94 180Q106 176 111 185L${108 - forward * .25} 222L${109 + forward} 254H${97 + forward}L93 220Z" fill="${legFill}" stroke="${outline}" stroke-width="2" opacity=".92"/>
      <path d="M${70 - forward} 252H${86 - forward}L${97 - forward} 259L${95 - forward} 264H${68 - forward}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
      <path d="M${96 + forward} 252H${111 + forward}L${121 + forward} 259L${119 + forward} 264H${94 + forward}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
    </g>`;
  }
  const shift = step * 4;
  if (longSkirt) {
    return `<g>
      <path d="M78 219L${80 - shift} 255" stroke="${skinShade}" stroke-width="10"/><path d="M114 219L${112 + shift} 255" stroke="${skin}" stroke-width="10"/>
      <path d="M${70 - shift} 257Q${80 - shift} 251 ${91 - shift} 258L90 264H${69 - shift}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
      <path d="M${103 + shift} 258Q${112 + shift} 251 ${123 + shift} 257L123 264H102Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
    </g>`;
  }
  const wide = config.outfit === "hanbok-m";
  return `<g>
    <path d="M72 178Q84 ${wide ? 170 : 178} 94 183L${91 - shift} 224L${87 - shift} 254H${73 - shift}L72 222Z" fill="${legFill}" stroke="${outline}" stroke-width="2"/>
    <path d="M98 183Q109 ${wide ? 170 : 178} 120 178L120 222L${119 + shift} 254H${105 + shift}L101 224Z" fill="${legFill}" stroke="${outline}" stroke-width="2"/>
    <path d="M${69 - shift} 252H${88 - shift}L94 259L92 264H${68 - shift}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
    <path d="M${104 + shift} 252H${121 + shift}L127 259L126 264H${103 + shift}Z" fill="${shoe}" stroke="${outline}" stroke-width="1.5"/>
  </g>`;
}

function armGeometry(config, direction, step, layer) {
  const side = direction === "left" || direction === "right";
  const sleeve = "url(#topFabric)";
  const transform = side ? mirrorTransform(direction) : "";
  if (side) {
    const swing = step * 9;
    const far = layer === "far";
    const shoulderX = far ? 91 : 101;
    const handX = shoulderX + (far ? -swing : swing);
    return `<g transform="${transform}" opacity="${far ? .82 : 1}"><path d="M${shoulderX} 118Q${shoulderX + swing * .35} 145 ${handX} 174" fill="none" stroke="${outline}" stroke-width="17" stroke-linecap="round"/>
      <path d="M${shoulderX} 118Q${shoulderX + swing * .35} 145 ${handX} 174" fill="none" stroke="${sleeve}" stroke-width="13" stroke-linecap="round"/>
      <circle cx="${handX}" cy="178" r="7" fill="${skin}" stroke="${outline}" stroke-width="1.5"/></g>`;
  }
  const swing = step * 5;
  const left = layer === "far";
  const shoulderX = left ? 65 : 127;
  const handX = shoulderX + (left ? -swing : swing);
  return `<g><path d="M${shoulderX} 118Q${shoulderX + (left ? -2 : 2)} 145 ${handX} 174" fill="none" stroke="${outline}" stroke-width="17" stroke-linecap="round"/>
    <path d="M${shoulderX} 118Q${shoulderX + (left ? -2 : 2)} 145 ${handX} 174" fill="none" stroke="${sleeve}" stroke-width="13" stroke-linecap="round"/>
    <circle cx="${handX}" cy="178" r="7" fill="${skin}" stroke="${outline}" stroke-width="1.5"/></g>`;
}

function torso(config, direction) {
  const side = direction === "left" || direction === "right";
  const back = direction === "up";
  const transform = side ? mirrorTransform(direction) : "";
  if (side) {
    if (["suit", "open-suit"].includes(config.outfit)) return `<g transform="${transform}"><path d="M70 112Q96 103 119 115L118 184Q95 190 73 182Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/>${config.outfit === "suit" ? `<path d="M83 111L96 143L108 111" fill="${config.shirt}" stroke="${outline}" stroke-width="1.5"/>` : ""}<path d="M80 163H108" stroke="${config.accent}" stroke-width="1.3"/></g>`;
    if (config.outfit === "hanbok-m") return `<g transform="${transform}"><path d="M67 111Q95 104 122 114L121 190Q96 197 70 187Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/><path d="M81 109L99 137L115 110" fill="none" stroke="${ivory}" stroke-width="8"/></g>`;
    return `<g transform="${transform}"><path d="M72 111Q96 104 118 115L116 161Q95 166 74 160Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/><path d="M75 155Q96 162 116 155L134 237Q97 250 58 237Z" fill="url(#bottomFabric)" stroke="${outline}" stroke-width="2"/><path d="M88 162L82 233M104 162L111 233" stroke="#ffffff" stroke-width="1.2" opacity=".24"/></g>`;
  }
  if (["suit", "open-suit"].includes(config.outfit)) {
    return `<g><path d="M58 114Q96 100 134 114L128 184Q96 192 64 184Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/>
      ${back ? `<path d="M96 109V185" stroke="${config.accent}" stroke-width="1.5" opacity=".8"/>` : config.outfit === "suit" ? `<path d="M76 109L94 144L116 109" fill="${config.shirt}" stroke="${outline}" stroke-width="1.5"/><path d="M94 116L99 116L101 145L96 153L91 145Z" fill="${config.tie ?? config.accent}"/>` : `<path d="M75 111L89 147L96 119L104 147L118 111" fill="${config.shirt}" stroke="${outline}" stroke-width="1.5"/>`}
      <path d="M68 158H85M107 158H124" stroke="${config.accent}" stroke-width="2"/>
      ${config.boutonniere && !back ? `<circle cx="119" cy="129" r="5" fill="#f4efe1" stroke="#507348" stroke-width="2"/>` : ""}
    </g>`;
  }
  if (config.outfit === "hanbok-f") {
    return `<g><path d="M55 113Q96 101 137 113L132 164Q96 173 60 164Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/>
      ${back ? "" : `<path d="M67 111L98 146L124 111" fill="none" stroke="${config.accent}" stroke-width="3"/><rect x="89" y="139" width="17" height="8" rx="4" fill="${config.accent}"/>`}
      <path d="M64 157Q96 167 128 157L146 245Q96 256 46 245Z" fill="url(#bottomFabric)" stroke="${outline}" stroke-width="2"/>
      <path d="M70 178Q96 187 122 178" fill="none" stroke="#f5d1d6" stroke-width="2" opacity=".75"/>
      <path d="M83 168L76 240M109 168L116 240" stroke="#ffffff" stroke-width="1.1" opacity=".22"/>
    </g>`;
  }
  if (config.outfit === "hanbok-m") {
    return `<g><path d="M56 112Q96 102 136 112L132 190Q96 199 60 190Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/>${back ? "" : `<path d="M70 109L96 141L122 109" fill="none" stroke="${ivory}" stroke-width="8"/><rect x="84" y="145" width="24" height="9" rx="4" fill="${config.accent}"/>`}</g>`;
  }
  const bodice = `<path d="M59 112Q96 102 133 112L128 163Q96 171 64 163Z" fill="url(#topFabric)" stroke="${outline}" stroke-width="2"/>`;
  const skirt = `<path d="M65 154Q96 164 127 154L145 244Q96 255 47 244Z" fill="url(#bottomFabric)" stroke="${outline}" stroke-width="2"/><path d="M77 163L68 239M96 165V247M115 163L124 239" stroke="#ffffff" stroke-width="1.2" opacity=".23"/>`;
  if (config.outfit === "wrap-dress") return `<g>${bodice}${skirt}${back ? "" : `<path d="M66 112L104 159M126 113L86 158" stroke="${config.accent}" stroke-width="3"/><circle cx="113" cy="157" r="5" fill="${config.accent}"/>`}</g>`;
  if (config.outfit === "blouse-skirt") return `<g>${bodice}${skirt}${back ? "" : `<path d="M80 112L96 129L112 112" fill="none" stroke="${config.accent}" stroke-width="2"/><path d="M88 122L96 134L104 122" fill="${ivory}" stroke="${outline}" stroke-width="1.2"/>`}</g>`;
  return `<g>${bodice}${skirt}${back ? "" : `<path d="M70 111L96 145L122 111" fill="none" stroke="${config.accent}" stroke-width="2"/><path d="M70 157Q96 166 122 157" stroke="${config.accent}" stroke-width="5"/>`}</g>`;
}

function accessories(config, direction, step) {
  if (!config.accessory || direction === "up" && config.accessory === "clutch") return "";
  const side = direction === "left" || direction === "right";
  const transform = direction === "right" ? mirrorTransform(direction) : "";
  const sway = step * 2;
  if (config.accessory === "handbag") return `<g transform="${side ? transform : ""}"><path d="M${side ? 66 : 45} 169Q${side ? 56 : 37} 184 ${side ? 60 : 40} 202" fill="none" stroke="#9a744d" stroke-width="2"/><rect x="${side ? 50 : 31}" y="194" width="27" height="25" rx="4" fill="${config.accessoryColor}" stroke="${outline}" stroke-width="1.5"/><circle cx="${side ? 63 : 44}" cy="205" r="2" fill="#e6c56b"/></g>`;
  if (config.accessory === "crossbody") return `<g><path d="M67 113L125 201" stroke="${config.accent}" stroke-width="2"/><rect x="118" y="190" width="24" height="28" rx="5" fill="${config.accessoryColor}" stroke="${outline}" stroke-width="1.5"/></g>`;
  if (config.accessory === "clutch") return `<rect x="${direction === "left" ? 53 + sway : 31 - sway}" y="181" width="29" height="17" rx="4" fill="${config.accessoryColor}" stroke="${outline}" stroke-width="1.5"/>`;
  if (config.accessory === "norigae" && direction !== "up") return `<g><path d="M102 150V203" stroke="${config.accessoryColor}" stroke-width="2"/><circle cx="102" cy="177" r="4" fill="${config.accessoryColor}"/><path d="M97 203H107L102 216Z" fill="${config.accessoryColor}"/></g>`;
  return "";
}

function svgFrame(config, direction, step) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288" viewBox="0 0 192 288">
    <defs>
      <linearGradient id="skinPaint" x1="0" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#fff1e8"/><stop offset="1" stop-color="${skin}"/></linearGradient>
      <linearGradient id="hairPaint" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="${shade(config.hairColor, 20)}"/><stop offset=".52" stop-color="${config.hairColor}"/><stop offset="1" stop-color="${config.hairShade}"/></linearGradient>
      <linearGradient id="topFabric" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(config.top, 16)}"/><stop offset="1" stop-color="${shade(config.top, -12)}"/></linearGradient>
      <linearGradient id="bottomFabric" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(config.bottom, 14)}"/><stop offset="1" stop-color="${shade(config.bottom, -15)}"/></linearGradient>
    </defs>
    <g stroke-linecap="round" stroke-linejoin="round">
      ${hairBack(config, direction)}
      ${legGeometry(config, direction, step)}
      ${armGeometry(config, direction, step, "far")}
      ${torso(config, direction)}
      ${armGeometry(config, direction, step, "near")}
      <path d="M87 96V111H105V96" fill="${skin}" stroke="${outline}" stroke-width="1.5"/>
      ${headAndFace(config, direction)}
      ${accessories(config, direction, step)}
    </g>
  </svg>`;
}

export async function renderGuestSelectionVectorFrame(config, direction, step) {
  if (!guestSelectionDirections.includes(direction)) throw new Error(`알 수 없는 방향: ${direction}`);
  if (!guestSelectionSteps.includes(step)) throw new Error(`알 수 없는 보행 단계: ${step}`);
  return sharp(Buffer.from(svgFrame(config, direction, step)), { density: 192 })
    .resize(192, 288, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
