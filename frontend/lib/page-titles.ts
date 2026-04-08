export const BRAND_NAME = 'Aomenos1km'

export const TITLE_PREFIX_SYSTEM = `Sistema | ${BRAND_NAME} -`

export const TITLE_SITE_DEFAULT = `${BRAND_NAME} - Gestão de Eventos Esportivos`

export function formatSystemTitle(section: string) {
  return `${TITLE_PREFIX_SYSTEM} ${section}`
}

export function formatPublicTitle(page: string) {
  return `${BRAND_NAME} - ${page}`
}
