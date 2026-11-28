import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { DemoMix, type Demo } from "../components/DemoMix";
import { OnSquare } from "../components/Stage";
import { Badge } from "../components/Typography";
import { moveAt, piece, progress, sq } from "../chess";
import { REGLAS as T } from "../timeline";
import { BOARD_SIZE } from "../layout";

const RED = "#e0473f";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const shakeX = (f: number, start: number) =>
  f >= start ? Math.sin(f * 2.2) * 0.04 * Math.max(0, 1 - (f - start) / 20) : 0;

const demos: Demo[] = [
  {
    // Rook a1-e1 gives check along the open e-file; the king steps to d8.
    key: "jaque",
    ...T.jaque,
    kicker: "Reglas clave · 1/4",
    title: "*Jaque*",
    rule: "Tu rey está atacado: *debes salvarlo*",
    state: (f) => {
      const resolved = progress(f, T.jaque.escape + 8, 8);
      return {
        pieces: [
          piece("wK", "K", "w", "g1"),
          piece("wR", "R", "w", "a1", moveAt(f, "a1", "e1", T.jaque.move, 16)),
          piece("bK", "K", "b", "e8", {
            ...moveAt(f, "e8", "d8", T.jaque.escape, 14),
            x:
              moveAt(f, "e8", "d8", T.jaque.escape, 14).x +
              shakeX(f, T.jaque.check),
          }),
          piece("bPf", "P", "b", "f7"),
          piece("bPg", "P", "b", "g7"),
          piece("bPh", "P", "b", "h7"),
        ],
        highlights: [
          {
            square: "e8",
            kind: "check",
            appear: progress(f, T.jaque.check, 8) * (1 - resolved),
          },
          {
            square: "d8",
            kind: "move",
            appear:
              progress(f, T.jaque.escape - 12, 8) *
              (1 - progress(f, T.jaque.escape + 4, 6)),
          },
        ],
        arrows: [
          {
            from: "a1",
            to: "e1",
            progress: progress(f, 8, 12),
            opacity: 1 - progress(f, T.jaque.move + 12, 6),
          },
          {
            from: "e1",
            to: "e8",
            progress: progress(f, T.jaque.check - 2, 12),
            color: RED,
            opacity: 1 - resolved,
          },
        ],
      };
    },
    overlay: () => (
      <OnSquare x={1.8} y={4} size={BOARD_SIZE}>
        <Badge
          text="¡JAQUE!"
          start={T.jaque.check + 2}
          end={T.jaque.escape + 14}
          tone="danger"
          size={58}
        />
      </OnSquare>
    ),
  },
  {
    // Back-rank mate: Re8#. f8/h8 are covered by the rook, f7/g7/h7 are blocked.
    key: "mate",
    ...T.mate,
    kicker: "Reglas clave · 2/4",
    title: "*Jaque mate*",
    rule: "Rey atacado y *sin salida*: fin de la partida",
    state: (f) => ({
      pieces: [
        piece("wK", "K", "w", "g1"),
        piece("wR", "R", "w", "e1", moveAt(f, "e1", "e8", T.mate.move, 18)),
        piece("bK", "K", "b", "g8", { x: sq("g8").x + shakeX(f, T.mate.mate) }),
        piece("bPf", "P", "b", "f7"),
        piece("bPg", "P", "b", "g7"),
        piece("bPh", "P", "b", "h7"),
      ],
      highlights: [
        { square: "g8", kind: "check", appear: progress(f, T.mate.mate, 8) },
        {
          square: "f8",
          kind: "blocked",
          appear: progress(f, T.mate.mate + 8, 8),
        },
        {
          square: "h8",
          kind: "blocked",
          appear: progress(f, T.mate.mate + 14, 8),
        },
      ],
      arrows: [
        {
          from: "e1",
          to: "e8",
          progress: progress(f, 12, 20),
          opacity: 1 - progress(f, T.mate.move + 14, 6),
        },
      ],
    }),
    overlay: () => (
      <OnSquare x={3.5} y={3.5} size={BOARD_SIZE}>
        <Badge
          text="JAQUE MATE"
          start={T.mate.mate + 4}
          tone="danger"
          size={74}
        />
      </OnSquare>
    ),
  },
  {
    // Short castling: e1-g1 and h1-f1, with f1/g1 empty.
    key: "enroque",
    ...T.enroque,
    kicker: "Reglas clave · 3/4",
    title: "*Enroque*",
    rule: "El rey da *dos pasos* hacia la torre\ny la torre *lo cruza*",
    state: (f) => {
      const done = progress(f, T.enroque.rook + 18, 8);
      return {
        pieces: [
          piece(
            "wK",
            "K",
            "w",
            "e1",
            moveAt(f, "e1", "g1", T.enroque.king, 16),
          ),
          piece(
            "wRh",
            "R",
            "w",
            "h1",
            moveAt(f, "h1", "f1", T.enroque.rook, 18, 0.7),
          ),
          piece("wRa", "R", "w", "a1"),
          ..."abcdefgh"
            .split("")
            .map((c) => piece(`wP${c}`, "P", "w", `${c}2`)),
        ],
        highlights: [
          {
            square: "f1",
            kind: "fill",
            appear: progress(f, 8, 8) * (1 - done),
          },
          {
            square: "g1",
            kind: "fill",
            appear: progress(f, 12, 8) * (1 - done),
          },
          { square: "g1", kind: "origin", appear: done },
          { square: "f1", kind: "origin", appear: done },
        ],
        arrows: [
          {
            from: "e1",
            to: "g1",
            progress: progress(f, 22, 14),
            opacity: 1 - progress(f, T.enroque.king + 12, 6),
          },
          {
            from: "h1",
            to: "f1",
            progress: progress(f, T.enroque.king + 6, 12),
            opacity: 1 - progress(f, T.enroque.rook + 14, 6),
          },
        ],
      };
    },
    overlay: () => (
      <OnSquare x={3.5} y={4} size={BOARD_SIZE}>
        <Badge text="0-0" start={T.enroque.rook + 20} size={80} />
      </OnSquare>
    ),
  },
  {
    // Promotion: e7-e8 and the pawn becomes a queen.
    key: "promocion",
    ...T.promocion,
    kicker: "Reglas clave · 4/4",
    title: "*Promoción*",
    rule: "El peón llega al final\ny *se convierte* (normalmente en dama)",
    state: (f) => {
      const tr = progress(f, T.promocion.transform, 12);
      const flash = interpolate(
        f,
        [
          T.promocion.transform,
          T.promocion.transform + 6,
          T.promocion.transform + 30,
        ],
        [0, 1, 0],
        clamp,
      );
      return {
        pieces: [
          piece("wK", "K", "w", "g2"),
          piece("bK", "K", "b", "b6"),
          piece("wP", "P", "w", "e7", {
            ...moveAt(f, "e7", "e8", T.promocion.move, 16),
            opacity: 1 - tr,
          }),
          piece("wQ", "Q", "w", "e8", {
            opacity: tr,
            scale: interpolate(tr, [0, 1], [0.5, 1]),
            glow: Math.max(flash, 0.35 * tr),
          }),
        ],
        highlights: [
          {
            square: "e8",
            kind: "move",
            appear:
              progress(f, 6, 8) * (1 - progress(f, T.promocion.move + 6, 6)),
          },
          { square: "e8", kind: "fill", appear: flash },
          { square: "e8", kind: "origin", appear: tr },
        ],
        arrows: [
          {
            from: "e7",
            to: "e8",
            progress: progress(f, 10, 14),
            opacity: 1 - progress(f, T.promocion.move + 12, 6),
          },
        ],
      };
    },
    overlay: () => (
      <OnSquare x={4} y={4.6} size={BOARD_SIZE}>
        <Badge text="¡DAMA!" start={T.promocion.transform + 8} size={70} />
      </OnSquare>
    ),
  },
];

/** Scene 4: check, checkmate, castling and promotion. */
export const Reglas: React.FC = () => (
  <AbsoluteFill>
    <DemoMix demos={demos} />
  </AbsoluteFill>
);
