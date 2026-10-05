import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
export const PROVIDER_STRATEGIES = {
  [CONSTANTS.PROVIDER.YASNO]: {
    action: 'fetchYasno',
    buildPayload: ({ group, regionId, dsoId, currentDayNumber, dayType }) => ({
      action: 'fetchYasno',
      group,
      regionId,
      dsoId,
      currentDayNumber,
      dayType
    }),
  },

  [CONSTANTS.PROVIDER.DTEK]: {
    action: 'fetchDTEK',
    buildPayload: ({ group, dsoId, dayType }) => ({
      action: 'fetchDTEK',
      type: Utils.DSOID_TO_DTEK_TYPE[dsoId],
      group,
      dayType,
    }),
  }
};
