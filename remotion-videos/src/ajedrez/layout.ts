/**
 * Vertical 1080x1920 layout, built around TikTok's UI:
 * - top ~200px: status bar / "Para ti" tabs
 * - right ~150px from y≈900: like / comment / share column
 * - bottom ~360px: username + description
 * Content uses a column centred at x=500 so nothing sits under the right column.
 */
export const COL_CENTER = 500;

export const HEADER = { top: 215, height: 330 };

export const BOARD_SIZE = 800;
export const BOARD_FRAME = 22; // must match Board's frame thickness for size 800
export const BOARD_TOP = 565;
export const BOARD_LEFT = COL_CENTER - BOARD_SIZE / 2 - BOARD_FRAME;

export const CAPTION_BOX = { left: 90, width: 820, top: 1405, height: 150 };
