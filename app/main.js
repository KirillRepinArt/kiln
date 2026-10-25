/* Kiln · start-up. Every file only declares; this is the one place that starts the app, in this order (the order
   the files used to run in when each started itself): the screen, then the connection to the server, then the prompt
   editor (both of those wait for answers, so the screen is up while they do). */
import { installTestBridge } from "./testing.js";
import { initState } from "./state.js";
import { initComposer } from "./composer.js";
import { initCardlayout } from "./cardlayout.js";
import { initStage } from "./stage.js";
import { initSkins } from "./skins.js";
import { initEffects } from "./effects.js";
import { initQueue } from "./queue.js";
import { initViewer } from "./viewer.js";
import { initTooltips } from "./tooltips.js";
import { initLoras } from "./loras.js";
import { initPnginfo } from "./pnginfo.js";
import { initSettings } from "./settings.js";
import { initBoot } from "./boot.js";
import { initKeys } from "./keys.js";
import { startLive } from "./live.js";
import { startEditor } from "./editor.js";

if (new URLSearchParams(location.search).has("test")) installTestBridge(); // the e2e tests' way in
initState();
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
