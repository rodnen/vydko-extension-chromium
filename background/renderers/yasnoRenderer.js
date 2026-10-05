
import { buildSlotHTML } from './slotRenderer.js';
import { compareGroups } from './groupUtils.js';

function slotMinutesToTimestamp(isoDateString, minutes) {
  const date = new Date(isoDateString);
  date.setHours(0, 0, 0, 0);
  return date.getTime() + minutes * 60000;
}

export function renderYasnoTable(
  data,
  group = 'all',
  currentDayNumber = new Date().getDate(),
  dayType = 'today',
  i18n
) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const groups = group === 'all'
    ? Object.keys(data).sort(compareGroups)
    : [group];
  const rows = [];
  const outageDates = [];

  let hasAnySlots = false;
  let isEmergency = false;
  let isNoOutages = false;
  let isOutdated = false;
  let effectiveDayType = dayType;

  const updatedOn = data[groups[0]]?.updatedOn ?? null;

  if (effectiveDayType === 'today') {
    const todayIso = data[groups[0]]?.today?.date;
    if (todayIso && new Date(todayIso).getDate() !== currentDayNumber) {
      effectiveDayType = 'tomorrow';
    }
  }

  for (const currentGroup of groups) {
    const schedules = data[currentGroup];
    const daySchedule = schedules?.[effectiveDayType];
    const slots = daySchedule?.slots || [];
    const iso = daySchedule?.date;
    const scheduleDayNumber = iso ? new Date(iso).getDate() : null;

    if (
      effectiveDayType === 'tomorrow' &&
      scheduleDayNumber === currentDayNumber &&
      effectiveDayType === dayType
    ) {
      continue;
    }

    const status = daySchedule?.status;
    const groupIsEmergency = status === 'EmergencyShutdowns';
    const groupHasNoOutages = status === 'NoOutages';
    const groupIsOutdated = status === 'WaitingForSchedule';

    isEmergency ||= groupIsEmergency;
    isNoOutages ||= groupHasNoOutages;
    isOutdated ||= groupIsOutdated;

    if (slots.length) hasAnySlots = true;

    for (const slot of slots) {
      const row = buildSlotHTML({
        i18n,
        turn: group === 'all' ? currentGroup : null,
        start: slot.start,
        end: slot.end,
        isOutage: slot.type === 'Definite',
        isOutdated: groupIsOutdated,
        isNow: slot.start <= nowMin && nowMin < slot.end && effectiveDayType === 'today'
      });

      if (row) rows.push(row);
    }

    for (const type of ['today', 'tomorrow']) {
      const schedule = schedules?.[type];
      if (!schedule?.date) continue;

      for (const slot of schedule.slots || []) {
        if (slot.type !== 'Definite') continue;

        const timestamp = slotMinutesToTimestamp(schedule.date, slot.start);
        if (timestamp > now) outageDates.push(timestamp);
      }
    }
  }

  const status = isEmergency
    ? 'danger'
    : isNoOutages
      ? 'ok'
      : !hasAnySlots
        ? 'info'
        : isOutdated
          ? 'warning'
          : null;

  outageDates.sort((a, b) => a - b);

  return {
    success: true,
    html: rows.join(''),
    status,
    updatedOn,
    outageDates
  };
}

export { slotMinutesToTimestamp };
