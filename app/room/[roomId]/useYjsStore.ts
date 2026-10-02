"use client";

// ─────────────────────────────────────────────────────────────────────────────
// THE BRIDGE — how tldraw (the canvas) and Liveblocks (the network) talk.
//
// tldraw is a whiteboard that keeps its drawings in a "store" (a big map of
// shapes, pages, camera positions…). By itself, that store lives in ONE
// browser. This file keeps a Liveblocks/Yjs document in perfect sync with
// that store, so every browser in the room sees the same shapes and cursors.
//
// How it works, in one breath:
//   tldraw store changes  →  we copy them into the Yjs document
//   Yjs document changes  →  we copy them back into the tldraw store
//   cursor positions      →  shared via Liveblocks "awareness" (ephemeral,
//                            never saved — like a video call, not a document)
//
// This file is adapted from Liveblocks' official tldraw example, with
// plain-language comments added. You should not need to modify it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";
import { YKeyValue } from "y-utility/y-keyvalue";
import * as Y from "yjs";
import {
  computed,
  createPresenceStateDerivation,
  createTLStore,
  defaultShapeUtils,
  InstancePresenceRecordType,
  react,
  transact,
  TLAnyShapeUtilConstructor,
  TLInstancePresence,
  TLRecord,
  TLStoreWithStatus,
  TLUserPreferences,
} from "tldraw";

