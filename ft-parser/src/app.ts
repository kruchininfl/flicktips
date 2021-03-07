import {closeDbConnection, openDbConnection} from './core/db';
import logUpdate from 'log-update';
import moment from 'moment';
import parseFastTorrent from './modules/parseFastTorrent';
import matchFastTorrentFilms from './modules/matchFastTorrentFilms';
import parseTorrentDate from './modules/parseTorrentDate';
import cron from 'node-cron';

const LOG_DISABLED = true;

const lorOriginal = console.log;

console.log = (...args) => {
  if (LOG_DISABLED) {
    return false;
  } else {
    lorOriginal.apply(console, args);
  }
}

type IProgressStep = "list" | "filmDetails" | "match" | "torrentDate";

export interface IProgress {
  currentStep: undefined | IProgressStep;
  steps: {
    [key in IProgressStep]: {
      [key: string]: number;
    };
  };
}

const progress: IProgress = {
  currentStep: undefined,
  steps: {
    list: {
      total: 0,
      current: 0,
    },
    filmDetails: {
      total: 0,
      success: 0,
      fail: 0,
    },
    match: {
      total: 0,
      skipped: 0,
      totalComplete: 0,
      matchById: 0,
      matchByName: 0,
    },
    torrentDate: {
      total: 0,
      parsed: 0,
    }
  }
};

const progressLog = () => {
  const currentStep = progress.currentStep;

  if (!currentStep) {
    return logUpdate("Starting...");
  }

  const currentStepProgress = progress.steps[currentStep];

  logUpdate(`Current step: ${currentStep} ${Object.keys(currentStepProgress).map((key) => (
    `${key}: ${currentStepProgress[key]}`
  )).join(", ")}`);
};

const run = async () => {
  const loggerId = setInterval(progressLog, 5000);

  await openDbConnection();

  await parseFastTorrent(progress);
  await matchFastTorrentFilms(progress);
  await parseTorrentDate(progress);

  await closeDbConnection();

  clearInterval(loggerId);
  progressLog();
  logUpdate("Finish:", moment().format("YYYY.MM.DD HH:mm"));
};

let started = false;
cron.schedule("0 * * * *", async () => {
  if (started) {
    return false;
  }

  started = true;
  await run();
  started = false;
});
// const start = Date.now();
// run().then(() => {
//   console.info(`${moment(Date.now()).diff(start, "minute")} minutes`);
// });