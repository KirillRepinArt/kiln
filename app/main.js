/* Kiln · start-up. Every file only declares; this is the one place that starts the app, in this order (the order
   the files used to run in when each started itself): the screen, then the connection to the server, then the prompt
   editor (both of those wait for answers, so the screen is up while they do). */
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
