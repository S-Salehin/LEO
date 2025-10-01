import React, { useRef, useState } from "react";

/** Lightweight TLE importer.
 *  - Drag & drop or pick a .tle/.txt file
 *  - Parses 3-line TLE blocks (name, L1, L2)
 *  - Dispatches a window event "tle:imported" with { list }
 *  - Globe3D listens and rebuilds satellites in-place
 */
export default function TLEImport() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  function parseTLEText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i + 2 < lines.length; ) {
      const n = lines[i], l1 = lines[i + 1], l2 = lines[i + 2];
      if (l1?.startsWith("1 ") && l2?.startsWith("2 ")) {
        out.push({ name: n, l1, l2 });
        i += 3;
      } else {
        i += 1;
      }
    }
    return out;
  }

  async function handleFiles(files) {
    if (!files || !files.length) return;
    const file = files[0];
    setName(file.name);
    const txt = await file.text();
    const list = parseTLEText(txt);
    setCount(list.length);

    // Broadcast to the globe
    window.dispatchEvent(new CustomEvent("tle:imported", { detail: { list } }));
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div style={{
      background: "rgba(14,23,38,.55)",
      border: "1px solid rgba(148,163,184,.15)",
      borderRadius: 10, padding: 12, color: "#cbd5e1"
    }}>
      <div style={{fontWeight: 600, marginBottom: 8}}>Import TLE</div>
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        style={{
          border: "1px dashed rgba(148,163,184,.35)",
          borderRadius: 8, padding: 12, textAlign: "center",
          background: "rgba(2,6,23,.35)", cursor: "pointer"
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{fontSize: 12, opacity: 0.85}}>
          Drag & drop a <b>.tle</b> (or click to choose)
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".tle,.txt"
          style={{display:"none"}}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div style={{marginTop: 8, fontSize: 12, opacity: 0.9}}>
        {count > 0
          ? <>Loaded <b>{count}</b> TLEs from <i>{name}</i>. Globe updated.</>
          : <>Tip: You can also use <code>public/tle/custom.tle</code> as default.</>}
      </div>
    </div>
  );
}
