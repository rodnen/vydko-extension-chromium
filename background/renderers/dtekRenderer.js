import { Utils } from '../../utils/utils.js';
import { buildSlotHTML } from './slotRenderer.js';
import { compareGroups } from './groupUtils.js';

const STATUS_MAP = {
  yes: ['power', 'power'],
  no: ['outage', 'outage'],
  first: ['outage', 'power'],
  second: ['power', 'outage']
};

const DAY_SECONDS = 86400;
// Перехід на літній/зимовий час зсуває «наступну північ» на годину.
const DST_TOLERANCE_SECONDS = 3600;

export function buildHalfHourSlots(hoursData) {
  if (!hoursData || typeof hoursData !== 'object') return [];

  return Object.entries(hoursData).flatMap(([hour, value]) => {
    const hourNumber = Number(hour);
    if (!Number.isFinite(hourNumber)) return [];

    const base = (hourNumber - 1) * 60;
    const [firstHalf, secondHalf] = STATUS_MAP[value] ?? ['power', 'power'];

    return [
      { start: base, end: base + 30, status: firstHalf },
      { start: base + 30, end: base + 60, status: secondHalf }
    ];
  });
}

export function mergeSlots(slots) {
  if (!slots.length) return [];

  return slots.slice(1).reduce((result, next) => {
    const current = result[result.length - 1];

    if (next.status === current.status && next.start === current.end) {
      current.end = next.end;
    } else {
      result.push({ ...next });
    }

    return result;
  }, [{ ...slots[0] }]);
}

function getGroupNames(dayData, group) {
  return group === 'all'
    ? Object.keys(dayData)
      .filter(keyName => keyName.startsWith('GPV'))
      .sort(compareGroups)
    : [`GPV${group}`];
}

/**
 * Перевіряє структуру відповіді DTEK і повертає функцію доступу до днів.
 * Кидає помилку, якщо відповідь некоректна (null, без today тощо), замість
 * того щоб тихо повернути порожній «успішний» результат.
 */
function parseFact(factData, i18n) {
  const fact = factData?.data;
  const hasToday = fact != null && typeof fact === 'object'
    && fact.today != null && Number.isFinite(Number(fact.today));

  if (!factData?.success || !hasToday) {
    throw new Error(i18n.get('apiDtekInvalidData'));
  }

  const today = Number(fact.today);
  const lookup = key => fact.data?.[key] ?? fact[key];

  // «Завтра» — це наступний ключ дня. Зазвичай today + 24 год, але на межі
  // зміни часу різниця 23/25 год, тому шукаємо ключ із допуском.
  const exact = today + DAY_SECONDS;
  const tomorrow = lookup(exact)
    ? exact
    : Object.keys(fact.data ?? {})
      .map(Number)
      .find(ts => Math.abs(ts - exact) <= DST_TOLERANCE_SECONDS) ?? exact;

  return { today, tomorrow, lookup };
}

/** Майбутні початки відключень для одного дня (для планувальника сповіщень). */
function collectOutageDates(dayData, group, baseTimestamp, now) {
  if (!dayData || typeof dayData !== 'object') return [];

  return getGroupNames(dayData, group).flatMap(groupName => {
    if (!dayData[groupName]) return [];

    return mergeSlots(buildHalfHourSlots(dayData[groupName]))
      .filter(slot => slot.status === 'outage')
      .map(slot => Utils.minutesToDate(baseTimestamp, slot.start))
      .filter(date => date > now);
  });
}

export function renderDtekTable(factData, group, dayType, i18n) {
  if (!group) {
    return { html: '', status: null, outageDates: [] };
  }

  const { today: todayTimestamp, tomorrow: tomorrowTimestamp, lookup } = parseFact(factData, i18n);
  const now = new Date();

  // Сповіщення потребують обох днів незалежно від того, яку вкладку
  // відкрито, інакше перегляд «завтра» стирав би сьогоднішні відключення.
  const outageDates = [
    ...collectOutageDates(lookup(todayTimestamp), group, todayTimestamp, now),
    ...collectOutageDates(lookup(tomorrowTimestamp), group, tomorrowTimestamp, now)
  ].sort((a, b) => a - b);

  const key = dayType === 'today' ? todayTimestamp : tomorrowTimestamp;
  const dayData = lookup(key);

  if (!dayData) {
    return {
      html: '',
      status: 'ok',
      outageDates
    };
  }

  const groups = getGroupNames(dayData, group);

  const onlyGroupData = groups.length === 1 ? dayData[groups[0]] : null;
  const onlyGroupSlots = onlyGroupData
    ? mergeSlots(buildHalfHourSlots(onlyGroupData))
    : [];
  const isSingleNoOutageGroup = onlyGroupSlots.length === 1
    && onlyGroupSlots[0].status !== 'outage';

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const html = isSingleNoOutageGroup ? '' : groups.map(currentGroup => {
    if (!dayData[currentGroup]) return '';

    const slots = mergeSlots(buildHalfHourSlots(dayData[currentGroup]));

    return slots.map(slot => buildSlotHTML({
      i18n,
      turn: group === 'all' ? currentGroup.replace('GPV', '') : null,
      start: slot.start,
      end: slot.end,
      isOutage: slot.status === 'outage',
      isOutdated: false,
      isNow: slot.start <= nowMin && nowMin < slot.end && dayType === 'today'
    })).filter(Boolean).join('');
  }).join('');

  // Порожній екран без пояснення гірший за статус «очікуємо оновлення»:
  // для вибраної черги графіка може просто не бути.
  const status = isSingleNoOutageGroup ? 'ok' : (html ? null : 'info');

  return { html, status, outageDates };
}
