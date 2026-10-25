/* CodeMirror 6 prompt editor, bundled in app/vendor/codemirror.js (works offline). Opened as a file, the browser won't
   load a local module, so it tries the CDN; failing both, the plain textarea stays. */
/* called from main.js, last */
async function startEditor() {
  const V = "?deps=@codemirror/state@6.4.1";
  let cm;
  try {
    cm = await import("./app/vendor/codemirror.js");
  } catch (e) {}
  if (!cm)
    try {
      const st = await import("https://esm.sh/@codemirror/state@6.4.1");
      const vw = await import("https://esm.sh/@codemirror/view@6.26.3" + V);
      const cmd = await import("https://esm.sh/@codemirror/commands@6.5.0" + V + ",@codemirror/view@6.26.3");
      cm = { ...st, ...vw, ...cmd };
    } catch (e) {
      console.warn("CodeMirror unavailable, using plain textarea", e);
    }
  if (cm) {
    const {
      EditorState,
      Compartment,
      RangeSetBuilder,
      EditorView,
      Decoration,
      ViewPlugin,
      keymap,
      placeholder,
      history,
      historyKeymap,
      defaultKeymap,
    } = cm;
    const ta = document.getElementById("prompt"),
      wrap = ta.parentElement;
    const proto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    const roProto = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "readOnly");
    const ro = new Compartment();
    let syncing = false;
    let rfq = 0;
    const refit = () => {
      if (rfq) return;
      rfq = requestAnimationFrame(() => {
        rfq = 0;
        window.layoutLeft && layoutLeft();
      });
    }; // text set from code never fired "input", so the card kept its old height

    /* decorations: comments, list markers (hanging), section labels, {variants}, <lora:...> tags */
    const LIST = /^(\s*)(\d+[.)]|[-*•])\s+/,
      LABEL = /^\s*[A-Za-zА-Яа-яЁё][\w \-/&А-Яа-яЁё]{0,28}:\s*$/,
      COMMENT = /^\s*\/\//;
    function build(view) {
      const b = new RangeSetBuilder();
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = view.state.doc.lineAt(pos),
            t = line.text;
          const marks = [];
          if (COMMENT.test(t)) b.add(line.from, line.from, Decoration.line({ class: "cm-ln-comment" }));
          else {
            const lm = t.match(LIST);
            if (lm) {
              b.add(line.from, line.from, Decoration.line({ class: "cm-ln-list" }));
              marks.push([line.from + lm[1].length, line.from + lm[0].length, Decoration.mark({ class: "cm-marker" })]);
            } else if (LABEL.test(t)) b.add(line.from, line.from, Decoration.line({ class: "cm-ln-label" }));
            for (const m of t.matchAll(/\{[^{}]*\|[^{}]*\}/g))
              marks.push([
                line.from + m.index,
                line.from + m.index + m[0].length,
                Decoration.mark({ class: "cm-variant" }),
              ]);
            for (const m of t.matchAll(/<lora:[^>]+>/g))
              marks.push([
                line.from + m.index,
                line.from + m.index + m[0].length,
                Decoration.mark({ class: "cm-lora" }),
              ]);
          }
          marks
            .sort((a, c) => a[0] - c[0])
            .forEach(([a, c, d]) => {
              if (c > a) b.add(a, c, d);
            });
          pos = line.to + 1;
        }
      }
      return b.finish();
    }
    const deco = ViewPlugin.fromClass(
      class {
        constructor(v) {
          this.decorations = build(v);
        }
        update(u) {
          if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
        }
      },
      { decorations: v => v.decorations },
    );

    /* Ctrl+/ toggles // on the selected lines */
    function toggleLineComment(view) {
      const s = view.state;
      const lines = new Set();
      for (const r of s.selection.ranges) {
        for (let l = s.doc.lineAt(r.from).number; l <= s.doc.lineAt(r.to).number; l++) lines.add(l);
      }
      const ls = [...lines].map(n => s.doc.line(n)).filter(l => l.text.trim());
      if (!ls.length) return true;
      const allC = ls.every(l => COMMENT.test(l.text));
      view.dispatch({
        changes: ls.map(l => {
          if (allC) {
            const m = l.text.match(/^(\s*)\/\/ ?/);
            return { from: l.from + m[1].length, to: l.from + m[0].length, insert: "" };
          }
          const ind = l.text.match(/^\s*/)[0].length;
          return { from: l.from + ind, insert: "// " };
        }),
      });
      return true;
    }

    /* the scrollbar's room is kept only while the text overflows: a prompt that fits has no gutter strip at all (on glass
    it flickered as the backdrop repainted). Sticky until clearly short again, so the edge of fitting doesn't toggle it */
    const edge = () => {
      const sc = view.scrollDOM;
      wrap.classList.toggle("scrolled", sc.scrollTop > 2);
      wrap.classList.toggle("more", sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2);
    }; /* the fades at the box's edges */
    const ovf = () => {
      const sc = view.scrollDOM,
        on = wrap.classList.contains("ovf"),
        o = sc.scrollHeight > sc.clientHeight + 1;
      if (o !== on && (o || view.dom.offsetHeight < wrap.clientHeight - 4))
        wrap.classList.toggle(
          "ovf",
          o,
        ); /* off once it fits AND the editor has room left in the box (it sizes to its text: "fits by N px" never happened) */
      edge();
    };
    const view = new EditorView({
      parent: wrap,
      state: EditorState.create({
        doc: proto.get.call(ta),
        extensions: [
          history(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "off", autocapitalize: "off" }),
          placeholder("Describe what you want to see…"),
          deco,
          ro.of(EditorState.readOnly.of(false)),
          keymap.of([
            { key: "Mod-/", run: toggleLineComment },
            {
              key: "Mod-Enter",
              run: () => {
                window.addJobs && addJobs();
                return true;
              },
            },
            ...historyKeymap,
            ...defaultKeymap.filter(k => k.key !== "Mod-Enter"),
          ]),
          EditorView.updateListener.of(u => {
            if (u.docChanged && !syncing) {
              proto.set.call(ta, u.state.doc.toString());
              ta.dispatchEvent(new Event("input"));
            }
            if (u.heightChanged || u.geometryChanged) refit();
            if (u.docChanged || u.heightChanged || u.geometryChanged) requestAnimationFrame(ovf);
          }),
          EditorView.domEventHandlers({
            keydown: (e, v) => {
              if (!ta.readOnly) return false;
              if (e.key === "Escape") {
                ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
                return true;
              }
              const mod = e.ctrlKey || e.metaKey,
                edit =
                  (e.key.length === 1 && !mod && !e.altKey) ||
                  e.key === "Backspace" ||
                  e.key === "Delete" ||
                  (e.key === "Enter" && !mod) ||
                  (mod && /^[vx]$/i.test(e.key));
              if (!edit) return false; /* copying, moving the cursor, selecting: not an edit */
              ta.dispatchEvent(
                new KeyboardEvent("keydown", { key: e.key, ctrlKey: e.ctrlKey }),
              ); /* Kiln makes this prompt your draft (Reuse prompt) */
              if (ta.readOnly) return true;
              /* now editable: the key does what it would have done. Typed text and paste go on to the editor as usual; the keys the
      keymap had already turned away (read-only then) are applied here */
              const sel = v.state.selection.main;
              if (e.key === "Enter") {
                v.dispatch(v.state.replaceSelection("\n"));
                return true;
              }
              if (e.key === "Backspace" || e.key === "Delete") {
                if (!sel.empty) v.dispatch(v.state.replaceSelection(""));
                else if (e.key === "Backspace" && sel.head > 0)
                  v.dispatch({ changes: { from: sel.head - 1, to: sel.head } });
                else if (e.key === "Delete" && sel.head < v.state.doc.length)
                  v.dispatch({ changes: { from: sel.head, to: sel.head + 1 } });
                return true;
              }
              return false;
            },
          }),
        ],
      }),
    });
    wrap.insertBefore(view.dom, ta);
    wrap.classList.add("cm-on");
    requestAnimationFrame(() => window.layoutLeft && layoutLeft()); // the card was sized for the plain textarea

    /* keep the old textarea API working: P.value / P.readOnly / P.focus / P.classList("peek") drive the editor */
    Object.defineProperty(ta, "value", {
      get() {
        return proto.get.call(ta);
      },
      set(v) {
        proto.set.call(ta, v);
        const cur = view.state.doc.toString();
        if (cur !== v) {
          syncing = true;
          view.dispatch({ changes: { from: 0, to: cur.length, insert: v } });
          syncing = false;
        }
      },
    });
    Object.defineProperty(ta, "readOnly", {
      get() {
        return roProto.get.call(ta);
      },
      set(v) {
        roProto.set.call(ta, v);
        view.dispatch({ effects: ro.reconfigure(EditorState.readOnly.of(!!v)) });
      },
    });
    ta.focus = () => view.focus();
    addEventListener("resize", () => view.requestMeasure());
    /* the card animates its size (ratio change, browsing): measure again once it has settled, or a stale height leaves a
    scrollbar showing until the next keystroke */
    {
      let t = null;
      new ResizeObserver(() => {
        clearTimeout(t);
        t = setTimeout(() => view.requestMeasure(), 120);
      }).observe(wrap);
      $("left").addEventListener("transitionend", () => view.requestMeasure());
    }
    document.fonts && document.fonts.ready.then(() => view.requestMeasure());
    new MutationObserver(() => view.dom.classList.toggle("peek", ta.classList.contains("peek"))).observe(ta, {
      attributes: true,
      attributeFilter: ["class"],
    });
    Object.defineProperty(ta, "scrollTop", {
      get() {
        return view.scrollDOM.scrollTop;
      },
      set(v) {
        view.scrollDOM.scrollTop = v;
      },
    });
    view.scrollDOM.addEventListener("scroll", edge, { passive: true });
    window.__cm = view;
  }
}
