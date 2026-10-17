// Fixtures for the single-file export: just the one embedded model.
import { embeddedName, embeddedSource } from 'virtual:archi-standalone';

export const fixtures: Record<string, string> = { [embeddedName]: embeddedSource };

export function getFixture(_name: string): string {
  return embeddedSource;
}

export const defaultFixture = embeddedName;
