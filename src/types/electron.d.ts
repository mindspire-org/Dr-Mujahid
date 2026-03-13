interface Window {
  electronAPI?: {
    openFolderDialog?: () => Promise<any>
    closeSplash?: () => Promise<any>
    printCurrent?: (options?: any) => Promise<{ ok: boolean; error?: string }>
    printHTML?: (html: string, options?: any) => Promise<{ ok: boolean; error?: string }>
    printURL?: (url: string, options?: any) => Promise<{ ok: boolean; error?: string }>
    printPreviewCurrent?: (options?: any) => Promise<{ ok: boolean; error?: string }>
    printPreviewHtml?: (html: string, options?: any) => Promise<{ ok: boolean; error?: string }>
    printPreviewPdf?: (dataUrlOrBase64: string) => Promise<{ ok: boolean; error?: string }>
    getLicenseInfo?: () => Promise<{ allowedPages?: string[] }>
  }
}
