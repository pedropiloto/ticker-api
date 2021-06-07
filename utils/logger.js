const pino = require('pino');
const newrelic = require('newrelic');
const logzio_defined = !!process.env.LOGZIO_TOKEN
const logzio = `${process.env.LOGZIO_TOKEN}` ? require('logzio-nodejs').createLogger({
  token: `${process.env.LOGZIO_TOKEN}`,
  protocol: 'https',
  host: 'listener.logz.io',
  port: '8071',
  type: 'nodejs',
}) : undefined;

const logger = pino({ level: process.env.LOG_LEVEL || 'info', prettyPrint: { colorize: true } });
const {
  OPERATIONAL_LOG_TYPE, BUSINESS_LOG_TYPE, INFO_SEVERITY,
} = require('./constants');

const log = (params) => {
  if(process.env.NODE_ENV === 'development'){
    console.log(params)
  }
  if (!params.severity) {
    // eslint-disable-next-line no-param-reassign
    params.severity = INFO_SEVERITY;
  }
  if (!params.app_name) {
    // eslint-disable-next-line no-param-reassign
    params.app_name = `${process.env.APP_NAME}`;
  }
  if (params.type === BUSINESS_LOG_TYPE) {
    logger.debug(params);
  } else {
    logger.info(params);
  }
  if (logzio_defined) {
    logzio.log(params);
  }
};

const sendAndCloseLogzio = () => {
  if (logzio_defined) {
    logzio.sendAndClose();
  }
};

module.exports = { log, sendAndCloseLogzio };
