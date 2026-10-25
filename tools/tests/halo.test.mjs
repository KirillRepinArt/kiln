// Aurora's halo round the picture: no light under the glass panels (the prompt box's edge blur turned the pulsing glow
// into a flickering band, 2026-10-19), full light on the picture's free sides.
export async function noGlowUnderGlass(k, t) {
  await k.theme("aurora");
  await k.setting("glass", "on");
  await k.job("[fill:224433] castle", { ar: "16:9", steps: 4 });
  t.ok(
    await k.until(`current()&&current().step>=2&&$("fglow").style.display!=="none"&&$("fglow").width>64`, 20000, 100),
    "the halo is on while it renders",
  );
  await k.sleep(1200);
  const a =
    await k.ev(`(()=>{const g=$("fglow"),gr=g.getBoundingClientRect(),c=g.getContext("2d"),dp=g.width/gr.width,f=$("frame").getBoundingClientRect(),L=$("left").getBoundingClientRect();
    const at=(x,y)=>c.getImageData(Math.round((x-gr.left)*dp),Math.round((y-gr.top)*dp),1,1).data[3];
    const yL=L.top+L.height/2,yf=f.top+f.height/2,inner=L.left<f.left?L.right-3:L.left+3,free=L.left<f.left?f.right+12:f.left-12;
    return{underBox:Math.max(at(inner,yL),at(inner,yL-20),at(inner,yL+20)),gap:at(L.left<f.left?L.right+9:L.left-9,yL),free:at(free,yf)}})()`);
  t.ok(a.free > 20, "the free side glows", a);
  t.ok(a.underBox <= 2, "nothing under the prompt box's edge", a);
}
noGlowUnderGlass.opts = { width: 2000, height: 1023, step: 1.2 };
