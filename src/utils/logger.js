const { createLogger, transports, format } = require("winston");
const LokiTransport = require("winston-loki");
const pino = require("pino");

let logger;

const initializeLogger = () => {
  if (logger) {
    return;
  }

  const localLogger = pino({
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  });

  if (
    process.env.NODE_ENV === "production" &&
    process.env.LOKI_HOST &&
    process.env.LOKI_USERNAME &&
    process.env.LOKI_PASSWORD
  ) {
    logger = createLogger({
      transports: [
        new LokiTransport({
          host: process.env.LOKI_HOST,
          basicAuth: `${process.env.LOKI_USERNAME}:${process.env.LOKI_PASSWORD}`,
          labels: { app: "crypto-api" },
          json: true,
          format: format.json(),
          replaceTimestamp: true,
          onConnectionError: (err) => localLogger.error(err),
        }),
        new transports.Console({
          format: format.combine(format.simple(), format.colorize()),
        }),
      ],
    });
  } else {
    logger = localLogger;
  }
};

const getLogger = () => {
  initializeLogger();
  return logger;
};

module.exports = { getLogger };
