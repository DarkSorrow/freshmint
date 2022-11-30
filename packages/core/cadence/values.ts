import { parseFixedPointValue } from './fixedPoint';

export interface CadenceType {
  label: string;
  asArgument: (value: any) => any;
}

export interface CadenceValue {
  toBytes(): Buffer;
}

export class IntValue {
  number: bigint;

  constructor(value: string) {
    this.number = BigInt(value);
  }

  toBytes(): Buffer {
    // Implementation adapted from Cadence interpreter:
    // https://github.com/onflow/cadence/blob/3db71b8364aee60a83dd53d8a99e935a0e5c8b78/runtime/interpreter/big.go#L27-L58

    if (this.number < 0) {
      return this.toBytesNegative();
    } else if (this.number > 0) {
      return this.toBytesPositive();
    }

    return Buffer.from([0]);
  }

  private toBytesNegative(): Buffer {
    let number = this.number;

    const bitLength = (BigInt(number.toString(2).length) / 8n + 1n) * 8n;
    const prefix = 1n << bitLength;

    number += prefix;

    const bytes = bigIntToBytes(number);

    // Pad with 0xFF to prevent misinterpretation as positive
    //
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (bytes.length === 0 || (bytes.at(0)! & 0x80) === 0) {
      return Buffer.concat([Buffer.from([0xff]), bytes]);
    }

    return bytes;
  }

  private toBytesPositive(): Buffer {
    const bytes = bigIntToBytes(this.number);

    // Pad with 0x0 to prevent misinterpretation as negative
    //
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (bytes.length > 0 && (bytes.at(0)! & 0x80) !== 0) {
      return Buffer.concat([Buffer.from([0x0]), bytes]);
    }

    return bytes;
  }
}

function bigIntToBytes(number: bigint): Buffer {
  let hex = number.toString(16);

  // Pad with leading zero if hex string is uneven length
  if (hex.length % 2) {
    hex = '0' + hex;
  }

  return Buffer.from(hex, 'hex');
}

export class Int8Value {
  static byteLength = 8 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int8Value.byteLength);

    buffer.writeInt8(this.number);

    return buffer;
  }
}

export class Int16Value {
  static byteLength = 16 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int16Value.byteLength);

    buffer.writeInt16BE(this.number);

    return buffer;
  }
}

export class Int32Value {
  static byteLength = 32 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int32Value.byteLength);

    buffer.writeInt32BE(this.number);

    return buffer;
  }
}

export class Int64Value {
  static byteLength = 64 / 8;

  number: bigint;

  constructor(value: string) {
    this.number = BigInt(value);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int64Value.byteLength);

    buffer.writeBigInt64BE(this.number);

    return buffer;
  }
}

export class Fix64Value {
  static scale = 8;
  static byteLength = 64 / 8;

  number: bigint;

  constructor(value: string) {
    this.number = parseFixedPointValue(value, Fix64Value.scale);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Fix64Value.byteLength);

    buffer.writeBigInt64BE(this.number);

    return buffer;
  }
}

export class UIntValue {
  number: bigint;

  constructor(value: string) {
    this.number = BigInt(value);
  }

  toBytes(): Buffer {
    return bigIntToBytes(this.number);
  }
}

export class UInt8Value {
  static byteLength = 8 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int8Value.byteLength);

    buffer.writeUInt8(this.number);

    return buffer;
  }
}

export class UInt16Value {
  static byteLength = 16 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int16Value.byteLength);

    buffer.writeUInt16BE(this.number);

    return buffer;
  }
}

export class UInt32Value {
  static byteLength = 32 / 8;

  number: number;

  constructor(value: string) {
    this.number = parseInt(value, 10);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int32Value.byteLength);

    buffer.writeUInt32BE(this.number);

    return buffer;
  }
}

export class UInt64Value {
  static byteLength = 64 / 8;

  number: bigint;

  constructor(value: string) {
    this.number = BigInt(value);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(Int64Value.byteLength);

    buffer.writeBigUInt64BE(this.number);

    return buffer;
  }
}

export class UFix64Value {
  static scale = 8;
  static byteLength = 64 / 8;

  number: bigint;

  constructor(value: string) {
    this.number = parseFixedPointValue(value, UFix64Value.scale);
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(UFix64Value.byteLength);

    buffer.writeBigUInt64BE(this.number);

    return buffer;
  }
}

export class StringValue {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  toBytes(): Buffer {
    return Buffer.from(this.value, 'utf-8');
  }
}

export function parseBool(value: string | boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`"${value}" is an invalid boolean value. Must be "true" or "false".`);
}

export class BoolValue {
  value: boolean;

  constructor(value: string | boolean) {
    this.value = parseBool(value);
  }

  toBytes(): Buffer {
    // True:  [0x01]
    // False: [0x00]
    return Buffer.from([this.value === true ? 1 : 0]);
  }
}

export class Path {
  domain: string;
  identifier: string;

  constructor({ domain, identifier }: { domain: string; identifier: string }) {
    this.domain = domain;
    this.identifier = identifier;
  }

  static fromString(path: string): Path {
    const pathRegex = /\/(\w+)\/(\w+)/;

    const parts = path.match(pathRegex);

    if (parts === null || parts.length != 3) {
      throw new Error(
        `Invalid path. Path must contain a domain and identifier (e.g. "/public/flowTokenVault"), but received: "${path}"`,
      );
    }

    const [domain, identifier] = parts.slice(1);

    return new Path({ domain, identifier });
  }

  toString(): string {
    return `/${this.domain}/${this.identifier}`;
  }
}
