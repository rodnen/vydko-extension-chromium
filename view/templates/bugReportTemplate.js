export const renderBugReportStep = ({ fieldId, title, hint, placeholder, validation }, i18n) => `
  <div class="bug-report-wrapper p-10">
    <section class="bug-report-section flex-col g-10">
      <div class="bug-report-title secondary-text">${i18n.get(title)}</div>
      <div class="custom-textarea glass-panel p-8">
        <textarea
          id="${fieldId}"
          placeholder="${placeholder ? i18n.get(placeholder) : ' '}"
          rows="10"
        ></textarea>
        <div class="char-counter" data-field="${fieldId}">0/${validation.maxLength}</div>
      </div>
      <span class="custom-textarea-hint thirdly-text">${i18n.get(hint)}</span>
    </section>
  </div>
`;
