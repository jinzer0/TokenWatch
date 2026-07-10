export class StatuslineError extends Error {
  constructor(readonly code: 'invalid_statusline_window' | 'invalid_statusline_preset') {
    super(code);
    this.name = 'StatuslineError';
  }
}
