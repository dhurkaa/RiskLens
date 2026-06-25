import React from 'react';
import { Text as RNText, type TextProps } from 'react-native';
import { translate, useLanguage } from '../lib/i18n';

/**
 * Drop-in replacement for react-native's <Text> that automatically translates
 * its string children to the active language. Screens import this instead of
 * react-native's Text, so every label localizes with zero per-string changes.
 * Non-string children (icons, nested elements, numbers) pass through untouched.
 */
export function Text({ children, ...rest }: TextProps) {
  const { language } = useLanguage();

  const localize = (node: React.ReactNode): React.ReactNode => {
    if (typeof node === 'string') return translate(node, language);
    if (Array.isArray(node)) return node.map((child) => (typeof child === 'string' ? translate(child, language) : child));
    return node;
  };

  return <RNText {...rest}>{localize(children)}</RNText>;
}

export default Text;
