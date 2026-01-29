const DEFAULT_ANIMATIONS = {
  idle: { start: 0, end: 5, fps: 8, loop: true },
  cheer: { start: 14, end: 19, fps: 12, loop: false },
};

const DEFAULT_OUTFITS = [
  { min: 1, max: 3, top: "/static/sprites/top_basic.png", bottom: "/static/sprites/bottom_basic.png" },
  { min: 4, max: 6, top: "/static/sprites/top_vest.png", bottom: "/static/sprites/bottom_jeans.png" },
  { min: 7, max: Infinity, top: "/static/sprites/top_premium.png", bottom: "/static/sprites/bottom_premium.png" },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export default class AvatarEngine {
  constructor({ canvasId, frameW = 96, frameH = 96, scale = 2, autoScale = true } = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.frameW = frameW;
    this.frameH = frameH;
    this.scale = scale;
    this.autoScale = autoScale;
    this.renderScale = scale;
    this.frameCount = 1;
    this.forcedLayout = null;
    this.images = {
      body: null,
      top: null,
      bottom: null,
    };
    this.animations = { ...DEFAULT_ANIMATIONS };
    this.state = {
      name: "idle",
      frame: DEFAULT_ANIMATIONS.idle.start,
      timer: 0,
    };
    this.lastTimestamp = null;
    this.isRunning = false;
    this.outfitKey = "";
    this.level = 1;
    this.xp = 0;

    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  async load({ bodySrc, topSrc, bottomSrc }) {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const [body, top, bottom] = await Promise.all([
      bodySrc ? loadImage(bodySrc) : Promise.resolve(null),
      topSrc ? loadImage(topSrc) : Promise.resolve(null),
      bottomSrc ? loadImage(bottomSrc) : Promise.resolve(null),
    ]);
    this.images.body = body;
    this.images.top = top;
    this.images.bottom = bottom;
    if (body) {
      this.setLayoutFromImage(body);
    }
    this.playIdle();
    this.start();
  }

  async setOutfit(options = {}) {
    if (!this.canvas || !this.ctx) {
      return;
    }
    const { bodySrc, topSrc, bottomSrc, frameW, frameH, frameCount } = options;
    const hasLayoutOverride =
      Object.prototype.hasOwnProperty.call(options, "frameW") ||
      Object.prototype.hasOwnProperty.call(options, "frameH") ||
      Object.prototype.hasOwnProperty.call(options, "frameCount");
    this.forcedLayout = hasLayoutOverride ? { frameW, frameH, frameCount } : null;
    const requests = [];
    if (Object.prototype.hasOwnProperty.call(options, "bodySrc")) {
      if (bodySrc) {
        requests.push(
          loadImage(bodySrc).then((img) => {
            this.images.body = img;
            this.setLayoutFromImage(img, this.forcedLayout);
          })
        );
      } else {
        this.images.body = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(options, "topSrc")) {
      if (topSrc) {
        requests.push(
          loadImage(topSrc).then((img) => {
            this.images.top = img;
          })
        );
      } else {
        this.images.top = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(options, "bottomSrc")) {
      if (bottomSrc) {
        requests.push(
          loadImage(bottomSrc).then((img) => {
            this.images.bottom = img;
          })
        );
      } else {
        this.images.bottom = null;
      }
    }
    if (requests.length) {
      await Promise.all(requests);
    }
  }

  setLevel(level) {
    const safeLevel = Number.isFinite(level) ? Math.max(1, level) : 1;
    this.level = safeLevel;
    const outfit = DEFAULT_OUTFITS.find((entry) => safeLevel >= entry.min && safeLevel <= entry.max);
    if (!outfit) {
      return;
    }
    const nextKey = `${outfit.top}|${outfit.bottom}`;
    if (nextKey === this.outfitKey) {
      return;
    }
    this.outfitKey = nextKey;
    this.setOutfit({ topSrc: outfit.top, bottomSrc: outfit.bottom });
  }

  setXp(xp) {
    this.xp = Number.isFinite(xp) ? xp : this.xp;
  }

  playIdle() {
    this.switchAnimation("idle");
  }

  playCheer() {
    this.switchAnimation("cheer");
  }

  switchAnimation(name) {
    const anim = this.animations[name];
    if (!anim) {
      return;
    }
    this.state.name = name;
    this.state.frame = anim.start;
    this.state.timer = 0;
  }

  start() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.isRunning = false;
  }

  tick = (timestamp) => {
    if (!this.isRunning) {
      return;
    }
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }
    const delta = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    this.update(delta);
    this.render();
    requestAnimationFrame(this.tick);
  };

  update(delta) {
    const anim = this.animations[this.state.name];
    if (!anim) {
      return;
    }
    this.state.timer += delta;
    const frameDuration = 1 / anim.fps;
    while (this.state.timer >= frameDuration) {
      this.state.timer -= frameDuration;
      this.state.frame += 1;
      if (this.state.frame > anim.end) {
        if (anim.loop) {
          this.state.frame = anim.start;
        } else {
          this.playIdle();
          break;
        }
      }
    }
  }

  render() {
    if (!this.canvas || !this.ctx || !this.frameW || !this.frameH) {
      return;
    }
    const ctx = this.ctx;
    const frame = this.state.frame;
    const drawW = this.frameW * this.renderScale;
    const drawH = this.frameH * this.renderScale;
    const dx = Math.round((this.canvas.width - drawW) / 2);
    const dy = Math.round((this.canvas.height - drawH) / 2);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;

    const sx = frame * this.frameW;
    const sy = 0;
    const layers = [this.images.body, this.images.bottom, this.images.top];
    layers.forEach((img) => {
      if (!img) {
        return;
      }
      ctx.drawImage(img, sx, sy, this.frameW, this.frameH, dx, dy, drawW, drawH);
    });
  }

  setLayoutFromImage(image, override) {
    if (!image) {
      return;
    }
    const height = image.naturalHeight || image.height;
    const width = image.naturalWidth || image.width;
    if (!height || !width) {
      return;
    }
    if (override?.frameW && override?.frameH) {
      this.frameW = override.frameW;
      this.frameH = override.frameH;
      if (override.frameCount) {
        this.frameCount = override.frameCount;
      } else if (width % override.frameW === 0) {
        this.frameCount = Math.max(1, Math.floor(width / override.frameW));
      } else {
        this.frameCount = 1;
      }
    } else if (width % height === 0) {
      this.frameCount = Math.max(1, Math.floor(width / height));
      this.frameW = Math.floor(width / this.frameCount);
      this.frameH = height;
    } else {
      this.frameCount = 1;
      this.frameW = width;
      this.frameH = height;
    }
    this.refreshAnimationsForFrames();
    this.updateScaleToFit();
  }

  refreshAnimationsForFrames() {
    if (this.frameCount >= 20) {
      this.animations = { ...DEFAULT_ANIMATIONS };
      return;
    }
    const end = Math.max(0, this.frameCount - 1);
    this.animations = {
      idle: { start: 0, end, fps: 6, loop: true },
      cheer: { start: 0, end, fps: 10, loop: false },
    };
    if (this.state.frame > end) {
      this.state.frame = 0;
    }
  }

  updateScaleToFit() {
    if (!this.canvas || !this.frameW || !this.frameH) {
      return;
    }
    if (!this.autoScale) {
      this.renderScale = this.scale;
      return;
    }
    const fitScale = Math.min(this.canvas.width / this.frameW, this.canvas.height / this.frameH);
    if (fitScale < 1) {
      this.renderScale = fitScale;
    } else {
      this.renderScale = Math.max(1, Math.floor(fitScale));
    }
  }
}
