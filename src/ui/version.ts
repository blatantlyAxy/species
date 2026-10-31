declare const __BUILD_DATE__: string;
export const VERSION = '0.7.0';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : 'dev';
/** Where feedback goes. Leave empty to offer copy-to-clipboard only. */
export const FEEDBACK_EMAIL = 'akshay.rathore06@gmail.com';
export const FEEDBACK_SUBJECT = `Species feedback v${VERSION}`;
