import { PrivacyValidationError, validateSourceName } from './privacy.js';

const hashLikePattern = /^[A-Fa-f0-9]{32,128}$/;
const packageNameLikePattern = /^@?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function validateExplicitProjectLabel(value: string): string | null {
  try {
    const label = validateSourceName(value);
    if (hashLikePattern.test(label) || packageNameLikePattern.test(label)) {
      return null;
    }
    return label;
  } catch {
    return null;
  }
}

export function requireExplicitProjectLabel(value: string): string {
  const label = validateExplicitProjectLabel(value);
  if (label === null) {
    throw new PrivacyValidationError('invalid_project_label');
  }
  return label;
}
