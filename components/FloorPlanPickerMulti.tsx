"use client";

import { useState } from "react";
import FloorPlanPicker from "./FloorPlanPicker";

type BookedTableInfo = {
  tableId: string;
  guestName: string;
  groupSize?: number;
};

type Props = {
  /** Current value as stored in DB: "V2" or "V2+V3" or "" */
  value: string;
  onChange: (val: string) => void;
  bookedTables: Set<string>;
  /** Detailed info about each booked table for guest preview labels */
  bookedTableInfo?: Map<string, BookedTableInfo>;
  onConflict?: (tableId: string) => boolean;
  /** When > 6, multi-table mode is auto-enabled with a hint */
  groupSize?: number;
};

/**
 * Multi-table selector. Reuses the visual FloorPlanPicker but tracks
 * multiple selected tables internally. When the user clicks a table:
 *  - In single-mode (party ≤ 6): replaces selection
 *  - In multi-mode (party > 6 OR multi-mode toggle enabled): adds/removes from selection
 *
 * Stored format: "V2" (single) or "V2+V3" (multiple, joined by +)
 */
export default function FloorPlanPickerMulti({ value, onChange, bookedTables, bookedTableInfo, onConflict, groupSize = 1 }: Props) {
  // Auto-enable multi-mode when party size > 6, but allow user to manually toggle on too
  const [manualMulti, setManualMulti] = useState(false);
  const autoMulti = (groupSize || 1) > 6;
  const multiMode = autoMulti || manualMulti;

  const selectedTables = value
    ? value.split("+").map((t) => t.trim()).filter(Boolean)
    : [];

  function handlePick(tableId: string) {
    if (!multiMode) {
      // single mode: just set/clear
      if (selectedTables[0] === tableId) {
        onChange(""); // toggle off
      } else {
        onChange(tableId);
      }
      return;
    }

    // multi mode: add/remove from list
    if (selectedTables.includes(tableId)) {
      const next = selectedTables.filter((t) => t !== tableId);
      onChange(next.join("+"));
    } else {
      const next = [...selectedTables, tableId];
      onChange(next.join("+"));
    }
  }

  // Pass the "primary" selected (first one) to the visual picker
  // The picker internally only highlights one — we'll add visual indicators below for the others
  const primarySelected = selectedTables[0] || "";

  return (
    <div className="space-y-3">
      {/* Multi-mode banner */}
      {autoMulti && (
        <div className="bg-tantra-red/10 border border-tantra-red/40 text-tantra-red text-xs px-4 py-2.5 flex items-start gap-2">
          <span className="font-bold">📐</span>
          <span>
            Party of {groupSize} — large groups usually need 2+ tables. Tap multiple tables on the floor plan to combine them.
          </span>
        </div>
      )}

      {!autoMulti && (
        <div className="flex items-center justify-between bg-deep tantra-border px-3 py-2">
          <span className="text-xs text-muted">Need multiple tables?</span>
          <button
            type="button"
            onClick={() => {
              setManualMulti(!manualMulti);
              // When turning off multi-mode, keep only first table
              if (manualMulti && selectedTables.length > 1) {
                onChange(selectedTables[0] || "");
              }
            }}
            className={`px-3 py-1 text-xs font-bold tracking-widest border transition ${
              manualMulti ? "bg-tantra-red border-tantra-red text-white" : "border-[var(--border)] text-muted hover:border-[var(--border-strong)]"
            }`}
          >
            {manualMulti ? "MULTI: ON" : "MULTI: OFF"}
          </button>
        </div>
      )}

      {/* The visual floor plan — uses primary selected for the highlight */}
      <FloorPlanPicker
        value={primarySelected}
        onChange={handlePick}
        bookedTables={bookedTables}
        onConflict={onConflict}
      />

      {/* Booked tables guide for selected date — shows who has each booked table */}
      {bookedTableInfo && bookedTableInfo.size > 0 && (
        <div className="bg-deep tantra-border p-3">
          <div className="label text-xs mb-2 text-muted">BOOKED FOR THIS DATE ({bookedTableInfo.size})</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {Array.from(bookedTableInfo.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tableId, info]) => (
                <div
                  key={tableId}
                  className="flex items-center gap-2 bg-card border border-[var(--border)] px-2 py-1.5 text-xs"
                  title={`${info.guestName} · ${info.groupSize || 0} guests`}
                >
                  <span className="inline-block bg-tantra-red/20 border border-tantra-red text-tantra-red font-bold px-1.5 py-0.5 text-[10px] tracking-wider flex-shrink-0">
                    {tableId.startsWith("T3B") ? "T3" : tableId}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-default truncate font-semibold">{info.guestName}</div>
                    {info.groupSize !== undefined && (
                      <div className="text-subtle text-[10px] leading-tight">· {info.groupSize}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Selected tables summary (shown when multi-mode active OR multiple tables picked) */}
      {(multiMode || selectedTables.length > 1) && selectedTables.length > 0 && (
        <div className="bg-deep border border-tantra-red px-4 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="label text-tantra-red mb-1.5">SELECTED TABLES ({selectedTables.length})</div>
              <div className="flex flex-wrap gap-2">
                {selectedTables.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handlePick(t)}
                    className="inline-flex items-center gap-1.5 bg-tantra-red text-white px-3 py-1.5 text-xs font-bold tracking-wide hover:bg-tantra-red/80 transition"
                    title={`Click to remove ${t.startsWith("T3B") ? "T3" : t}`}
                  >
                    <span>{t.startsWith("T3B") ? "T3" : t}</span>
                    <span className="text-white/70 text-xs">×</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted mt-2">
                Stored as: <span className="font-mono text-default">{selectedTables.join("+")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs text-muted hover:text-tantra-red"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
