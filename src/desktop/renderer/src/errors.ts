type RendererErrorCode = 'dashboard_unavailable' | 'refresh_failed';

type RendererSafeError = {
  code: RendererErrorCode;
  message: string;
};

const SAFE_RENDERER_ERROR_MESSAGES: Record<RendererErrorCode, string> = {
  dashboard_unavailable: 'error: dashboard_unavailable',
  refresh_failed: 'error: refresh_failed'
};

export const formatRendererError = (code: RendererErrorCode): RendererSafeError => ({
  code,
  message: SAFE_RENDERER_ERROR_MESSAGES[code]
});
