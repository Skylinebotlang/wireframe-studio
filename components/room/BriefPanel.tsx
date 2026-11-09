"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN BRIEF PANEL — opened from the "Brief" button in the top bar.
//
// The team's own design rules for this board. "Make it real" follows them on
// every screen (the server reads the saved brief itself):
//   • Brand basics: colour palette (any of 8 slots) + font (forced into
//     every design; empty slots the AI picks), logo
//   • Design document, Always do / Never do (one rule per line)
//   • Reference pictures (up to 5), each with a note: what to take from it
//   • Locked style: set with "Lock this style" on a design; Unlock here
//   • Import from Figma: reads a file's published colour and text styles
//     and fills in the brand basics (you check, then Save)
//
// Text and brand basics are saved with "Save brief"; pictures and Unlock are
// saved straight away. Owner and editors can change it; everyone else sees
// it read-only (the server checks too: app/api/boards/brief). Uses the
// browser's own <dialog>: it keeps focus inside, and Esc closes it.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FONT_IDS,
  MAX_DOC_CHARS,
  MAX_IMAGE_BASE64,
  MAX_NOTE_CHARS,
  MAX_REFERENCES,
  MAX_RULES,
  PALETTE,
  type BrandColors,
  type FontId,
} from "@/lib/design/brief";
import type { StyleGuide } from "@/lib/design/agent-design";

type Picture = { id: string; kind: "logo" | "reference"; note: string; dataUrl: string };
type Loaded = {
  doc: string;
  dos: string;
  donts: string;
  brandColors: BrandColors;
  brandFont: FontId | "";
  lockedStyle: StyleGuide | null;
  by: string;
  at: string;
  canEdit: boolean;
  images: Picture[];
};
type Status = { kind: "" | "saving" | "saved" | "error"; text?: string };

const FIELD =
  "block w-full rounded-lg border border-line bg-raised/40 px-3 py-2 text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted focus:border-accent-bright disabled:opacity-70";
const LABEL = "mb-1 block font-mono text-[11px] uppercase tracking-widest text-muted";
const SMALL_BUTTON =
  "h-8 shrink-0 rounded-lg border border-line bg-raised/40 px-3 text-xs text-ink transition-colors hover:border-accent-bright/70 hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright";
const FONT_NAMES: Record<FontId, string> = { sans: "Clean sans-serif", serif: "Classic serif", rounded: "Friendly rounded", mono: "Techy monospace" };

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

