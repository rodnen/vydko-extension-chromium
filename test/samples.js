export const Test = {
  //SAMPLES FOR TABLE GENERATION
  YASNO_TEST_SAMPLE: (() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(today.getUTCDate() + 1);

    const updatedOn = new Date(today);
    updatedOn.setUTCDate(today.getUTCDate() - 1);

    return {
      "1.2": {
        today: {
          date: today.toISOString(),
          status: "Schedule",  // або "EmergencyShutdowns" / "NoOutages" / "WaitingForSchedule"
          slots: [
            { start: 480, end: 690, type: "Definite" },
            { start: 690, end: 720, type: "Possible" },
            { start: 480, end: 690, type: "Definite" },
            { start: 690, end: 720, type: "Possible" },
            { start: 720, end: 890, type: "Definite" },
            { start: 890, end: 1230, type: "Possible" },
            { start: 1230, end: 1300, type: "Definite" }
          ]
        },
        tomorrow: {
          date: tomorrow.toISOString(),
          status: "Schedule",
          slots: [
            { start: 480, end: 690, type: "Definite" },
            { start: 690, end: 720, type: "Possible" },
            { start: 720, end: 890, type: "Definite" },
            { start: 890, end: 1230, type: "Possible" },
            { start: 1230, end: 1300, type: "Definite" }
          ]
        },
        updatedOn: updatedOn.toISOString()
      }
    };
  })(),

  DTEK_TEST_SAMPLE: (() => {
    const todayTimestamp = 1790283600;
    const tomorrowTimestamp = todayTimestamp + 86400;

    const fact = {
      today: todayTimestamp,
      update: "24.07.2026 08:30",

      data: {
        [todayTimestamp]: {
          "GPV1.1": {
            "1": "yes", "2": "yes", "3": "yes", "4": "no", "5": "no", "6": "first",
            "7": "yes", "8": "yes", "9": "second", "10": "no", "11": "no", "12": "no",
            "13": "yes", "14": "yes", "15": "yes", "16": "yes", "17": "first", "18": "no",
            "19": "no", "20": "second", "21": "yes", "22": "yes", "23": "yes", "24": "yes"
          },
          "GPV2.1": {
            "1": "no", "2": "no", "3": "yes", "4": "yes", "5": "yes", "6": "yes",
            "7": "first", "8": "no", "9": "no", "10": "second", "11": "yes", "12": "yes",
            "13": "yes", "14": "no", "15": "no", "16": "no", "17": "yes", "18": "yes",
            "19": "first", "20": "no", "21": "no", "22": "second", "23": "yes", "24": "yes"
          },
          "GPV3.1": {
            "1": "yes", "2": "no", "3": "no", "4": "first", "5": "yes", "6": "yes",
            "7": "yes", "8": "second", "9": "no", "10": "no", "11": "yes", "12": "yes",
            "13": "first", "14": "no", "15": "no", "16": "yes", "17": "yes", "18": "yes",
            "19": "second", "20": "no", "21": "no", "22": "yes", "23": "yes", "24": "yes"
          }
        },

        [tomorrowTimestamp]: {
          "GPV1.1": {
            "1": "yes", "2": "yes", "3": "no", "4": "no", "5": "first", "6": "yes",
            "7": "yes", "8": "yes", "9": "no", "10": "no", "11": "second", "12": "yes",
            "13": "yes", "14": "yes", "15": "no", "16": "no", "17": "yes", "18": "yes",
            "19": "first", "20": "no", "21": "yes", "22": "yes", "23": "yes", "24": "yes"
          },
          "GPV2.2": {
            "1": "no", "2": "yes", "3": "yes", "4": "yes", "5": "no", "6": "no",
            "7": "second", "8": "yes", "9": "yes", "10": "yes", "11": "no", "12": "no",
            "13": "first", "14": "yes", "15": "yes", "16": "yes", "17": "no", "18": "no",
            "19": "yes", "20": "yes", "21": "second", "22": "no", "23": "no", "24": "yes"
          },
          "GPV3.1": {
            "1": "yes", "2": "yes", "3": "first", "4": "no", "5": "no", "6": "yes",
            "7": "yes", "8": "yes", "9": "second", "10": "no", "11": "no", "12": "yes",
            "13": "yes", "14": "yes", "15": "first", "16": "no", "17": "yes", "18": "yes",
            "19": "yes", "20": "no", "21": "no", "22": "second", "23": "yes", "24": "yes"
          }
        }
      }
    };

    return { success: true, data: fact };
  })()
};
