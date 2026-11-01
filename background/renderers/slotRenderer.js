import { Utils } from '../../utils/utils.js';

export function buildSlotHTML({
  i18n,
  turn = null,
  start,
  end,
  isOutage,
  isOutdated,
  isNow
}) {
  if (isOutdated) return '';
  const statusKey = isOutage ? 'lightOff' : 'lightOn';

  // `turn` походить із ключів відповіді API (черги/групи), а start/end — із
  // слотів. Усе це недовірені дані, які потрапляють у innerHTML popup.
  const safeTurn = turn === null ? null : Utils.escapeHTML(turn);
  const startMinutes = Number(start);
  const endMinutes = Number(end);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return '';

  return `
    <div class="_table_element flex-between glass-panel glass-blur${isOutage ? ' outage' : ''}${isNow ? ' selected' : ''}" data-index="${safeTurn}">
      <div style="flex: 1;">
        <div class="_outage_time g-5">
          ${isNow ? '<div class="_table_current_selected"></div>' : ''}
          <span>${Utils.minutesToTime(startMinutes)} - ${Utils.minutesToTime(endMinutes)}</span>
        </div>
        <div class="_outage_type" data-i18n="${statusKey}">
          ${i18n.get(statusKey)}
        </div>
      </div>
      ${isOutage ? '<div class="outage_icon"></div>' : ''}
      ${safeTurn !== null ? `<span class="group-number-text">${safeTurn}</span>` : ''}
    </div>
  `;
}
