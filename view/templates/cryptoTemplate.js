export const renderCrypto = (address, qrcode, i18n) => `
  <div class="modal-wrapper p-10 g-10 flex-col">
    <div class="section-content flex-col g-10 glass-panel">
      <div class="flex-center g-10">
        <div class="flex-col g-3">
          <span class="main-text">${i18n.get('dialogCryptoDetails')}</span>
          <span class="custom-text t11_px">${i18n.get('dialogCryptoInstructions')}</span>
        </div>
      </div>
    </div>

    <div class="section-content flex-col g-10 glass-panel">
      <span class="custom-text t11_px">${i18n.get('dialogCryptoDepositAddress')}</span>
      <div class="flex-between g-10 glass-panel p-5">
        <div class="qr-code-body glass-panel p-5">
          <div class="qr-code ${qrcode} no-mask"></div>
        </div>
        <div class="flex-col flex g-10">
          <div class="flex-between flex">
            <span class="custom-text t11_px">${i18n.get('dialogCryptoAddress')}</span>
            <button class="btn app-btn flex-center glass-panel"
                    data-action="copyAddress"
                    data-address="${address}"
                    title="${i18n.get('dialogCryptoCopy')}">
              <div class="icon ic_copy"></div>
            </button>
          </div>
          <span class="custom-text t11_px address-text" title="${address}" style="word-wrap:anywhere; color:var(--accent-text);">${address}</span>
        </div>
      </div>
    </div>
  </div>
`;
