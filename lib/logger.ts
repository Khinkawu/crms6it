/**
 * Centralized Logger Service
 * Using this allows us to track logs with levels, contexts, and timestamps.
 * It also provides an easy integration point if we decide to use a third-party logging service like Sentry or Datadog in the future.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
    level: LogLevel;
    context: string;
    message: string;
    data?: any;
    timestamp: string;
}

const isDev = process.env.NODE_ENV === 'development';

const formatLogMessage = (payload: LogPayload): string => {
    const dataString = payload.data ? `\nData: ${JSON.stringify(payload.data, null, 2)}` : '';
    return `[${payload.timestamp}] [${payload.level.toUpperCase()}] [${payload.context}] ${payload.message}${dataString}`;
};

const executeLog = (payload: LogPayload) => {
    // Only log in development or if explicitly enabled, or if it's an error/warn
    if (!isDev && payload.level === 'debug') {
        return; // Skip verbose debug logs in production
    }

    const output = formatLogMessage(payload);

    switch (payload.level) {
        case 'info':
            console.log(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        case 'error':
            console.error(output);
            break;
        case 'debug':
            console.log(output); // Still use console.log but format as DEBUG
            break;
    }

    // TODO: Integration point for external services (Sentry/Datadog) can be added here
    // e.g., if (payload.level === 'error') Sentry.captureException(payload.data || payload.message);
};

export const logger = {
    info: (context: string, message: string, data?: any) => {
        executeLog({
            level: 'info',
            context,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },

    warn: (context: string, message: string, data?: any) => {
        executeLog({
            level: 'warn',
            context,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    },

    error: (context: string, message: string, error?: any) => {
        executeLog({
            level: 'error',
            context,
            message,
            data: error,
            timestamp: new Date().toISOString()
        });
    },

    debug: (context: string, message: string, data?: any) => {
        executeLog({
            level: 'debug',
            context,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }
};
