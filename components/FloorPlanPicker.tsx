"use client";

import { useState } from "react";

// Table definitions — sketch-based layout from Tantra floor plan
// Coordinates are in a 400×560 viewBox (portrait orientation)
type TableDef = {
  id: string;
  label: string;
  section: "vip" | "terraza";
  x: number;
  y: number;
  width: number;
  height: number;
};

const TABLES: TableDef[] = [
  // VIP top row (V2, V3, V4) — left side
  { id: "V2", label: "V2", section: "vip", x: 70, y: 90, width: 50, height: 40 },
  { id: "V3", label: "V3", section: "vip", x: 130, y: 90, width: 50, height: 40 },
  { id: "V4", label: "V4", section: "vip", x: 190, y: 90, width: 50, height: 40 },

  // VIP right column (V5, V6, V7) — stacked
  { id: "V5", label: "V5", section: "vip", x: 320, y: 20, width: 50, height: 55 },
  { id: "V6", label: "V6", section: "vip", x: 320, y: 85, width: 50, height: 55 },
  { id: "V7", label: "V7", section: "vip", x: 320, y: 150, width: 50, height: 55 },

  // Middle row: V9 (near stairs) and V8 (formerly KM, big booth)
  { id: "V9", label: "V9", section: "vip", x: 155, y: 170, width: 60, height: 35 },
  { id: "V8", label: "V8", section: "vip", x: 255, y: 155, width: 55, height: 55 },

  // Terraza (T1-T9)
  { id: "T8", label: "T8", section: "terraza", x: 180, y: 295, width: 40, height: 40 },
  { id: "T9", label: "T9", section: "terraza", x: 50, y: 355, width: 40, height: 40 },
  { id: "T7", label: "T7", section: "terraza", x: 180, y: 355, width: 40, height: 40 },
  { id: "T1", label: "T1", section: "terraza", x: 340, y: 335, width: 35, height: 45 },
  { id: "T2", label: "T2", section: "terraza", x: 340, y: 385, width: 35, height: 45 },
  { id: "T3", label: "T3", section: "terraza", x: 340, y: 440, width: 35, height: 70 },
  { id: "T6", label: "T6", section: "terraza", x: 50, y: 465, width: 55, height: 35 },
  { id: "T5", label: "T5", section: "terraza", x: 115, y: 465, width: 55, height: 35 },
  { id: "T4", label: "T4", section: "terraza", x: 180, y: 465, width: 55, height: 35 },
  // Second T3 (bottom) — floor plan shows two T3 labels. Name this one T3B so it's unique.
  { id: "T3B", label: "T3", section: "terraza", x: 245, y: 465, width: 55, height: 35 },
];

type Props = {
  value: string;
  onChange: (tableId: string) => void;
  /** Array of table IDs that are already booked globally */
  bookedTables: Set<string>;
  /** Called when user tries to select an already-booked table; must return true to allow */
  onConflict?: (tableId: string) => boolean;
};

export default function FloorPlanPicker({ value, onChange, bookedTables, onConflict }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function handleClick(tableId: string) {
    const isBooked = bookedTables.has(tableId);
    const isSelecting = value !== tableId;

    // If deselecting, always allow
    if (!isSelecting) {
      onChange("");
      return;
    }

    if (isBooked && onConflict) {
      const allow = onConflict(tableId);
      if (!allow) return;
    }
    onChange(tableId);
  }

  function tableColor(table: TableDef): { fill: string; stroke: string; text: string } {
    const isSelected = value === table.id;
    const isBooked = bookedTables.has(table.id);
    const isHovered = hoveredId === table.id;

    if (isSelected) {
      return { fill: "#DB130D", stroke: "#FF1F17", text: "#ffffff" };
    }
    if (isBooked) {
      return { fill: "#3a1515", stroke: "#DB130D", text: "#DB130D" };
    }
    if (isHovered) {
      return { fill: "#2a2a2a", stroke: "#DB130D", text: "#ffffff" };
    }
    return { fill: "#1a1a1a", stroke: "#4a4a4a", text: "#cccccc" };
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#1a1a1a] border border-[#4a4a4a]" />
          <span className="text-muted">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-tantra-red border border-red-400" />
          <span className="text-muted">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#3a1515] border border-tantra-red relative">
            <div className="absolute inset-0 flex items-center justify-center text-[8px] text-tantra-red font-bold">×</div>
          </div>
          <span className="text-muted">Already booked</span>
        </div>
      </div>

      {/* Floor plan SVG */}
      <div className="bg-[#1a1412] border border-[var(--border)] p-2 rounded-sm">
        <svg
          viewBox="0 0 400 560"
          className="w-full h-auto"
          style={{ maxHeight: "500px" }}
        >
          {/* Upper L-shape wall */}
          <path
            d="M 30 50 L 260 50 L 260 15"
            stroke="#4a4a4a"
            strokeWidth="2"
            fill="none"
          />

          {/* Stairs indicator (near V9) */}
          <g>
            <path
              d="M 85 180 L 110 180 L 105 190 L 110 200 L 85 200"
              stroke="#666"
              strokeWidth="1.5"
              fill="none"
            />
            <text x="87" y="215" fontSize="8" fill="#666">stairs</text>
          </g>

          {/* Terraza label */}
          <text
            x="200"
            y="260"
            textAnchor="middle"
            fontSize="14"
            fill="#888"
            letterSpacing="3"
            fontWeight="bold"
          >
            TERRAZA
          </text>

          {/* Section dividing line */}
          <line
            x1="20"
            y1="240"
            x2="380"
            y2="240"
            stroke="#2a2a2a"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* VIP section label */}
          <text
            x="30"
            y="15"
            fontSize="9"
            fill="#666"
            letterSpacing="2"
            fontWeight="bold"
          >
            VIP
          </text>

          {/* Tables */}
          {TABLES.map((table) => {
            const colors = tableColor(table);
            const isBooked = bookedTables.has(table.id);
            const isSelected = value === table.id;

            return (
              <g
                key={table.id}
                style={{ cursor: "pointer" }}
                onClick={() => handleClick(table.id)}
                onMouseEnter={() => setHoveredId(table.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <rect
                  x={table.x}
                  y={table.y}
                  width={table.width}
                  height={table.height}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isSelected ? 3 : 1.5}
                />
                <text
                  x={table.x + table.width / 2}
                  y={table.y + table.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="bold"
                  fill={colors.text}
                  style={{ pointerEvents: "none" }}
                >
                  {table.label}
                </text>

                {/* X mark over booked tables */}
                {isBooked && !isSelected && (
                  <g style={{ pointerEvents: "none" }}>
                    <line
                      x1={table.x + 4}
                      y1={table.y + 4}
                      x2={table.x + table.width - 4}
                      y2={table.y + table.height - 4}
                      stroke="#DB130D"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                    <line
                      x1={table.x + table.width - 4}
                      y1={table.y + 4}
                      x2={table.x + 4}
                      y2={table.y + table.height - 4}
                      stroke="#DB130D"
                      strokeWidth="2"
                      opacity="0.5"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selection display + clear button */}
      <div className="flex items-center justify-between bg-deep tantra-border px-4 py-3">
        <div className="text-sm">
          {value ? (
            <span className="text-default">
              Selected: <span className="font-bold text-tantra-red">{value.startsWith("T3B") ? "T3" : value}</span>
              {bookedTables.has(value) && <span className="text-yellow-500 ml-2">⚠ was booked</span>}
            </span>
          ) : (
            <span className="text-muted">No table selected (optional)</span>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-tantra-red hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