async function api(path: string, method: string, body?: object) {
  const res = await fetch(path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

// Shown only while open (RoomBar mounts it), so each opening starts fresh.
export function BriefPanel({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "" });

  const load = useCallback(async () => {
    const body = await api(`/api/boards/brief?boardId=${encodeURIComponent(boardId)}`, "GET");
    const b = body.brief;
    return {
      doc: b.doc,
      dos: b.dos.join("\n"),
      donts: b.donts.join("\n"),
      brandColors: b.brandColors,
      brandFont: b.brandFont,
      lockedStyle: b.lockedStyle,
      by: b.updatedByName,
      at: b.updatedAt,
      canEdit: body.canEdit,
      images: body.images,
    } as Loaded;
  }, [boardId]);

  // Open the dialog and load the brief.
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    let gone = false;
    load()
      .then((loaded) => !gone && setData(loaded))
      .catch((err) => !gone && setStatus({ kind: "error", text: err.message }));
    return () => {
      gone = true;
    };
  }, [load]);

  // Pictures and Unlock save at once, then the brief reloads (keeping any
  // unsaved text the person typed meanwhile).
  async function now(work: () => Promise<unknown>, done: string) {
    setStatus({ kind: "saving" });
    try {
      await work();
      const fresh = await load();
      setData((d) => (d ? { ...d, images: fresh.images, lockedStyle: fresh.lockedStyle } : fresh));
      setStatus({ kind: "saved", text: done });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  }

  async function save() {
    if (!data) return;
    setStatus({ kind: "saving" });
    try {
      await api("/api/boards/brief", "PUT", {
        boardId,
        doc: data.doc,
        dos: lines(data.dos),
        donts: lines(data.donts),
        brandColors: data.brandColors,
        brandFont: data.brandFont,
      });
      setStatus({ kind: "saved", text: "Saved. Make it real uses it from the next design on." });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
  }

  const edit = (patch: Partial<Loaded>) => {
    setData((d) => (d ? { ...d, ...patch } : d));
    setStatus({ kind: "" });
  };
  const readOnly = !data?.canEdit;
  const busy = status.kind === "saving";
  const logo = data?.images.find((i) => i.kind === "logo");
  const refs = data?.images.filter((i) => i.kind === "reference") ?? [];

  async function addPicture(kind: Picture["kind"], file: File | undefined) {
    if (!file) return;
    const dataUrl = await shrink(file, kind === "logo").catch(() => null);
    if (!dataUrl) return setStatus({ kind: "error", text: "Couldn't read that picture. Try a JPEG or PNG." });
    await now(() => api("/api/boards/brief/images", "POST", { boardId, kind, note: "", dataUrl }), kind === "logo" ? "Logo saved." : "Picture added.");
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()} // click on the backdrop
      aria-labelledby="brief-title"
      className="m-auto w-[620px] max-w-[calc(100vw-32px)] rounded-xl border border-line bg-surface p-0 text-ink shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop:bg-black/60"
    >
      <div className="flex max-h-[calc(100vh-64px)] flex-col">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-4">
          <div>
            <h2 id="brief-title" className="text-[15px] font-semibold">
              Design brief
            </h2>
            <p className="mt-0.5 text-xs text-muted">Make it real follows this on every screen of this board.</p>
          </div>
          <button
            type="button"
            aria-label="Close design brief"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {!data && status.kind !== "error" && <p className="text-xs text-muted">Loading…</p>}
          {data && readOnly && (
            <p className="rounded-lg border border-line bg-raised/40 px-3 py-2 text-xs text-muted">
              Only editors and the owner can change the brief. Ask the owner (Team, top right) if you need to.
            </p>
          )}
          {data && (
            <>
              {/* ── Locked style ─────────────────────────────────────────── */}
              {data.lockedStyle && (
                <Section title="Locked style">
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-raised/40 p-3">
                    <Swatches guide={data.lockedStyle} />
                    <p className="min-w-0 flex-1 text-xs text-muted">
                      {data.lockedStyle.product ? `${data.lockedStyle.product} · ` : ""}
                      {FONT_NAMES[data.lockedStyle.font]}. Every Make it real uses this style.
                    </p>
                    {!readOnly && (
                      <button
                        type="button"
                        disabled={busy}
                        className={SMALL_BUTTON}
                        onClick={() => now(() => api("/api/boards/brief", "PATCH", { boardId, lockedStyle: null }), "Unlocked. Make it real picks a style again.")}
                      >
                        Unlock
                      </button>
                    )}
                  </div>
                </Section>
              )}

              {/* ── Brand basics ─────────────────────────────────────────── */}
              <Section title="Brand basics" hint="Forced into every design, whatever the AI picks.">
                <Palette
                  colors={data.brandColors}
                  readOnly={readOnly}
                  onChange={(brandColors) => edit({ brandColors })}
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="brief-font" className={LABEL}>
                      Font
                    </label>
                    <select
                      id="brief-font"
                      value={data.brandFont}
                      onChange={(e) => edit({ brandFont: e.target.value as FontId | "" })}
                      disabled={readOnly}
                      className={`${FIELD} h-9 py-0`}
                    >
                      <option value="">None (AI picks)</option>
                      {FONT_IDS.map((f) => (
                        <option key={f} value={f}>
                          {FONT_NAMES[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className={LABEL}>Logo</span>
                    <div className="flex items-center gap-2">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise
                        <img src={logo.dataUrl} alt="Logo" className="h-9 w-9 shrink-0 rounded-lg border border-line bg-white object-contain" />
                      ) : (
                        <span className="text-xs text-muted">None</span>
                      )}
                      {!readOnly && (
                        <>
                          <FileButton label={logo ? "Replace" : "Upload"} disabled={busy} onFile={(f) => addPicture("logo", f)} />
                          {logo && (
                            <button
                              type="button"
                              className="text-xs text-muted underline hover:text-ink"
                              onClick={() => now(() => api("/api/boards/brief/images", "DELETE", { boardId, id: logo.id }), "Logo removed.")}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                {!readOnly && <FigmaImport boardId={boardId} colors={data.brandColors} onPick={(patch) => edit(patch)} />}
              </Section>

              {/* ── Design document + rules ──────────────────────────────── */}
              <Section title="Design document">
                <textarea
                  aria-label="Design document"
                  value={data.doc}
                  onChange={(e) => edit({ doc: e.target.value })}
                  disabled={readOnly}
                  rows={7}
                  maxLength={MAX_DOC_CHARS}
                  placeholder={"Who it's for, the brand, the feel, tone…\ne.g. A calm banking app for students. Lots of white space, friendly but never cute."}
                  className={`${FIELD} resize-y`}
                />
                <p className="mt-1 text-right font-mono text-[11px] text-muted">
                  {data.doc.length} / {MAX_DOC_CHARS}
                </p>
              </Section>
              <div className="grid gap-4 sm:grid-cols-2">
                <RuleList
                  id="brief-dos"
                  title="Always do"
                  value={data.dos}
                  onChange={(dos) => edit({ dos })}
                  readOnly={readOnly}
                  placeholder={"Back button on every screen\nBig, clear prices"}
                />
                <RuleList
                  id="brief-donts"
                  title="Never do"
                  value={data.donts}
                  onChange={(donts) => edit({ donts })}
                  readOnly={readOnly}
                  placeholder={"No gradients\nNo stock-photo people"}
                />
              </div>

              {/* ── Reference pictures ───────────────────────────────────── */}
              <Section
                title={`Reference pictures · ${refs.length}/${MAX_REFERENCES}`}
                hint="Screens or moodboards you like. Say what to take from each; the AI never copies them. Saved straight away."
              >
                {refs.length > 0 && (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {refs.map((r) => (
                      <ReferenceRow
                        key={r.id}
                        picture={r}
                        readOnly={readOnly}
                        onNote={(note) =>
                          note !== r.note && now(() => api("/api/boards/brief/images", "PATCH", { boardId, id: r.id, note }), "Note saved.")
                        }
                        onRemove={() => now(() => api("/api/boards/brief/images", "DELETE", { boardId, id: r.id }), "Picture removed.")}
                      />
                    ))}
                  </ul>
                )}
                {!readOnly && refs.length < MAX_REFERENCES && (
                  <div className={refs.length ? "mt-3" : ""}>
                    <FileButton label="Add a picture" disabled={busy} onFile={(f) => addPicture("reference", f)} />
                  </div>
                )}
                {readOnly && refs.length === 0 && <p className="text-xs text-muted">None yet.</p>}
              </Section>

              {data.by && (
                <p className="text-[11px] text-muted">
                  Last changed by {data.by}
                  {data.at ? ` · ${new Date(data.at).toLocaleString()}` : ""}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p role="status" className={`min-w-0 text-xs ${status.kind === "error" ? "text-rose" : "text-muted"}`}>
            {status.kind === "saving" ? "Saving…" : status.text ?? ""}
          </p>
          {data?.canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="h-9 shrink-0 rounded-lg bg-accent px-4 text-xs font-medium text-ink transition hover:brightness-125 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
            >
              Save brief
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={LABEL}>{title}</h3>
      {hint && <p className="-mt-0.5 mb-2 text-[11px] text-muted">{hint}</p>}
      {children}
    </section>
  );
}

function RuleList(props: { id: string; title: string; value: string; onChange: (v: string) => void; readOnly: boolean; placeholder: string }) {
  const tooMany = lines(props.value).length > MAX_RULES;
  return (
    <div>
      <label htmlFor={props.id} className={LABEL}>
        {props.title}
      </label>
      <textarea
        id={props.id}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.readOnly}
        rows={5}
        placeholder={props.placeholder}
        className={`${FIELD} resize-y`}
      />
      <p className={`mt-1 text-[11px] ${tooMany ? "text-rose" : "text-muted"}`}>
        One rule per line{tooMany ? ` · only the first ${MAX_RULES} are used` : ""}
      </p>
    </div>
  );
}

// One reference picture: thumbnail, its note (saved when you leave the box), remove.
function ReferenceRow({
  picture,
  readOnly,
  onNote,
  onRemove,
}: {
  picture: Picture;
  readOnly: boolean;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const [note, setNote] = useState(picture.note);
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-raised/40 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
      <img src={picture.dataUrl} alt={picture.note || "Reference picture"} className="h-20 w-16 shrink-0 rounded-md object-cover" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <textarea
          aria-label="What to take from this picture"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onNote(note.trim())}
          disabled={readOnly}
          maxLength={MAX_NOTE_CHARS}
          rows={2}
          placeholder="What to take from it, e.g. the card style"
          className={`${FIELD} resize-none px-2 py-1 text-xs`}
        />
        {!readOnly && (
          <button type="button" onClick={onRemove} className="self-start text-[11px] text-muted underline hover:text-ink">
            Remove
          </button>
        )}
      </div>
    </li>
  );
}

// A button that opens the file picker (JPEG / PNG).
function FileButton({ label, disabled, onFile }: { label: string; disabled: boolean; onFile: (f: File | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={disabled} className={SMALL_BUTTON} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = ""; // the same file can be picked again
        }}
      />
    </>
  );
}

// The 8 colour slots of the palette. Empty = the AI picks that one.
function Palette({ colors, readOnly, onChange }: { colors: BrandColors; readOnly: boolean; onChange: (c: BrandColors) => void }) {
  const set = (key: keyof BrandColors, hex: string | null) => {
    const next = { ...colors };
    if (hex) next[key] = hex;
    else delete next[key];
    onChange(next);
  };
  return (
    <div>
      <span className={LABEL}>Colour palette</span>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PALETTE.map(({ key, name, hint }) => {
          const hex = colors[key];
          const id = `brief-color-${key}`;
          return (
            <li key={key} className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/40 px-2 py-1.5">
              <input
                id={id}
                type="color"
                value={hex ?? "#808080"}
                onChange={(e) => set(key, e.target.value)}
                disabled={readOnly}
                aria-describedby={`${id}-hint`}
                className={`h-8 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-transparent p-0.5 disabled:cursor-not-allowed ${hex ? "" : "opacity-40"}`}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={id} className="block text-xs text-ink">
                  {name}
                </label>
                <p id={`${id}-hint`} className="truncate text-[11px] text-muted" title={hint}>
                  {hex ? <span className="font-mono">{hex}</span> : "AI picks"} · {hint}
                </p>
              </div>
              {hex && !readOnly && (
                <button
                  type="button"
                  aria-label={`Clear ${name}`}
                  onClick={() => set(key, null)}
                  className="shrink-0 text-[11px] text-muted underline hover:text-ink"
                >
                  Clear
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted">
        Set only the ones you care about. If a text colour would be hard to read on its background, it&apos;s switched to dark or
        white so screens stay readable. No orange: it&apos;s the AI&apos;s colour.
      </p>
    </div>
  );
}

function Swatches({ guide }: { guide: StyleGuide }) {
  const keys = ["primary", "accent", "background", "surface", "text"] as const;
  return (
    <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
      {keys.map((k) => (
        <span key={k} title={`${k} ${guide.colors[k]}`} className="h-7 w-7" style={{ background: guide.colors[k] }} />
      ))}
    </span>
  );
}

// ── Import from Figma ────────────────────────────────────────────────────────
// The token is the person's own Figma personal access token: sent to our
// server for this one import, never saved (not even in this browser).
function FigmaImport({
  boardId,
  colors,
  onPick,
}: {
  boardId: string;
  colors: BrandColors; // the palette now, so a clicked swatch only changes the main colour
  onPick: (patch: { brandColors?: BrandColors; brandFont?: FontId | "" }) => void;
}) {
  const [openForm, setOpenForm] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; colors?: { name: string; hex: string }[]; font?: string }>({});

  async function run() {
    setState({ busy: true });
    try {
      const r = await api("/api/boards/brief/figma", "POST", { boardId, fileUrl, token });
      setToken(""); // done with it
      onPick({
        ...(Object.keys(r.brandColors ?? {}).length ? { brandColors: r.brandColors } : {}),
        ...(r.brandFont ? { brandFont: r.brandFont } : {}),
      });
      setState({ colors: r.colors, font: r.fontFamily });
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  }

  if (!openForm) {
    return (
      <button type="button" className="mt-3 text-xs text-muted underline hover:text-ink" onClick={() => setOpenForm(true)}>
        Import colours and font from Figma…
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-raised/40 p-3">
      <p className="text-[11px] text-muted">
        Reads the file&apos;s published colour and text styles. Make a token in Figma: Settings → Security → Personal access tokens (read
        access to files). It&apos;s used once and never saved.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          aria-label="Figma file link"
          value={fileUrl}
          onChange={(e) => setFileUrl(e.target.value)}
          placeholder="https://www.figma.com/design/…"
          className={`${FIELD} h-9 py-0`}
        />
        <input
          aria-label="Figma personal access token"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Personal access token"
          className={`${FIELD} h-9 py-0`}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={SMALL_BUTTON} disabled={state.busy || !fileUrl.trim() || !token.trim()} onClick={run}>
          {state.busy ? "Reading…" : "Import"}
        </button>
        {state.error && <p className="text-xs text-rose">{state.error}</p>}
        {state.font !== undefined && !state.error && (
          <p className="text-xs text-muted">
            Filled in the brand basics{state.font ? ` (font: ${state.font})` : ""}. Check them, then Save brief.
          </p>
        )}
      </div>
      {state.colors && state.colors.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] text-muted">Colours in the file. Click one to make it the main colour:</p>
          <div className="flex flex-wrap gap-1.5">
            {state.colors.map((c) => (
              <button
                key={`${c.name}${c.hex}`}
                type="button"
                title={`${c.name} ${c.hex}`}
                aria-label={`Use ${c.name} (${c.hex}) as the main colour`}
                onClick={() => onPick({ brandColors: { ...colors, primary: c.hex } })}
                className="h-7 w-7 rounded-md border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright"
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shrink a picture in the browser before upload: references → JPEG up to
 * 768 px; the logo → PNG up to 512 px (keeps its transparent background).
 */
async function shrink(file: File, keepPng: boolean): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = keepPng ? 512 : 768;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = keepPng ? canvas.toDataURL("image/png") : "";
  // A detailed logo can make a big PNG: fall back to JPEG to stay under the limit.
  return png && png.length < MAX_IMAGE_BASE64 ? png : canvas.toDataURL("image/jpeg", 0.82);
}
