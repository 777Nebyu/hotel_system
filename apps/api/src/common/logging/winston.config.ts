import {
  utilities as nestWinstonUtilities,
  WinstonModuleOptions,
} from 'nest-winston';
import * as winston from 'winston';
import { getRequestId } from '../context/request-context';

export function createLoggerOptions(nodeEnv: string): WinstonModuleOptions {
  const requestId = winston.format((info) => ({
    ...info,
    requestId: getRequestId(),
  }));
  return {
    levels: winston.config.npm.levels,
    format: winston.format.combine(
      requestId(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console({
        format:
          nodeEnv === 'production'
            ? winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              )
            : winston.format.combine(
                winston.format.timestamp({ format: 'HH:mm:ss' }),
                nestWinstonUtilities.format.nestLike('YayeTech Hotel', {
                  prettyPrint: true,
                  colors: true,
                }),
              ),
      }),
    ],
  };
}
