/**
 * 麻将贴图：lietxia/mahjong_graphic 默认竖版
 * https://github.com/lietxia/mahjong_graphic
 */

const TILE_BASE = "assets/tiles";

export function tileSrc(id) {
  return `${TILE_BASE}/${id}.png`;
}

export function tileBackSrc() {
  return `${TILE_BASE}/back.png`;
}

export function tileHTML(id, opts = {}) {
  const { back = false, size = "md", clickable = false, selected = false, hint = false } = opts;
  const cls = `mj-tile mj-${size}${clickable ? " clickable" : ""}${selected ? " selected" : ""}${hint ? " hint" : ""}${back ? " is-back" : ""}`;
  const src = back ? tileBackSrc() : tileSrc(id);
  const data = back ? "" : ` data-tile="${id}"`;
  return `<div class="${cls}"${data}><img alt="" draggable="false" src="${src}"/></div>`;
}
