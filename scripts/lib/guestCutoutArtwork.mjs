const directions = ["down", "left", "right", "up"];

export const guestCutoutPartDefinitions = Object.freeze([
  { id: "shadow", bone: "shadow", role: "shadow" },
  { id: "backHair", bone: "head", role: "backHair" },
  { id: "neck", bone: "neck", role: "neck" },
  { id: "pelvis", bone: "garment", role: "pelvisOrSkirt" },
  { id: "thighLeft", bone: "thighLeft", role: "thighLeft" },
  { id: "calfLeft", bone: "calfLeft", role: "calfLeft" },
  { id: "shoeLeft", bone: "shoeLeft", role: "shoeLeft" },
  { id: "thighRight", bone: "thighRight", role: "thighRight" },
  { id: "calfRight", bone: "calfRight", role: "calfRight" },
  { id: "shoeRight", bone: "shoeRight", role: "shoeRight" },
  { id: "torso", bone: "torso", role: "torso" },
  { id: "shirtTie", bone: "torso", role: "innerTop" },
  { id: "jacket", bone: "torso", role: "jacketOrTop" },
  { id: "upperArmLeft", bone: "upperArmLeft", role: "upperArmLeft" },
  { id: "lowerArmLeft", bone: "lowerArmLeft", role: "lowerArmLeft" },
  { id: "handLeft", bone: "handLeft", role: "handLeft" },
  { id: "upperArmRight", bone: "upperArmRight", role: "upperArmRight" },
  { id: "lowerArmRight", bone: "lowerArmRight", role: "lowerArmRight" },
  { id: "handRight", bone: "handRight", role: "handRight" },
  { id: "face", bone: "head", role: "face" },
  { id: "frontHair", bone: "head", role: "frontHair" },
  { id: "pocketSquare", bone: "accessory", role: "outfitDetail" },
  { id: "accessory", bone: "accessory", role: "bagOrAccessory" }
]);

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

function gradient(id, light, mid, shade, direction = "front") {
  const coordinates = direction === "left"
    ? 'x1="1" y1="0" x2="0" y2="1"'
    : direction === "right"
      ? 'x1="0" y1="0" x2="1" y2="1"'
      : 'x1="0" y1="0" x2="1" y2="1"';
  return `<linearGradient id="${id}" ${coordinates}><stop offset="0" stop-color="${light}"/><stop offset="0.58" stop-color="${mid}"/><stop offset="1" stop-color="${shade}"/></linearGradient>`;
}

function mixHex(first, second, ratio) {
  const decode = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const firstRgb = decode(first);
  const secondRgb = decode(second);
  return `#${firstRgb.map((value, index) => Math.round(
    value * (1 - ratio) + secondRgb[index] * ratio
  ).toString(16).padStart(2, "0")).join("")}`;
}

function definitions(character) {
  const { skin, hair, outfit } = character;
  const clothLight = mixHex(outfit.primary, "#ffffff", 0.28);
  const clothSideLight = mixHex(outfit.primary, "#ffffff", 0.18);
  return [
    gradient("skin-front", skin.light, skin.mid, skin.shade),
    gradient("skin-left", skin.light, skin.mid, skin.shade, "left"),
    gradient("skin-right", skin.mid, skin.light, skin.shade, "right"),
    gradient("hair-front", hair.highlight, hair.color, "#101119"),
    gradient("hair-left", hair.highlight, hair.color, "#0d0e14", "left"),
    gradient("hair-right", hair.color, hair.highlight, "#0d0e14", "right"),
    gradient("cloth-front", clothLight, outfit.primary, outfit.shade),
    gradient("cloth-left", clothSideLight, outfit.primary, outfit.shade, "left"),
    gradient("cloth-right", outfit.shade, outfit.primary, clothSideLight, "right"),
    gradient("inner-cloth", "#fffdf6", outfit.secondary, outfit.shade),
    gradient("shoe", outfit.shoe, outfit.shoe, "#17161b")
  ].join("\n");
}

