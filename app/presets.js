// @ts-check
/* Kiln · the fixed presets: picture sizes, aspect ratios, time per step. Plain data — imports nothing. */
/** each size preset's pictures by aspect ratio: [width, height] @type {Record<string, Record<string, [number, number]>>} */
export const SIZES = {
  // ~0.5 / 1.0 / 1.5 / 2.0 MP presets, all sides multiples of 16
  "0.5": {
    "1:1": [720, 720],
    "4:3": [832, 624],
    "3:2": [880, 592],
    "16:9": [960, 544],
    "21:9": [1088, 464],
    "3:4": [624, 832],
    "2:3": [592, 880],
    "9:16": [544, 960],
  },
  "1.0": {
    "1:1": [1024, 1024],
    "4:3": [1152, 864],
    "3:2": [1248, 832],
    "16:9": [1360, 768],
    "21:9": [1568, 672],
    "3:4": [864, 1152],
    "2:3": [832, 1248],
    "9:16": [768, 1360],
  },
  "1.5": {
    "1:1": [1232, 1232],
    "4:3": [1408, 1056],
    "3:2": [1488, 992],
    "16:9": [1648, 928],
    "21:9": [1872, 800],
    "3:4": [1056, 1408],
    "2:3": [992, 1488],
    "9:16": [928, 1648],
  },
  "2.0": {
    "1:1": [1408, 1408],
    "4:3": [1632, 1216],
    "3:2": [1728, 1152],
    "16:9": [1888, 1056],
    "21:9": [2160, 928],
    "3:4": [1232, 1648],
    "2:3": [1152, 1728],
    "9:16": [1056, 1872],
  },
};
export const RATIOS = ["3:4", "2:3", "9:16", "1:1", "4:3", "3:2", "16:9", "21:9"];
/** seconds per step by megapixels (placeholders until real history exists) @type {Record<string, number>} */
export const SEC_PER_STEP = { "0.5": 35, "1.0": 60, "1.5": 130, "2.0": 220 };
