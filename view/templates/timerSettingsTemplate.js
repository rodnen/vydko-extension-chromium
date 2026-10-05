function renderNumberField({ id, label, span, min, max, value, enabled }, i18n) {
  return `
    <div class="settings-item g-10 flex-col">
      <label for="${id}">${i18n.get(label)}</label>
      <div class="flex-center number-input-wrapper glass-panel p-8">
        <input
          type="number"
          id="${id}"
          min="${min}"
          max="${max}"
          step="1"
          value="${value}"
          ${enabled ? '' : 'disabled'}
        />
        <span class="number-input-suffix">${i18n.get('dialogTimerMinutes')}</span>
      </div>
      <span class="secondary-text">${i18n.get(span)}</span>
    </div>
  `;
}

export const renderTimerSettings = ({ enabled, numberFields }, i18n) => {
  const numberFieldsHTML = numberFields
    .map(field => renderNumberField({ ...field, enabled }, i18n))
    .join('');

  return `<div class="settings-wrapper p-10 flex-col g-20">
      <div class="settings-section flex-col g-10">
        <div class="settings-section-title secondary-text">${i18n.get('dialogTimerNotifications')}</div>
        <div class="settings-group p-10 glass-panel">
          <div class="settings-item flex-between">
            <span>${i18n.get('outageNotifications')}</span>
            <label class="custom-checkbox" for="notification-enabled">
              <input type="checkbox" id="notification-enabled" ${enabled ? 'checked' : ''} />
              <div class="slider round"></div>
            </label>
          </div>
        </div>
        <div class="settings-section-description thirdly-text">${i18n.get('dialogTimerNotificationsDescription')}</div>
      </div>

      <div class="settings-section flex-col g-10${enabled ? '' : ' disabled'}">
        <div class="settings-section-title secondary-text">${i18n.get('dialogTimerTimeTitle')}</div>
        <div class="notification-fields settings-group p-10 g-10 flex-row glass-panel" id="timer-settings-fields">
          ${numberFieldsHTML}
        </div>
        <div class="settings-section-description thirdly-text">${i18n.get('dialogTimerTimeDescription')}</div>
      </div>
    </div>`;
};

export const renderTimerSummary = ({ count, delay, frequency }, i18n) => `
  <div class="notification-summary glass-panel glass-blur p-10" id="notification-summary">
    <span id="summary-count" class="summary-count-badge">${count}</span>
    <strong class="summary-highlight">${i18n.get('dialogTimerNotificationCount')}</strong> ${i18n.get('dialogTimerWillBeSent')}<br>
    ${i18n.get('dialogTimerFirstPrefix')} <strong id="summary-delay" class="summary-highlight">${delay} ${i18n.get('dialogTimerMinutes')}</strong> ${i18n.get('dialogTimerBeforeOutage')},
    ${i18n.get('dialogTimerNextPrefix')} <strong id="summary-frequency" class="summary-highlight">${frequency} ${i18n.get('dialogTimerMinutes')}</strong>.
  </div>
`;
