import { Flags } from "@oclif/core";

export function cacheFlag() {
  return Flags.boolean({
    description: "Use cached results when available",
    default: true,
    allowNo: true,
  });
}

export function timeoutFlag() {
  return Flags.integer({
    description: "Navigation timeout in ms",
    default: 45_000,
  });
}

export function waitFlag() {
  return Flags.integer({
    description: "Wait time after load in ms",
    default: 2500,
  });
}

export function headedFlag() {
  return Flags.boolean({
    description: "Run browser in headed mode",
    default: false,
  });
}

export function debugFlag() {
  return Flags.boolean({
    description: "Enable debug logging",
    default: false,
  });
}
