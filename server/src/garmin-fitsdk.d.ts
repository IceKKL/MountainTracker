declare module '@garmin/fitsdk' {
  export class Stream {
    static fromBuffer(buffer: Uint8Array): Stream;
  }

  export interface DecoderReadOptions {
    includeUnknownData?: boolean;
  }

  export interface FitSessionMesg {
    totalMovingTime?: number;
    totalTimerTime?: number;
    totalCalories?: number;
    developerFields?: Record<string, unknown>;
    [field: string]: unknown;
  }

  export interface FitMessages {
    sessionMesgs?: FitSessionMesg[];
    eventMesgs?: Array<{
      event?: string;
      eventType?: string;
      data?: number;
    }>;
    fieldDescriptionMesgs?: Array<Record<string, unknown>>;
  }

  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    read(options?: DecoderReadOptions): {
      messages: FitMessages;
      errors: Error[];
    };
  }
}