function isLongGarment(kind) {
  return ["dress", "wrapDress", "skirt", "femaleHanbok", "maleHanbok"].includes(kind);
}

function hairBack(character, direction) {
  const style = character.hair.style;
  const fill = `url(#hair-${direction === "down" || direction === "up" ? "front" : direction})`;
  const stroke = "#29283a";
  if (direction === "down") {
    if (style === "longWave") return `<path d="M66 56C64 30 76 13 96 13c22 0 33 18 31 44l2 60c-5 12-13 19-24 21l-9-32-9 32c-12-3-20-11-24-22Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M71 57c-5 22 0 45 13 60m37-60c5 22 0 45-12 60" fill="none" stroke="${character.hair.highlight}" stroke-width="2.2" opacity=".35"/>`;
    if (style === "updo") return `<ellipse cx="96" cy="22" rx="15" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M67 57C66 29 77 13 96 13c20 0 31 17 29 43l-4 35c-7 7-16 10-25 10s-19-4-25-11Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    if (style === "bob") return `<path d="M66 55C65 29 76 13 96 13c21 0 32 17 30 43l-3 43c-8 8-18 11-28 10-11 0-20-4-27-12Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    if (style === "mediumPart") return `<path d="M66 56C65 29 76 13 96 13c21 0 32 18 29 44l-3 43c-8 6-17 9-26 8-10 0-19-4-26-12Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    return `<path d="M67 55C66 29 77 13 97 13c22 0 31 17 29 43l-3 23c-7 7-17 10-27 10s-19-3-26-10Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  }
  if (direction === "left") {
    if (style === "longWave") return `<path d="M69 57C67 31 78 13 99 13c19 0 30 16 29 42l-3 67c-8 12-20 18-33 14-13-5-21-30-23-79Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M82 27c12-9 27-7 38 2M77 67c0 28 7 49 20 62" fill="none" stroke="${character.hair.highlight}" stroke-width="2" opacity=".34"/>`;
    if (style === "updo") return `<ellipse cx="106" cy="22" rx="14" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M72 57C70 30 81 13 100 13c20 0 29 16 28 40l-4 40c-10 9-21 10-32 4-12-7-18-20-20-40Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    if (style === "bob" || style === "mediumPart") return `<path d="M70 57C68 30 79 13 99 13c20 0 30 16 29 42l-4 48c-10 10-22 11-34 4-12-8-18-24-20-50Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    return `<path d="M73 56c-2-25 8-42 27-43 19-1 29 14 28 39l-3 27c-8 9-19 11-31 7-11-4-18-14-21-30Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  }
  if (direction === "right") {
    if (style === "longWave") return `<path d="M64 55C63 30 74 14 93 13c21 0 32 18 30 44-2 49-10 74-23 79-13 4-25-2-33-14Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M72 30c11-9 26-11 38-3m5 40c0 28-7 49-20 62" fill="none" stroke="${character.hair.highlight}" stroke-width="2" opacity=".34"/>`;
    if (style === "updo") return `<ellipse cx="86" cy="22" rx="14" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M64 53C63 29 72 13 92 13c19 0 30 17 28 44-2 20-8 33-20 40-11 6-22 5-32-4Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    if (style === "bob" || style === "mediumPart") return `<path d="M64 55C63 29 73 13 93 13c20 0 31 17 29 44-2 26-8 42-20 50-12 7-24 6-34-4Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
    return `<path d="M64 52c-1-25 9-40 28-39 19 1 29 18 27 43-3 16-10 26-21 30-12 4-23 2-31-7Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  }
  if (style === "longWave") return `<path d="M65 55C65 29 76 13 96 13s31 16 31 42l3 69c-9 12-20 17-34 17s-26-5-34-17Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><path d="M76 25c12-8 29-8 41 0M71 65c1 30 8 52 20 68m30-68c-1 30-8 52-20 68" fill="none" stroke="${character.hair.highlight}" stroke-width="2.2" opacity=".32"/>`;
  if (style === "updo") return `<ellipse cx="96" cy="22" rx="16" ry="9" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M66 56C65 29 76 13 96 13s31 17 30 43l-4 39c-8 7-17 10-26 10s-19-3-26-10Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  if (style === "bob" || style === "mediumPart") return `<path d="M66 56C65 29 76 13 96 13s31 17 30 43l-3 48c-8 8-17 11-27 11s-20-3-27-11Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
  return `<path d="M67 55C66 29 77 13 96 13s30 16 29 42l-3 27c-7 7-16 10-26 10s-19-3-26-10Z" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>`;
}

function face(character, direction) {
  const fill = `url(#skin-${direction === "down" ? "front" : direction === "up" ? "front" : direction})`;
  const stroke = "#6e4b49";
  if (direction === "up") return "";
  if (direction === "down") return `<ellipse cx="69" cy="65" rx="5" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><ellipse cx="123" cy="65" rx="5" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><path d="M72 45c3-17 13-24 24-24s22 8 24 24v21c0 18-11 30-24 30S72 84 72 66Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M79 61c4-3 9-3 13 0m8 0c4-3 9-3 13 0" fill="none" stroke="#3d2c31" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="86" cy="65" rx="3" ry="4.4" fill="#292737"/><ellipse cx="106" cy="65" rx="3" ry="4.4" fill="#292737"/><circle cx="85" cy="64" r=".8" fill="#fff"/><circle cx="105" cy="64" r=".8" fill="#fff"/><path d="M95 68l-1 6 3 1M90 82c4 3 8 3 12 0" fill="none" stroke="#aa6268" stroke-width="1.2" stroke-linecap="round"/>`;
  if (direction === "left") return `<path d="M78 43c4-16 13-22 24-21 11 2 18 11 19 25v20c0 17-10 29-24 29-13 0-21-10-23-25l-5-3 5-8Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M78 61c4-3 9-3 13 0" fill="none" stroke="#3d2c31" stroke-width="1.4"/><ellipse cx="84" cy="65" rx="3" ry="4.5" fill="#292737"/><path d="M73 68l-6 4 7 2M82 82c4 2 7 2 10 0" fill="none" stroke="#aa6268" stroke-width="1.2" stroke-linecap="round"/>`;
  return `<path d="M114 43c-4-16-13-22-24-21-11 2-18 11-19 25v20c0 17 10 29 24 29 13 0 21-10 23-25l5-3-5-8Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M114 61c-4-3-9-3-13 0" fill="none" stroke="#3d2c31" stroke-width="1.4"/><ellipse cx="108" cy="65" rx="3" ry="4.5" fill="#292737"/><path d="M119 68l6 4-7 2M110 82c-4 2-7 2-10 0" fill="none" stroke="#aa6268" stroke-width="1.2" stroke-linecap="round"/>`;
}

function frontHair(character, direction) {
  if (direction === "up") return `<path d="M69 48c4-23 14-35 27-35 14 0 24 12 28 35-8-8-17-12-28-12s-20 4-27 12Z" fill="url(#hair-front)"/><path d="M96 16v24" stroke="${character.hair.highlight}" stroke-width="2" opacity=".35"/>`;
  const partLeft = character.hair.part === "wearer-left";
  if (direction === "down") {
    const sweep = partLeft
      ? "M69 51c0-24 11-38 28-38 13 0 23 7 28 21-7-7-15-10-24-9-8 1-11 7-16 12-5 5-10 8-16 9Z"
      : "M123 51c0-24-11-38-28-38-13 0-23 7-28 21 7-7 15-10 24-9 8 1 11 7 16 12 5 5 10 8 16 9Z";
    return `<path d="${sweep}" fill="url(#hair-front)" stroke="#29283a" stroke-width="1.6"/><path d="M96 16c${partLeft ? "-8 2-13 8-16 18m22-17c-2 8-7 15-15 21" : "8 2 13 8 16 18m-22-17c2 8 7 15 15 21"}" fill="none" stroke="${character.hair.highlight}" stroke-width="2.2" opacity=".42" stroke-linecap="round"/>`;
  }
  if (direction === "left") return `<path d="M73 50c1-23 12-37 28-37 12 0 22 7 27 20-9-7-18-8-27-4-8 4-14 11-28 18Z" fill="url(#hair-left)" stroke="#29283a" stroke-width="1.6"/><path d="M99 16c-8 4-13 11-17 22" fill="none" stroke="${character.hair.highlight}" stroke-width="2.1" opacity=".4"/>`;
  return `<path d="M119 50c-1-23-12-37-28-37-12 0-22 7-27 20 9-7 18-8 27-4 8 4 14 11 28 18Z" fill="url(#hair-right)" stroke="#29283a" stroke-width="1.6"/><path d="M93 16c8 4 13 11 17 22" fill="none" stroke="${character.hair.highlight}" stroke-width="2.1" opacity=".4"/>`;
}

function neck(direction) {
  if (direction === "left") return '<path d="M88 90h15l2 20H86Z" fill="url(#skin-left)" stroke="#6e4b49" stroke-width="1.3"/>';
  if (direction === "right") return '<path d="M89 90h15l2 20H87Z" fill="url(#skin-right)" stroke="#6e4b49" stroke-width="1.3"/>';
  return '<path d="M88 90h16l2 20H86Z" fill="url(#skin-front)" stroke="#6e4b49" stroke-width="1.3"/>';
}

function legPart(character, direction, part) {
  const kind = character.outfit.kind;
  const skinLeg = isLongGarment(kind) && kind !== "maleHanbok";
  const fill = skinLeg ? `url(#skin-${direction === "down" || direction === "up" ? "front" : direction})` : `url(#cloth-${direction === "down" || direction === "up" ? "front" : direction})`;
  const stroke = skinLeg ? "#6e4b49" : "#383747";
  const profile = direction === "left" || direction === "right";
  const leftSide = part.endsWith("Left");
  if (part.startsWith("thigh")) {
    if (profile) {
      const x = leftSide ? 86 : 98;
      return `<path d="M${x} 171h12l1 48H${x - 1}Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    }
    const x = leftSide ? 78 : 98;
    return `<path d="M${x} 171h17l${leftSide ? "-3" : "1"} 48H${leftSide ? 78 : 101}Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  }
  if (part.startsWith("calf")) {
    if (profile) {
      const x = leftSide ? 87 : 99;
      return `<path d="M${x} 212h11l1 43H${x - 1}Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    }
    const x = leftSide ? 78 : 101;
    return `<path d="M${x} 212h14l${leftSide ? "-2" : "1"} 43H${leftSide ? 77 : 103}Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  }
  const shoeFill = "url(#shoe)";
  if (profile) {
    if (direction === "left") {
      const x = leftSide ? 79 : 91;
      return `<path d="M${x} 250h14l-1 14H${x - 9}c-2-4 1-10 10-14Z" fill="${shoeFill}" stroke="#29283a" stroke-width="1.5"/>`;
    }
    const x = leftSide ? 85 : 97;
    return `<path d="M${x} 250h14c9 4 12 10 10 14H${x + 1}Z" fill="${shoeFill}" stroke="#29283a" stroke-width="1.5"/>`;
  }
  const x = leftSide ? 75 : 101;
  return `<path d="M${x} 250h16l${leftSide ? "5" : "-5"} 9c0 4-3 5-8 5H${leftSide ? 73 : 104}c-2-5-1-10 2-14Z" fill="${shoeFill}" stroke="#29283a" stroke-width="1.5"/>`;
}

function pelvis(character, direction) {
  const { kind } = character.outfit;
  const fill = `url(#cloth-${direction === "down" || direction === "up" ? "front" : direction})`;
  const profile = direction === "left" || direction === "right";
  if (["dress", "wrapDress"].includes(kind)) {
    if (profile) return `<path d="M82 154h29c9 23 13 52 14 88-18 8-40 8-58 0 2-35 7-64 15-88Z" fill="${fill}" stroke="#4b4150" stroke-width="1.7"/><path d="M91 160c-5 28-7 53-7 78m17-78c7 28 9 53 9 78" fill="none" stroke="${character.outfit.secondary}" stroke-width="1.2" opacity=".35"/>`;
    return `<path d="M76 154h40c10 22 16 52 18 88-22 9-54 9-76 0 2-36 8-66 18-88Z" fill="${fill}" stroke="#4b4150" stroke-width="1.7"/><path d="M83 161c-5 28-7 54-7 77m20-77v81m13-81c5 28 7 54 7 77" fill="none" stroke="${character.outfit.secondary}" stroke-width="1.2" opacity=".4"/>`;
  }
  if (kind === "skirt") {
    if (profile) return `<path d="M82 160h28c7 20 11 45 12 74-16 7-36 7-52 0 1-29 5-54 12-74Z" fill="${fill}" stroke="#4b4150" stroke-width="1.7"/>`;
    return `<path d="M76 160h40c8 20 13 45 14 74-20 8-48 8-68 0 1-29 6-54 14-74Z" fill="${fill}" stroke="#4b4150" stroke-width="1.7"/><path d="M84 166l-5 65m17-65v68m12-68 5 65" stroke="${character.outfit.secondary}" stroke-width="1.2" opacity=".35"/>`;
  }
  if (kind === "femaleHanbok") {
    if (profile) return `<path d="M80 146h31c11 25 17 57 18 98-18 9-42 9-61 0 1-41 4-73 12-98Z" fill="${fill}" stroke="#67444f" stroke-width="1.7"/>`;
    return `<path d="M72 146h48c12 25 19 57 20 98-25 11-63 11-88 0 1-41 8-73 20-98Z" fill="${fill}" stroke="#67444f" stroke-width="1.7"/><path d="M82 153c-6 29-9 58-9 87m23-87v91m14-91c6 29 9 58 9 87" stroke="${character.outfit.secondary}" stroke-width="1.2" opacity=".28"/>`;
  }
  if (kind === "maleHanbok") {
    if (profile) return `<path d="M81 151h30l7 91c-17 8-36 8-53 0l8-73Z" fill="${fill}" stroke="#394552" stroke-width="1.7"/>`;
    return `<path d="M72 151h48l9 91c-20 8-46 8-66 0l8-73Z" fill="${fill}" stroke="#394552" stroke-width="1.7"/><path d="M96 157v83" stroke="${character.outfit.secondary}" stroke-width="1.2" opacity=".4"/>`;
  }
  if (profile) return `<path d="M84 164h25l2 24H84Z" fill="${character.outfit.shade}" stroke="#333341" stroke-width="1.5"/>`;
  return `<path d="M77 164h38l-3 24H80Z" fill="${kind === "blazerPants" ? character.outfit.secondary : character.outfit.shade}" stroke="#333341" stroke-width="1.5"/>`;
}

function torso(character, direction) {
  const profile = direction === "left" || direction === "right";
  const x1 = profile ? 82 : 79;
  const x2 = profile ? 111 : 113;
  return `<path d="M${x1} 101h${x2 - x1}l4 67H${x1 - 4}Z" fill="url(#inner-cloth)" stroke="#4b5364" stroke-width="1.5"/>`;
}

function innerTop(character, direction) {
  const { kind, accent, secondary } = character.outfit;
  if (direction === "up") return kind === "maleHanbok" ? `<path d="M83 103h26l5 47H78Z" fill="${secondary}" opacity=".75"/>` : "";
  const profile = direction === "left" || direction === "right";
  if (["tailored", "blazerPants"].includes(kind)) {
    if (profile) return `<path d="M87 102l9 10 9-10 6 10-14 15-15-15Z" fill="#fffdf6" stroke="#646471" stroke-width="1"/><path d="M93 109h6l-1 34h-5Z" fill="${accent}"/>`;
    return `<path d="M86 101l10 10 10-10 7 10-17 17-17-17Z" fill="#fffdf6" stroke="#646471" stroke-width="1.1"/><path d="M92 109h8l-1 9-3 29-4-29Z" fill="${accent}" stroke="#2c2c3b" stroke-width="1"/>`;
  }
  if (kind === "femaleHanbok") return `<path d="M78 104l18 15 18-15v33H78Z" fill="${secondary}"/><path d="M80 105l16 14 15-14" fill="none" stroke="${accent}" stroke-width="4"/>`;
  if (kind === "maleHanbok") return `<path d="M79 102h34v56H79Z" fill="${secondary}"/><path d="M82 104l14 17 14-17" fill="none" stroke="#fffdf5" stroke-width="5"/>`;
  if (kind === "wrapDress") return `<path d="M78 103h36l-18 25Z" fill="${secondary}" opacity=".8"/><path d="M80 106l30 38M112 106l-29 38" stroke="${accent}" stroke-width="2" opacity=".75"/>`;
  return `<path d="M80 103h32l-16 22Z" fill="${secondary}" opacity=".9"/><path d="M88 106l8 13 8-13" fill="none" stroke="${accent}" stroke-width="2"/>`;
}

function jacket(character, direction) {
  const { kind, accent } = character.outfit;
  const fill = `url(#cloth-${direction === "down" || direction === "up" ? "front" : direction})`;
  const profile = direction === "left" || direction === "right";
  if (["tailored", "blazerPants"].includes(kind)) {
    if (profile) return `<path d="M81 103c-7 5-9 15-9 30l3 44h18l3-27v-25l-12-21Zm29 2c6 7 8 16 8 29l-4 43H97l-1-52 11-20Z" fill="${fill}" stroke="#303342" stroke-width="1.7"/><path d="M84 106l12 20-10 8 10 15m11-43-11 20 9 8-9 15" fill="none" stroke="${character.outfit.secondary}" stroke-width="1.35" opacity=".5"/>`;
    return `<path d="M78 103c-8 4-11 13-12 27l4 47h21l5-29v-22l-15-22Zm36 0c8 4 11 13 12 27l-4 47h-21l-5-29v-22l15-22Z" fill="${fill}" stroke="#303342" stroke-width="1.7"/><path d="M81 105l15 21-12 8 12 15m15-44-15 21 12 8-12 15" fill="none" stroke="${character.outfit.secondary}" stroke-width="1.4" opacity=".52"/><circle cx="96" cy="149" r="1.8" fill="${accent}"/>`;
  }
  if (kind === "femaleHanbok") return `<path d="M76 102c-7 5-9 16-8 31l5 28h46l5-28c1-15-1-26-8-31l-20 17Z" fill="${character.outfit.secondary}" stroke="#684f53" stroke-width="1.6"/><path d="M76 105l20 15 20-15M74 145h44" fill="none" stroke="${accent}" stroke-width="2.2"/>`;
  if (kind === "maleHanbok") return `<path d="M76 102c-7 6-9 18-8 34l5 39h46l5-39c1-16-1-28-8-34l-20 18Z" fill="${fill}" stroke="#394552" stroke-width="1.7"/><path d="M78 104l18 17 18-17M96 121v52" fill="none" stroke="${character.outfit.secondary}" stroke-width="2.4"/>`;
  if (profile) return `<path d="M80 103c-7 5-9 17-8 31l5 36h38l5-36c1-14-2-26-9-31l-15 20Z" fill="${fill}" stroke="#4b4150" stroke-width="1.6"/><path d="M82 108l14 16 13-16" fill="none" stroke="${accent}" stroke-width="1.8"/>`;
  return `<path d="M76 103c-8 5-10 17-9 31l6 36h46l6-36c1-14-2-26-9-31l-20 21Z" fill="${fill}" stroke="#4b4150" stroke-width="1.6"/><path d="M79 107l17 18 17-18M75 158h42" fill="none" stroke="${accent}" stroke-width="1.8"/>`;
}

function arm(character, direction, part) {
  const right = part.endsWith("Right");
  const profile = direction === "left" || direction === "right";
  const clothFill = `url(#cloth-${direction === "down" || direction === "up" ? "front" : direction})`;
  const skinFill = `url(#skin-${direction === "down" || direction === "up" ? "front" : direction})`;
  const sleeveLight = ["dress", "wrapDress", "skirt", "femaleHanbok", "maleHanbok"].includes(character.outfit.kind)
    ? character.outfit.secondary
    : clothFill;
  const baseX = right ? 118 : 60;
  const profileOffset = profile ? (right ? -4 : 4) : 0;
  if (part.startsWith("upperArm")) {
    const x = baseX + profileOffset;
    return `<path d="M${x + (right ? 8 : 6)} 112c${right ? 5 : -5} 4 ${right ? 7 : -7} 15 ${right ? 7 : -7} 25l${right ? -1 : 1} 20 ${right ? -14 : 14}-1 ${right ? -4 : 4}-42c${right ? 3 : -3}-3 ${right ? 8 : -8}-4 ${right ? 12 : -12}-2Z" fill="${sleeveLight}" stroke="#4b4150" stroke-width="1.55"/>`;
  }
  if (part.startsWith("lowerArm")) {
    const x = baseX + profileOffset;
    return `<path d="M${x} 150h14l-1 37-13 1Z" fill="${sleeveLight}" stroke="#4b4150" stroke-width="1.55"/>`;
  }
  const x = (right ? 119 : 60) + profileOffset;
  return `<path d="M${x} 183h13v11c-2 6-10 6-13 0Z" fill="${skinFill}" stroke="#6e4b49" stroke-width="1.25"/>`;
}

function outfitDetail(character, direction) {
  const { kind, accent } = character.outfit;
  const accessory = character.accessory;
  if (direction === "up") return kind === "femaleHanbok" || kind === "maleHanbok" ? `<path d="M94 130h4v42h-4Z" fill="${accent}" opacity=".75"/>` : "";
  if (accessory.type === "pocketSquare") {
    if (direction === "right") return "";
    const x = direction === "left" ? 101 : 109;
    return `<path d="M${x} 119h12v6l-4-2-3 2-5-2Z" fill="${accessory.color}" stroke="${accessory.accent}" stroke-width="1"/>`;
  }
  if (kind === "femaleHanbok") return `<path d="M78 136h36v7H78Z" fill="${accent}" opacity=".85"/>`;
  if (kind === "maleHanbok") return `<path d="M74 151h44v7H74Z" fill="${accent}"/><path d="M96 158v18" stroke="${accent}" stroke-width="2"/>`;
  if (["dress", "wrapDress", "skirt"].includes(kind)) return `<path d="M75 153h42v7H75Z" fill="${accent}" opacity=".82"/>`;
  return "";
}

function accessory(character, direction) {
  const { type, side, color, accent } = character.accessory;
  if (type === "pocketSquare" || direction === "up") return "";
  const wearerLeft = side === "wearer-left";
  const visible = direction === "down"
    || direction === "left" && wearerLeft
    || direction === "right" && !wearerLeft;
  if (!visible && type !== "earrings") return "";
  const x = direction === "right" ? 62 : direction === "left" ? 116 : wearerLeft ? 119 : 59;
  if (type === "handbag") return `<path d="M${x - 4} 154c0-18 16-18 16 0" fill="none" stroke="${accent}" stroke-width="2"/><rect x="${x - 7}" y="152" width="22" height="28" rx="4" fill="${color}" stroke="${accent}" stroke-width="1.6"/><path d="M${x - 3} 158h14" stroke="#fff" stroke-width="1" opacity=".45"/>`;
  if (type === "clutch") return `<rect x="${x - 6}" y="166" width="20" height="13" rx="3" fill="${color}" stroke="${accent}" stroke-width="1.5"/><path d="M${x - 3} 170h14" stroke="#fff" stroke-width="1" opacity=".45"/>`;
  if (type === "norigae") return `<path d="M${x} 145v45" stroke="${accent}" stroke-width="2"/><circle cx="${x}" cy="156" r="4" fill="${color}" stroke="${accent}"/><path d="M${x - 5} 190h10l-3 19h-4Z" fill="${color}" stroke="${accent}" stroke-width="1"/>`;
  if (type === "earrings") {
    if (direction === "down") return `<circle cx="70" cy="78" r="2" fill="${color}"/><path d="M70 80v8" stroke="${accent}"/><circle cx="122" cy="78" r="2" fill="${color}"/><path d="M122 80v8" stroke="${accent}"/>`;
    const earX = direction === "left" ? 116 : 76;
    return `<circle cx="${earX}" cy="77" r="2" fill="${color}"/><path d="M${earX} 79v9" stroke="${accent}"/>`;
  }
  return "";
}

function partMarkup(character, direction, partId) {
  if (partId === "shadow") return '<ellipse cx="96" cy="262" rx="32" ry="6" fill="#463d47" opacity=".16"/>';
  if (partId === "backHair") return `<g transform="translate(0 1)">${hairBack(character, direction)}</g>`;
  if (partId === "face") return face(character, direction);
  if (partId === "frontHair") return `<g transform="translate(0 1)">${frontHair(character, direction)}</g>`;
  if (partId === "neck") return neck(direction);
  if (partId === "pelvis") return pelvis(character, direction);
  if (/^(thigh|calf|shoe)/u.test(partId)) return legPart(character, direction, partId);
  if (partId === "torso") return torso(character, direction);
  if (partId === "shirtTie") return innerTop(character, direction);
  if (partId === "jacket") return jacket(character, direction);
  if (/^(upperArm|lowerArm|hand)/u.test(partId)) return arm(character, direction, partId);
  if (partId === "pocketSquare") return outfitDetail(character, direction);
  if (partId === "accessory") return accessory(character, direction);
  throw new Error(`지원하지 않는 컷아웃 파츠: ${partId}`);
}

export function renderEditableGuestArtwork(character, parts = guestCutoutPartDefinitions) {
  const groups = directions.flatMap((direction) => parts.map((part) => (
    `<g id="${direction}-${part.id}">${partMarkup(character, direction, part.id)}</g>`
  ))).join("\n");
  const tailoredOrder = [
    "shadow", "backHair", "thighRight", "calfRight", "shoeRight", "pelvis",
    "thighLeft", "calfLeft", "shoeLeft", "neck", "torso", "shirtTie", "jacket",
    "upperArmLeft", "lowerArmLeft", "handLeft", "upperArmRight", "lowerArmRight",
    "handRight", "face", "frontHair", "pocketSquare", "accessory"
  ];
  const garmentOrder = [
    "shadow", "backHair", "thighRight", "calfRight", "shoeRight", "thighLeft",
    "calfLeft", "shoeLeft", "pelvis", "neck", "torso", "shirtTie", "jacket",
    "upperArmLeft", "lowerArmLeft", "handLeft", "upperArmRight", "lowerArmRight",
    "handRight", "face", "frontHair", "pocketSquare", "accessory"
  ];
  const previewUses = (character.template === "tailored" ? tailoredOrder : garmentOrder)
    .map((partId) => `<use href="#down-${partId}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="288" viewBox="0 0 192 288">
  <title>${escapeXml(character.label)} 편집용 방향별 컷아웃 파츠</title>
  <desc>캐릭터별 appearance와 독립 방향 파츠에서 생성한다. 좌우 반전 변형은 사용하지 않는다.</desc>
  <metadata data-character-id="${escapeXml(character.characterId)}" data-preset-id="${escapeXml(character.presetId)}" data-template="${escapeXml(character.template)}"/>
  <defs>${definitions(character)}${groups}</defs>
  <g id="editable-neutral-preview">${previewUses}</g>
</svg>\n`;
}
