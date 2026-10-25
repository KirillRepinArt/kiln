/* Kiln · start-up. Every file only declares; this is the one place that starts the app, in this order (the order
   the files used to run in when each started itself): the screen, then the connection to the server, then the prompt
   editor (both of those wait for answers, so the screen is up while they do). */
import { initBoot } from "./boot.js";
import { initBrowse } from "./browse.js";
import { initCardlayout } from "./cardlayout.js";
import { initChips } from "./chips.js";
import { initEdges } from "./edges.js";
import { startEditor } from "./editor.js";
import { initEffects } from "./effects.js";
import { initKeys } from "./keys.js";
import { initLayout, migrateLayoutPrefs } from "./layout.js";
import { startLive } from "./live.js";
import { initLoras } from "./loras.js";
import { initPeek } from "./peek.js";
import { initPills } from "./pills.js";
import { initPnginfo } from "./pnginfo.js";
import { initStatusRow } from "./progress.js";
import { initPromptBox, initStartKeys } from "./prompt.js";
import { initQueue } from "./queue.js";
import { initSettings } from "./settings.js";
import { initSkins } from "./skins.js";
import { initState } from "./state.js";
import { initTabs } from "./tabs.js";
import { installTestBridge } from "./testing.js";
import { initTooltips } from "./tooltips.js";
import { initViewer } from "./viewer.js";

if (new URLSearchParams(location.search).has("test")) installTestBridge(); // the e2e tests' way in
initState();
migrateLayoutPrefs(); // saved layouts of older versions → today's
initPills();
initEdges();
initPromptBox();
initChips();
initCardlayout();
initTabs();
initBrowse();
initLayout();
initStartKeys();
initStatusRow();
initSkins();
initEffects();
initQueue();
initPeek();
initViewer();
initTooltips();
initLoras();
initPnginfo();
initSettings();
initBoot();
initKeys();
startLive();
startEditor();
