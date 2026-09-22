import path from 'path'

/**
 * Office 文件类型路由（happyoffice-integration-plan.md）。
 * docs  = DOCX，sheets = XLSX/XLSM/CSV，slides = PPTX，pdf = PDF
 */
export const OFFICE_EDITOR_TYPES = ['docs', 'sheets', 'slides', 'pdf']

const EXT_TO_TYPE = {
  '.docx': 'docs',
  '.xlsx': 'sheets',
  '.xlsm': 'sheets',
  '.csv': 'sheets',
  '.pptx': 'slides',
  '.pdf': 'pdf',
}

/** 返回文件对应的编辑器类型，不支持的类型返回 null */
export function resolveEditorType(filePath) {
  if (!filePath) return null
  return EXT_TO_TYPE[path.extname(filePath).toLowerCase()] || null
}
