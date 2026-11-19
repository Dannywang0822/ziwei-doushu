import { jsonSafe } from '@/lib/ziwei/export-json';

export { jsonSafe };

/** 浏览器里下载一份文本文件。不发网络请求。 */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
