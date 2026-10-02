import { siteConfig } from '../../site';
export const text = (zh: string, en: string) => siteConfig.language === 'zh-CN' ? zh : en;
