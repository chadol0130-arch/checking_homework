export const CHARACTER_STYLES = ["classic", "mint", "sunset", "candy"];

const LEVEL_FILES = {
  1: "body.png",
  2: "shirt.png",
  3: "top.png",
  4: "premium.png",
};

export const USER_AVATAR_MAP = {
  "asdol0130@naver.com": {
    basePath: "/static/sprites/users/asdol0130",
    defaultStyle: "classic",
    frameW: 155,
    frameH: 241,
    framesByTier: {
      1: 2,
      2: 2,
      3: 2,
      4: 3,
    },
    styles: {
      classic: { basePath: "/static/sprites/users/asdol0130" },
      mint: { basePath: "/static/sprites/users/asdol0130" },
      sunset: { basePath: "/static/sprites/users/asdol0130" },
      candy: { basePath: "/static/sprites/users/asdol0130" },
    },
  },
};

export function resolveAvatarSources({ userEmail, level, style } = {}) {
  if (!userEmail) {
    return null;
  }
  const profile = USER_AVATAR_MAP[userEmail];
  if (!profile) {
    return null;
  }

  const normalizedLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const tier = normalizedLevel >= 4 ? 4 : normalizedLevel;
  const filename = LEVEL_FILES[tier] || LEVEL_FILES[1];

  const styleKey =
    style && profile.styles && Object.prototype.hasOwnProperty.call(profile.styles, style)
      ? style
      : profile.defaultStyle;
  const styleConfig = profile.styles?.[styleKey];
  const basePath = styleConfig?.basePath || profile.basePath;
  if (!basePath) {
    return null;
  }

  return {
    bodySrc: `${basePath}/${filename}`,
    frameW: profile.frameW,
    frameH: profile.frameH,
    frameCount: profile.framesByTier?.[tier],
  };
}

export function setCharacterStyleClass(element, style) {
  if (!element) {
    return;
  }
  CHARACTER_STYLES.forEach((entry) => {
    element.classList.remove(`character-${entry}`);
  });
  if (style && CHARACTER_STYLES.includes(style)) {
    element.classList.add(`character-${style}`);
  }
}
