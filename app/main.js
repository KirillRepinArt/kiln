/* Kiln · start-up. Every file only declares; this is the one place that starts the app, in this order (the order
   the files used to run in when each started itself). The connection to the server (live.js) and the prompt editor
   (editor.js) start on their own, right after. */
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
