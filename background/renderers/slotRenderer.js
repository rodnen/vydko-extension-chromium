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

  return `
    <div class="_table_element flex-between glass-panel glass-blur${isOutage ? ' outage' : ''}${isNow ? ' selected' : ''}" data-index="${turn}">
      <div style="flex: 1;">
        <div class="_outage_time g-5">
          ${isNow ? '<div class="_table_current_selected"></div>' : ''}
          <span>${Utils.minutesToTime(start)} - ${Utils.minutesToTime(end)}</span>
        </div>
        <div class="_outage_type" data-i18n="${statusKey}">
          ${i18n.get(statusKey)}
        </div>
      </div>
      ${isOutage ? '<div class="outage_icon"></div>' : ''}
      ${turn !== null ? `<span class="group-number-text">${turn}</span>` : ''}
    </div>
  `;
}