export function useYjsStore({
  shapeUtils = [],
  user,
}: {
  shapeUtils?: TLAnyShapeUtilConstructor[];
  user: { id: string; color: string; name: string };
}) {
  // The Liveblocks room this browser joined (set up in Room.tsx).
  const room = useRoom();

  // ── 1. Create the shared Yjs document ──────────────────────────────────────
  // getYjsProviderForRoom gives us a Yjs document that Liveblocks syncs to
  // the cloud and broadcasts to everyone in the room. Inside it we keep one
  // array of "records" (tldraw's shapes/pages/cameras) managed by YKeyValue,
  // which stores data as key→value pairs (efficient for frequent updates).
  const { yDoc, yStore, yProvider } = useMemo(() => {
    const yProvider = getYjsProviderForRoom(room);
    const yDoc = yProvider.getYDoc();
    yDoc.gc = true; // let Yjs merge/delete old tombstones to stay small
    const yArr = yDoc.getArray<{ key: string; val: TLRecord }>("tl_records");
    const yStore = new YKeyValue(yArr);
    return { yDoc, yStore, yProvider };
  }, [room]);

  // ── 2. Create the local tldraw store ───────────────────────────────────────
  // defaultShapeUtils = tldraw's built-in shapes (rect, ellipse, text…).
  // `shapeUtils` is where OUR custom shapes will go in Milestone 2 (notes).
  const [store] = useState(() => {
    return createTLStore({
      shapeUtils: [...defaultShapeUtils, ...shapeUtils],
    });
  });

  // "storeWithStatus" tells the <Tldraw> component whether the store is
  // still loading or ready to draw.
  const [storeWithStatus, setStoreWithStatus] = useState<TLStoreWithStatus>({
    status: "loading",
  });

  // ── 3. Connect the two, once the room has finished loading ────────────────
  useEffect(() => {
    setStoreWithStatus({ status: "loading" });
    const unsubs: (() => void)[] = [];

    function handleSync() {
      // === DOCUMENT (shapes, pages, cameras — persistent) =================

      // If the room already has shapes, load them into this browser.
      // If not, seed the room with this browser's fresh empty store.
      if (yStore.yarray.length) {
        const records = yStore.yarray.toJSON().map(({ val }) => val);
        const roomIds = new Set(records.map((r) => r.id));
        transact(() => {
          // Replace only the DOCUMENT records (shapes, pages). We must not
          // wipe this browser's session records (current page, camera…):
          // if the canvas is already on screen (e.g. after a hot reload),
          // tldraw crashes with "reading 'currentPageId'" when they vanish.
          const stale = store
            .allRecords()
            .filter((r) => store.scopedTypes.document.has(r.typeName) && !roomIds.has(r.id))
            .map((r) => r.id);
          store.remove(stale);
          store.put(records);
        });
      } else {
        yDoc.transact(() => {
          for (const record of store.allRecords()) {
            yStore.set(record.id, record);
          }
        });
      }

      // Direction A: tldraw → Yjs.
      // Whenever the user draws/moves/erases, copy the change into Yjs,
      // which Liveblocks broadcasts to everyone else.
      unsubs.push(
        store.listen(
          function syncStoreChangesToYjsDoc({ changes }) {
            yDoc.transact(() => {
              Object.values(changes.added).forEach((record) => {
                yStore.set(record.id, record);
              });
              Object.values(changes.updated).forEach(([_, record]) => {
                yStore.set(record.id, record);
              });
              Object.values(changes.removed).forEach((record) => {
                yStore.delete(record.id);
              });
            });
          },
          // Only forward changes made HERE (not echoes of remote changes),
          // and only document records (shapes/pages), not session state.
          { source: "user", scope: "document" }
        )
      );

      // Direction B: Yjs → tldraw.
      // When other people's changes arrive, apply them to our canvas
      // inside mergeRemoteChanges, which tells tldraw "this came from the
      // network" so it doesn't get re-broadcast (no infinite loops).
      const handleChange = (
        changes: Map<
          string,
          | { action: "delete"; oldValue: TLRecord }
          | { action: "update"; oldValue: TLRecord; newValue: TLRecord }
          | { action: "add"; newValue: TLRecord }
        >,
        transaction: Y.Transaction
      ) => {
        if (transaction.local) return; // we already handled our own changes
        const toRemove: TLRecord["id"][] = [];
        const toPut: TLRecord[] = [];
        changes.forEach((change, id) => {
          switch (change.action) {
            case "add":
            case "update": {
              toPut.push(yStore.get(id)!);
              break;
            }
            case "delete": {
              toRemove.push(id as TLRecord["id"]);
              break;
            }
          }
        });
        store.mergeRemoteChanges(() => {
          if (toRemove.length) store.remove(toRemove);
          if (toPut.length) store.put(toPut);
        });
      };
      yStore.on("change", handleChange);
      unsubs.push(() => yStore.off("change", handleChange));

      // === PRESENCE (cursors, selections — ephemeral) ======================

      // Tell tldraw who THIS user is (drives cursor color/name).
      const userPreferences = computed<TLUserPreferences>(
        "userPreferences",
        () => ({ id: user.id, color: user.color, name: user.name })
      );

      // Liveblocks gives this connection a unique yjs client id; tldraw
      // needs presence records with a matching unique id.
      const self = room.getSelf();
      const yClientId = (self?.presence as any)?.__yjs_clientid;
      const presenceId = InstancePresenceRecordType.createId(yClientId);

      // presenceDerivation computes our current cursor state from the store.
      const presenceDerivation = createPresenceStateDerivation(
        userPreferences,
        presenceId
      )(store);

      // Publish our presence to everyone (awareness = live, not saved).
      yProvider.awareness.setLocalStateField(
        "presence",
        (presenceDerivation.get() ?? null) as any
      );

      // Keep publishing whenever our cursor/selection changes.
      unsubs.push(
        react("when presence changes", () => {
          const presence = presenceDerivation.get() ?? null;
          requestAnimationFrame(() => {
            yProvider.awareness.setLocalStateField(
              "presence",
              presence as any
            );
          });
        })
      );

      // Receive everyone else's presence and show their cursors.
      const handleUpdate = (update: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const states = yProvider.awareness.getStates() as Map<
          number,
          { presence: TLInstancePresence }
        >;
        const toRemove: TLInstancePresence["id"][] = [];
        const toPut: TLInstancePresence[] = [];

        for (const clientId of update.added) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            toPut.push(state.presence);
          }
        }
        for (const clientId of update.updated) {
          const state = states.get(clientId);
          if (state?.presence && state.presence.id !== presenceId) {
            toPut.push(state.presence);
          }
        }
        for (const clientId of update.removed) {
          toRemove.push(InstancePresenceRecordType.createId(clientId.toString()));
        }

        store.mergeRemoteChanges(() => {
          if (toRemove.length > 0) store.remove(toRemove);
          if (toPut.length > 0) store.put(toPut);
        });
      };
      yProvider.awareness.on("change", handleUpdate);
      unsubs.push(() => yProvider.awareness.off("change", handleUpdate));

      // Everything is wired up — tell tldraw to render!
      setStoreWithStatus({
        store,
        status: "synced-remote",
        connectionStatus: "online",
      });
    }

    // The provider fires "synced" once it has loaded the room's saved data.
    if (yProvider.synced) {
      handleSync();
    } else {
      yProvider.on("synced", handleSync);
      unsubs.push(() => yProvider.off("synced", handleSync));
    }

    // Cleanup: detach all listeners when leaving the room.
    return () => {
      unsubs.forEach((fn) => fn());
      unsubs.length = 0;
    };
  }, [yProvider, yDoc, store, yStore, room, user]);

  return storeWithStatus;
}
