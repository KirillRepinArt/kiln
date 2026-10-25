/* Kiln · start-up. Every file only declares; this is the one place that starts the app, in this order (the order
   the files used to run in when each started itself): the screen, then the connection to the server, then the prompt
   editor (both of those wait for answers, so the screen is up while they do). */
import { initBoot } from "./boot.js";
import { initCardlayout } from "./cardlayout.js";
import { initComposer } from "./composer.js";
import { startEditor } from "./editor.js";
import { initEffects } from "./effects.js";
import { initKeys } from "./keys.js";
import { migrateLayoutPrefs } from "./layout.js";
import { startLive } from "./live.js";
import { initLoras } from "./loras.js";
import { initPnginfo } from "./pnginfo.js";
import { initQueue } from "./queue.js";
import { initSettings } from "./settings.js";
import { initSkins } from "./skins.js";
import { initStage } from "./stage.js";
import { initState } from "./state.js";
import { installTestBridge } from "./testing.js";
import { initTooltips } from "./tooltips.js";
import { initViewer } from "./viewer.js";

if (new URLSearchParams(location.search).has("test")) installTestBridge(); // the e2e tests' way in
initState();
migrateLayoutPrefs(); // saved layouts of older versions → today's
initComposer();
initCardlayout();
initStage();
initSkins();
initEffects();
initQueue();
initViewer();
initTooltips();
initLoras();
initPnginfo();
initSettings();
initBoot();
initKeys();
startLive();
startEditor();
