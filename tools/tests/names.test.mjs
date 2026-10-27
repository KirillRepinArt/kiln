// Series names travel with Edit and PNG Info; the LoRA tab rescans.
const done = (k, n) => k.until(`!current()&&jobs.filter(j=>j.status==="done").length>=${n}`, 30000);

export async function reuseTakesName(k, t) {
  await k.job("a grey wolf", { name: "Wolf Pack", steps: 2 });
  await done(k, 1);
  await k.ev(`(S.pname="something else",$("pname").value=S.pname,P.value="another draft",draft=P.value,1)`);
  await k.ev(`(loadJob(lastDone()),reuse(),1)`);
  t.ok(
    (await k.ev(`S.pname`)) === "Wolf Pack" && (await k.ev(`$("pname").value`)) === "Wolf Pack",
    "Edit takes the job's name",
  );
}

export async function pngInfoName(k, t) {
  await k.job("a grey wolf", { name: "Wolf Pack", steps: 2 });
  await done(k, 1);
  const file = await k.ev(`lastDone().file`);
  t.ok(file === "wolf-pack-001.png", "named file", file);
  const read = name =>
    k.ev(
      `fetch("/files/"+encodeURIComponent(${JSON.stringify(file)})).then(r=>r.blob()).then(b=>readPng(new File([b],${JSON.stringify(name)},{type:"image/png"}))).then(()=>parsed&&parsed.name)`,
    );
  t.ok((await read(file)) === "Wolf Pack", "the name comes back from inside the PNG");
  t.ok((await read("00012-12345.png")) === "Wolf Pack", "…even when the file was renamed");
  await k.ev(`(S.pname="",$("pname").value="",$("pSend").click(),1)`);
  t.ok((await k.ev(`S.pname`)) === "Wolf Pack", "Send to prompt applies it");
  t.ok((await k.ev(`nameFrom({name:"night-city-003.png"})`)) !== null, "older files: from slug-NNN.png");
}

export async function loraRescan(k, t) {
  const n0 = await k.ev(`LORAS.length`);
  await k.ev(`(document.querySelector('.tab[data-v="loras"]').click(),1)`);
  t.ok(await k.until(`LORAS.length>${n0}`, 8000), "opening the LoRA tab rescans (the fake Forge adds one)");
  t.ok(/1 new LoRA/.test(await k.ev(`$("toastMsg").textContent`)), "and says so");
  await k.ev(`($("lRefresh").click(),1)`);
  t.ok(await k.until(`LORAS.length>${n0 + 1}`, 8000), "the rescan button works too");
}
