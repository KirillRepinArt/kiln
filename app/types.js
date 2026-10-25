// @ts-check
/* Kiln · the shapes of the data every part of the page shares — descriptions for the type checker (tsc, a dev tool),
   nothing at run time. Other files use them as {import("./types.js").Job}. */

/**
 * What a job is doing: waiting, being made, finished, stopped, failed, or deleted (kept during its Undo window).
 * @typedef {"pending" | "running" | "done" | "cancelled" | "error" | "deleted"} JobStatus
 */

/**
 * One LoRA as a job uses it: its name in Forge and its weight.
 * @typedef {object} LoraUse
 * @property {string} name
 * @property {number} w
 */

/**
 * What a job was queued with (sent to the server as is; the picture's own settings).
 * @typedef {object} JobSpec
 * @property {string} prompt      the prompt as sent, {a|b} picks made and // comments gone
 * @property {string} raw         the prompt as written
 * @property {string[]} picks     what each {a|b} picked
 * @property {string} name        the series ("Harbour"); "" = none
 * @property {string} mp          megapixels: "0.5" | "1.0" | "1.5" | "2.0"
 * @property {string} ar          aspect ratio: "3:4", "16:9" …
 * @property {number} w
 * @property {number} h
 * @property {number} steps
 * @property {number} seed
 * @property {LoraUse[]} loras
 * @property {string} [checkpoint]
 * @property {string[]} [modules]  VAE / text encoder files
 * @property {number} shift
 * @property {number} cfg
 * @property {string} sampler
 * @property {string} scheduler
 */

/**
 * A job as the page holds it: the server's job with its spec spread in, times in ms.
 * @typedef {JobSpec & {
 *   id: number,
 *   kind: "txt2img" | "upscale",
 *   status: JobStatus,
 *   file: string | null,
 *   est?: number, est_first?: number, t_first?: number, eta?: number,
 *   step: number, progress: number, preview_rev: number,
 *   error?: string,
 *   started?: number, finished?: number, created?: number,
 *   spec: JobSpec,
 *   warm: boolean, stopping: boolean, missing: boolean,
 * }} Job
 */

export {};
