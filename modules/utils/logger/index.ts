import { COLOR_REGEX } from './constants';
import {
  ANSI_ESCAPE,
  COLORS,
  LOG_LEVELS,
  LOG_LEVEL_COLOR_MAPPINGS,
} from './constants';

export default class Logger {
  public loggingLevel: number = LOG_LEVELS.LOG;
  private indentation: number = 20;
  private readonly moduleName: string;

  constructor(moduleName: string, loggingLevel?: number) {
    this.moduleName = moduleName;

    const { LOG_LEVEL, LOG_INDENTATION } = process.env;
    if (LOG_INDENTATION) {
      const int = parseInt(LOG_INDENTATION);
      if (int) this.indentation = int;
    }

    if (LOG_LEVEL) {
      const int = parseInt(LOG_LEVEL);
      if (int in LOG_LEVELS) this.loggingLevel = int;
      else if (LOG_LEVEL in LOG_LEVELS)
        this.loggingLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS];
    }

    if (loggingLevel) this.loggingLevel = loggingLevel;
  }

  private print(level: keyof typeof LOG_LEVELS, ...data: any[]) {
    let func: any;
    let key = level.toLowerCase() as keyof typeof console;
    if (level in console && typeof console[key] === 'function')
      func = console[key];
    else func = console.log;

    if (LOG_LEVELS[level] > this.loggingLevel) return;

    let tag = this.formTagWithLevel(level);
    tag += ' '.repeat(
      Math.max(0, this.indentation - tag.replaceAll(COLOR_REGEX, '').length)
    );

    func.call(
      console,
      this.colorize('GRAY', '[' + new Date().toUTCString() + ']'),
      tag,
      ...data
    );
  }

  private formTagWithLevel(
    level: keyof typeof LOG_LEVEL_COLOR_MAPPINGS | keyof typeof LOG_LEVELS
  ) {
    const color =
      LOG_LEVEL_COLOR_MAPPINGS[
        level as keyof typeof LOG_LEVEL_COLOR_MAPPINGS
      ] || 'GRAY';
    return `[${this.moduleName}/${this.colorize(color, level.toLowerCase())}]`;
  }

  private getColor(color: keyof typeof COLORS) {
    return ANSI_ESCAPE + COLORS[color];
  }

  private colorize(
    color: keyof typeof COLORS,
    string: string,
    reset: boolean = true
  ) {
    let toReturn = this.getColor(color) + string;
    if (reset) toReturn += this.getColor('RESET');
    return toReturn;
  }

  public debug(...data: any[]) {
    this.print.call(this, 'DEBUG', ...data);
  }

  public log(...data: any[]) {
    this.print.call(this, 'LOG', ...data);
  }

  public info(...data: any[]) {
    this.print.call(this, 'INFO', ...data);
  }

  public warn(...data: any[]) {
    this.print.call(this, 'WARN', ...data);
  }

  public error(...data: any[]) {
    this.print.call(this, 'ERROR', ...data);
  }
}
