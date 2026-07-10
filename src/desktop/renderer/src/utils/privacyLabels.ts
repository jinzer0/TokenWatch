const WITHHELD_LABEL = 'withheld label';
const UNSAFE_LABEL_PATTERN =
  /(sentinel|api[_-]?key|oauth|credential|secret|password|bearer\s+|raw[_-]?(record|json|content)|metadata\s+json|prompt|response|select\s+\*)/i;
const PATH_LIKE_LABEL_PATTERN =
  /(^~([/\\]|$)|^[A-Za-z]:[/\\]|^[/\\]|[/\\](users|home|private|var|tmp|etc)([/\\]|$)|(^|[/\\])\.?(ssh|aws|config)([/\\]|$))/i;

const isUnsafeLabel = (value: string): boolean =>
  UNSAFE_LABEL_PATTERN.test(value) || PATH_LIKE_LABEL_PATTERN.test(value);

export const formatSafeLabel = (value: string | null): string => {
  if (value === null) return 'unknown';
  const trimmed = value.trim();
  if (!trimmed || isUnsafeLabel(trimmed)) return WITHHELD_LABEL;
  return trimmed;
};
